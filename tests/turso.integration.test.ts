import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { handleApi, injectProfileMeta, respond, type AppEnv } from "../server/application";
import { createTursoDatabase } from "../server/turso";
import { migrate } from "../scripts/migrate-turso";

const databasePath = resolve(".tmp/test.db");
const databaseUrl = `file:${databasePath}`;
let client: Client;
let env: AppEnv;

beforeEach(async () => {
  await rm(databasePath, { force: true });
  await migrate(databaseUrl);
  client = createClient({ url: databaseUrl });
  env = { DB: createTursoDatabase(client), APP_ORIGIN: "https://yodev.example", RATE_AUTH_MAX: "1000" };
});

afterEach(() => client?.close());

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://yodev.example${path}`, init);
}

async function csrf(): Promise<{ token: string; cookie: string }> {
  const response = await handleApi(request("/api/csrf/"), env);
  const data = await response.json() as { csrfToken: string };
  return { token: data.csrfToken, cookie: response.headers.getSetCookie()[0]!.split(";")[0]! };
}

async function register(email = "developer@example.com"): Promise<{ session: string; csrfCookie: string; token: string }> {
  const security = await csrf();
  const response = await handleApi(request("/api/auth/register/", {
    method: "POST",
    headers: { Cookie: security.cookie, "X-CSRFToken": security.token, Origin: "https://yodev.example", "Content-Type": "application/json" },
    body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email, password: "correct-horse" }),
  }), env);
  expect(response.status).toBe(201);
  return { session: response.headers.getSetCookie()[0]!.split(";")[0]!, csrfCookie: security.cookie, token: security.token };
}

describe("Turso database contract and migrations", () => {
  it("applies migrations idempotently and seeds only the catalog", async () => {
    await migrate(databaseUrl);
    const migrations = await client.execute("SELECT COUNT(*) AS total FROM _yodev_migrations");
    const skills = await client.execute("SELECT COUNT(*) AS total FROM skills");
    const users = await client.execute("SELECT COUNT(*) AS total FROM users");
    expect(Number(migrations.rows[0]!.total)).toBe(8);
    expect(Number(skills.rows[0]!.total)).toBe(440);
    expect(Number(users.rows[0]!.total)).toBe(0);
  });

  it("keeps batch writes atomic and preserves numeric values", async () => {
    const database = createTursoDatabase(client);
    await expect(database.batch([
      database.prepare("INSERT INTO skills (name, slug) VALUES (?, ?)").bind("Rollback One", "rollback"),
      database.prepare("INSERT INTO skills (name, slug) VALUES (?, ?)").bind("Rollback Two", "rollback"),
    ])).rejects.toThrow();
    expect((await database.prepare("SELECT COUNT(*) AS total FROM skills WHERE slug = ?").bind("rollback").first<{ total: number }>())?.total).toBe(0);
  });
});

describe("portable application handler", () => {
  it("supports register, session profile mutation, listing, detail, login and logout", async () => {
    const auth = await register();
    const cookies = `${auth.session}; ${auth.csrfCookie}`;
    const update = await handleApi(request("/api/me/profile/", {
      method: "PUT",
      headers: { Cookie: cookies, "X-CSRFToken": auth.token, Origin: "https://yodev.example", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Platform Engineer", introduction: "Portable profile", isPublished: true, skills: ["typescript"], workModes: ["remote"] }),
    }), env);
    expect(update.status).toBe(200);
    const profile = await update.json() as { slug: string };
    const listing = await handleApi(request("/api/profiles/?required_skills=typescript&work_modes=remote"), env);
    expect((await listing.json() as { results: unknown[] }).results).toHaveLength(1);
    expect((await handleApi(request(`/api/profiles/${profile.slug}/`), env)).status).toBe(200);

    const loginSecurity = await csrf();
    const login = await handleApi(request("/api/auth/login/", { method: "POST", headers: { Cookie: loginSecurity.cookie, "X-CSRFToken": loginSecurity.token, "Content-Type": "application/json" }, body: JSON.stringify({ email: "developer@example.com", password: "correct-horse" }) }), env);
    expect(login.status).toBe(200);
    const logout = await handleApi(request("/api/auth/logout/", { method: "POST", headers: { Cookie: `${login.headers.getSetCookie()[0]!.split(";")[0]}; ${loginSecurity.cookie}`, "X-CSRFToken": loginSecurity.token } }), env);
    expect(logout.status).toBe(204);
    expect(logout.headers.getSetCookie()[0]).toContain("Max-Age=0");
  });

  it("rejects missing CSRF and cross-origin mutations", async () => {
    const security = await csrf();
    const payload = JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "csrf@example.com", password: "correct-horse" });
    expect((await handleApi(request("/api/auth/register/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), env)).status).toBe(403);
    expect((await handleApi(request("/api/auth/register/", { method: "POST", headers: { Cookie: security.cookie, "X-CSRFToken": security.token, Origin: "https://evil.example", "Content-Type": "application/json" }, body: payload }), env)).status).toBe(403);
  });

  it("enforces admin authentication", async () => {
    expect((await handleApi(request("/api/admin/dashboard/"), env)).status).toBe(401);
    const auth = await register("admin@example.com");
    await client.execute("UPDATE users SET is_staff = 1 WHERE email = 'admin@example.com'");
    expect((await handleApi(request("/api/admin/dashboard/", { headers: { Cookie: auth.session } }), env)).status).toBe(200);
  });

  it("renders escaped, valid profile metadata and security headers", async () => {
    const auth = await register();
    await client.execute("UPDATE users SET first_name = '<Ada&', last_name = '\"Lovelace>'");
    await client.execute("UPDATE profiles SET professional_title = '<Architect>', introduction = '\"unsafe&', is_published = 1");
    const own = await handleApi(request("/api/me/profile/", { headers: { Cookie: auth.session } }), env);
    const slug = (await own.json() as { slug: string }).slug;
    const template = '<!doctype html><html><head><title>Old</title><meta name="description" content="old"><link rel="canonical" href="/"></head><body></body></html>';
    const rendered = respond(await injectProfileMeta(new Response(template, { headers: { "Content-Type": "text/html" } }), `/developers/${slug}`, request(`/developers/${slug}`), env), request(`/developers/${slug}`), env);
    const html = await rendered.text();
    expect(html).toContain("&lt;Ada&amp;");
    expect(html).toContain('rel="canonical" href="https://yodev.example/developers/ada-lovelace"');
    expect(html).not.toContain('content="\"unsafe&"');
    expect(rendered.headers.get("X-Frame-Options")).toBe("DENY");
    expect(rendered.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(rendered.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("returns the SPA HTML unchanged for an unknown profile slug", async () => {
    const template = '<!doctype html><html><head><title>yoDev</title></head><body><div id="root"></div></body></html>';
    const rendered = await injectProfileMeta(
      new Response(template, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      "/developers/nonexistent",
      request("/developers/nonexistent"),
      env,
    );

    expect(rendered.status).toBe(200);
    expect(await rendered.text()).toBe(template);
  });
});
