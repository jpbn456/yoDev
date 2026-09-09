import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import worker from "./index";
import { sendVerificationEmail } from "./email";
import { sha256 } from "./passwords";

type Json = Record<string, unknown>;

let platform: PlatformProxy<Env>;
let sequence = 0;
const deliveredTokens = new Map<string, string>();
const resendFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
  const payload = JSON.parse(String(init?.body)) as { to: string; html: string };
  const match = payload.html.match(/href="([^"]+)"/);
  if (match) deliveredTokens.set(payload.to, new URL(match[1].replaceAll("&amp;", "&")).searchParams.get("token") || "");
  return new Response(JSON.stringify({ id: "email-test" }), { status: 200, headers: { "Content-Type": "application/json" } });
});

function env(overrides: Partial<Env> = {}): Env {
  return {
    ...platform.env,
    RATE_AUTH_MAX: "1000",
    APP_ORIGIN: "https://app.example.com",
    EMAIL_FROM: "yoDev <confirmations@example.com>",
    RESEND_API_KEY: "re_test_only",
    ...overrides,
  };
}

async function dispatch(path: string, init: RequestInit = {}, environment = env()): Promise<Response> {
  return worker.fetch!(new Request(`https://api.example.com${path}`, init), environment, platform.ctx);
}

async function csrf(): Promise<{ token: string; cookie: string }> {
  const response = await dispatch("/api/csrf/");
  const data = await response.json<{ csrfToken: string }>();
  return { token: data.csrfToken, cookie: response.headers.get("Set-Cookie")!.split(";")[0] };
}

async function post(path: string, payload: Json, cookie = "", environment = env()): Promise<Response> {
  const security = await csrf();
  return dispatch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": security.token, Cookie: [security.cookie, cookie].filter(Boolean).join("; ") },
    body: JSON.stringify(payload),
  }, environment);
}

async function register(environment = env()): Promise<{ email: string; cookie: string; response: Response; token: string }> {
  sequence += 1;
  const email = `person-${sequence}@example.com`;
  const response = await post("/api/auth/register/", { firstName: "Alex", lastName: "Dev", email, password: "secure-password" }, "", environment);
  const cookie = response.headers.get("Set-Cookie")?.split(";")[0] || "";
  return { email, cookie, response, token: deliveredTokens.get(email) || "" };
}

async function putProfile(cookie: string, isPublished: boolean): Promise<Response> {
  const security = await csrf();
  return dispatch("/api/me/profile/", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-CSRFToken": security.token, Cookie: `${security.cookie}; ${cookie}` },
    body: JSON.stringify({ firstName: "Alex", lastName: "Dev", title: "Developer", isPublished }),
  });
}

async function applyMigration(path: string): Promise<void> {
  const statements = readFileSync(path, "utf8").replace(/^\s*--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);
  await platform.env.DB.batch(statements.map((statement) => platform.env.DB.prepare(statement)));
}

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc", persist: false, remoteBindings: false, envFiles: [] });
  for (let number = 1; number <= 6; number += 1) {
    const name = ["initial", "remove_contact_messages", "expand_skill_catalog", "profile_resume", "exhaustive_it_skill_catalog", "education_current"][number - 1];
    await applyMigration(`migrations/${String(number).padStart(4, "0")}_${name}.sql`);
  }
  await platform.env.DB.prepare("INSERT INTO users (email, password_hash, first_name, last_name) VALUES ('existing@example.com', 'legacy', 'Existing', 'User')").run();
  await applyMigration("migrations/0007_email_verification.sql");
  vi.stubGlobal("fetch", resendFetch);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await platform.dispose();
});

describe("email verification behavior", () => {
  it("migrates existing users as verified", async () => {
    const row = await platform.env.DB.prepare("SELECT email_verified_at FROM users WHERE email = 'existing@example.com'").first<{ email_verified_at: string | null }>();
    expect(row?.email_verified_at).toBeTruthy();
  });

  it("creates new users unverified, stores only a token hash, and never leaks the raw token", async () => {
    const registration = await register();
    const data = await registration.response.clone().json<Json>();
    const user = await platform.env.DB.prepare("SELECT id, email_verified_at FROM users WHERE email = ?").bind(registration.email).first<{ id: number; email_verified_at: string | null }>();
    const pending = await platform.env.DB.prepare("SELECT token_hash FROM email_verification_tokens WHERE user_id = ?").bind(user!.id).first<{ token_hash: string }>();
    expect(registration.response.status).toBe(201);
    expect(data).toMatchObject({ emailVerified: false, verificationStatus: "pending", delivery: { status: "sent" } });
    expect(JSON.stringify(data)).not.toContain(registration.token);
    expect(user?.email_verified_at).toBeNull();
    expect(registration.token).toBeTruthy();
    expect(pending?.token_hash).toBe(await sha256(registration.token));
    expect(pending?.token_hash).not.toBe(registration.token);
  });

  it("does not disclose whether a registration email already exists", async () => {
    const registration = await register();
    const duplicate = await post("/api/auth/register/", { firstName: "Alex", lastName: "Dev", email: registration.email, password: "secure-password" });
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toEqual({ detail: "No pudimos crear la cuenta con esos datos." });
  });

  it("confirms a valid token once and consumes all outstanding tokens", async () => {
    const registration = await register();
    const confirmed = await post("/api/auth/verify-email/", { token: registration.token });
    const reused = await post("/api/auth/verify-email/", { token: registration.token });
    const user = await platform.env.DB.prepare("SELECT id, email_verified_at FROM users WHERE email = ?").bind(registration.email).first<{ id: number; email_verified_at: string | null }>();
    const remaining = await platform.env.DB.prepare("SELECT 1 FROM email_verification_tokens WHERE user_id = ?").bind(user!.id).first();
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ emailVerified: true });
    expect(reused.status).toBe(400);
    expect(user?.email_verified_at).toBeTruthy();
    expect(remaining).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const registration = await register();
    await platform.env.DB.prepare("UPDATE email_verification_tokens SET expires_at = ? WHERE token_hash = ?").bind("2000-01-01T00:00:00.000Z", await sha256(registration.token)).run();
    expect((await post("/api/auth/verify-email/", { token: registration.token })).status).toBe(400);
  });

  it("rotates resend tokens and enforces the database cooldown", async () => {
    const registration = await register();
    const user = await platform.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(registration.email).first<{ id: number }>();
    const cooldown = await post("/api/auth/resend-verification/", {}, registration.cookie);
    expect(cooldown.status).toBe(429);
    await platform.env.DB.prepare("UPDATE email_verification_tokens SET last_attempt_at = ? WHERE user_id = ?").bind("2000-01-01T00:00:00.000Z", user!.id).run();
    const resent = await post("/api/auth/resend-verification/", {}, registration.cookie);
    const rotated = deliveredTokens.get(registration.email)!;
    expect(resent.status).toBe(200);
    expect(rotated).not.toBe(registration.token);
    expect((await platform.env.DB.prepare("SELECT token_hash FROM email_verification_tokens WHERE user_id = ?").bind(user!.id).first<{ token_hash: string }>())?.token_hash).toBe(await sha256(rotated));
  });

  it("keeps registration and login usable when email configuration is missing", async () => {
    const registration = await register(env({ RESEND_API_KEY: "", EMAIL_FROM: "" }));
    const data = await registration.response.clone().json<Json>();
    expect(registration.response.status).toBe(201);
    expect(data.delivery).toEqual({ status: "failed", reason: "configuration" });
    const login = await post("/api/auth/login/", { email: registration.email, password: "secure-password" });
    expect(login.status).toBe(200);
    expect(await login.json()).toMatchObject({ emailVerified: false, verificationStatus: "pending" });
  });

  it("reports provider failure without deleting the account", async () => {
    resendFetch.mockResolvedValueOnce(new Response("provider error", { status: 500 }));
    const registration = await register();
    expect(await registration.response.clone().json()).toMatchObject({ delivery: { status: "failed", reason: "provider" } });
    expect(await platform.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(registration.email).first()).toBeTruthy();
  });

  it("allows draft saves, blocks unverified publishing, and allows publishing after confirmation", async () => {
    const registration = await register();
    expect((await putProfile(registration.cookie, false)).status).toBe(200);
    const blocked = await putProfile(registration.cookie, true);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ detail: "Confirma tu correo antes de publicar el perfil." });
    expect((await post("/api/auth/verify-email/", { token: registration.token })).status).toBe(200);
    expect((await putProfile(registration.cookie, true)).status).toBe(200);
  });
});

describe("Resend email adapter", () => {
  it("sends the current HTTPS API contract and escapes user content", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const result = await sendVerificationEmail(env(), "recipient@example.com", "<Alex>", "raw-token", fetcher);
    const [endpoint, init] = fetcher.mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(result).toEqual({ status: "sent" });
    expect(String(endpoint)).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer re_test_only", "Content-Type": "application/json" });
    expect(payload).toMatchObject({ from: "yoDev <confirmations@example.com>", to: "recipient@example.com", subject: "Confirma tu correo en yoDev" });
    expect(payload.html).toContain("&lt;Alex&gt;");
    expect(payload.text).toContain("raw-token");
  });

  it("fails closed for an unsafe application origin", async () => {
    const fetcher = vi.fn();
    expect(await sendVerificationEmail(env({ APP_ORIGIN: "https://app.example.com/path" }), "recipient@example.com", "Alex", "token", fetcher)).toEqual({ status: "failed", reason: "configuration" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
