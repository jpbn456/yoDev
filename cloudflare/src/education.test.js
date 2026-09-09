import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "./index.ts";
import { sha256 } from "../../server/security.ts";

// Execute the actual handler and SQL against an isolated SQLite database.
// This adapter covers the D1 methods used here, not the Workers runtime itself.
let database;
let env;
const migration = (name) => database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));

function prepare(sql) {
  let values = [];
  return {
    bind(...parameters) { values = parameters; return this; },
    async first() { return database.prepare(sql).get(...values) ?? null; },
    async all() { return { results: database.prepare(sql).all(...values) }; },
    async run() { return database.prepare(sql).run(...values); },
  };
}

async function request(method = "GET", data, path = "/api/me/profile/") {
  return worker.fetch(new Request(`https://example.test${path}`, {
    method,
    headers: { Cookie: "yodev_session=test-session; csrftoken=test-csrf", "X-CSRFToken": "test-csrf", "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  }), env);
}

beforeEach(async () => {
  database = new DatabaseSync(":memory:");
  migration("0001_initial.sql");
  migration("0004_profile_resume.sql");
  database.exec("INSERT INTO users (email, password_hash, first_name, last_name) VALUES ('test@example.test', '', 'Test', 'User'); INSERT INTO profiles (user_id, slug, is_published) VALUES (1, 'test-user', 1); INSERT INTO profile_education (profile_id, sort_order, institution, start_date) VALUES (1, 0, 'Legacy School', '2020-03');");
  database.prepare("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (1, ?, '2099-01-01')").run(await sha256("test-session"));
  migration("0006_education_current.sql");
  migration("0008_rate_limits.sql");
  env = { DB: { prepare, async batch(statements) {
    database.exec("BEGIN");
    try { const results = await Promise.all(statements.map((statement) => statement.run())); database.exec("COMMIT"); return results; }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  } } };
});
afterEach(() => database?.close());

describe("education persistence", () => {
  it("keeps legacy missing completion dates non-current after migration and save", async () => {
    const profile = await (await request()).json();
    expect(profile.education[0]).toMatchObject({ institution: "Legacy School", end: "", current: false });
    const response = await request("PUT", { education: [{ institution: "Legacy School", start: "2020-03", end: "" }] });
    expect(response.status).toBe(200);
    expect((await response.json()).education[0].current).toBe(false);
  });

  it("persists current education on private and public reload, then allows completion", async () => {
    const education = [{ institution: "School", start: "2024-03", end: "2025-12", current: true }];
    expect((await request("PUT", { education })).status).toBe(200);
    for (const path of ["/api/me/profile/", "/api/profiles/test-user/"]) {
      const response = await request("GET", undefined, path);
      expect(response.status).toBe(200);
      expect((await response.json()).education[0]).toMatchObject({ current: true, end: "" });
    }
    education[0] = { ...education[0], current: false, end: "2026-09" };
    expect((await request("PUT", { education })).status).toBe(200);
    expect((await (await request()).json()).education[0]).toMatchObject({ current: false, end: "2026-09" });
  });

  it.each(["true", 1, null])("rejects a non-boolean current flag (%j) without changing data", async (current) => {
    expect((await request("PUT", { education: [{ current }] })).status).toBe(400);
    expect((await (await request()).json()).education[0].institution).toBe("Legacy School");
  });

  it("accepts an omitted completion date when current and rejects invalid completed dates", async () => {
    expect((await request("PUT", { education: [{ current: true }] })).status).toBe(200);
    expect((await (await request()).json()).education[0]).toMatchObject({ current: true, end: "" });
    expect((await request("PUT", { education: [{ current: false, end: "2025-13" }] })).status).toBe(400);
  });
});
