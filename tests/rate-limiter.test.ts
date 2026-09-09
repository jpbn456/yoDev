import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleApi, resetRateLimits, type AppEnv } from "../server/application.js";
import type { Database, DatabaseValue, PreparedStatement, RunResult } from "../server/database.js";

// ---------------------------------------------------------------------------
// In-memory SQLite adapter implementing the Database contract from
// server/database.ts — used as a fake DB for fast, isolated unit tests.
// ---------------------------------------------------------------------------

let database: DatabaseSync;
let env: AppEnv;

function prepare(sql: string): PreparedStatement {
  let values: DatabaseValue[] = [];
  const toSql = (v: DatabaseValue): import("node:sqlite").SQLInputValue =>
    typeof v === "boolean" ? Number(v) : v as import("node:sqlite").SQLInputValue;
  return {
    bind(...parameters: DatabaseValue[]) { values = parameters; return this; },
    async first<T extends Record<string, unknown>>(): Promise<T | null> { return database.prepare(sql).get(...values.map(toSql)) as T ?? null; },
    async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> { return { results: database.prepare(sql).all(...values.map(toSql)) as T[] }; },
    async run(): Promise<RunResult> { return database.prepare(sql).run(...values.map(toSql)) as unknown as RunResult; },
  } satisfies PreparedStatement;
}

const dbAdapter: Database = {
  prepare,
  async batch(statements: PreparedStatement[]) {
    database.exec("BEGIN");
    try {
      const results = await Promise.all(statements.map((s) => s.run()));
      database.exec("COMMIT");
      return results;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  },
};

const migration = (name: string) => database.exec(readFileSync(new URL(`../cloudflare/migrations/${name}`, import.meta.url), "utf8"));

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  migration("0001_initial.sql");
  migration("0008_rate_limits.sql");
  env = { DB: dbAdapter, RATE_AUTH_MAX: "3" };
  resetRateLimits();
});

afterEach(() => {
  database?.close();
});

function request(path: string, init?: RequestInit): Request {
  return new Request(`https://yodev.example${path}`, init);
}

function registerRequest(ip = "10.0.0.1"): Request {
  return request("/api/auth/register/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://yodev.example",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ firstName: "Test", lastName: "User", email: "test@example.com", password: "password123" }),
  });
}

function loginRequest(ip = "10.0.0.1"): Request {
  return request("/api/auth/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://yodev.example",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email: "test@example.com", password: "password123" }),
  });
}

describe("DB-backed rate limiter", () => {
  it("allows the first attempt (returns CSRF error, not 429)", async () => {
    const res = await handleApi(registerRequest(), env);
    expect(res.status).not.toBe(429);
    expect(res.status).toBe(403); // CSRF failure — proves rate check passed
  });

  it("allows requests up to the limit", async () => {
    const max = Number(env.RATE_AUTH_MAX);
    for (let i = 0; i < max; i++) {
      const res = await handleApi(registerRequest(), env);
      expect(res.status).not.toBe(429);
    }
  });

  it("rejects with 429 when the limit is exceeded", async () => {
    const max = Number(env.RATE_AUTH_MAX);
    for (let i = 0; i < max; i++) {
      await handleApi(registerRequest(), env);
    }
    const res = await handleApi(registerRequest(), env);
    expect(res.status).toBe(429);
    const body = await res.json() as { detail: string };
    expect(body.detail).toContain("Demasiados");
  });

  it("resets after the window expires", async () => {
    const max = Number(env.RATE_AUTH_MAX);
    // Exhaust the limit
    for (let i = 0; i < max; i++) {
      await handleApi(registerRequest(), env);
    }
    // Expire the row directly in the DB (simulates window passing)
    database.prepare("UPDATE rate_limits SET reset_at = ? WHERE key = ?").run(Date.now() - 1000, "10.0.0.1:register");
    resetRateLimits(); // Clear the in-memory fast-path too

    const res = await handleApi(registerRequest(), env);
    expect(res.status).not.toBe(429);
  });

  it("isolates register and login buckets", async () => {
    const max = Number(env.RATE_AUTH_MAX);
    // Exhaust register bucket
    for (let i = 0; i < max; i++) {
      await handleApi(registerRequest(), env);
    }
    // Login bucket should still be fresh
    const res = await handleApi(loginRequest(), env);
    expect(res.status).not.toBe(429);
  });

  it("isolates buckets by IP address", async () => {
    const max = Number(env.RATE_AUTH_MAX);
    // Exhaust bucket for IP 10.0.0.1
    for (let i = 0; i < max; i++) {
      await handleApi(registerRequest("10.0.0.1"), env);
    }
    // Different IP should still be allowed
    const res = await handleApi(registerRequest("10.0.0.2"), env);
    expect(res.status).not.toBe(429);
  });

  it("applies the configured RATE_AUTH_MAX from env", async () => {
    env.RATE_AUTH_MAX = "1";
    const first = await handleApi(registerRequest(), env);
    expect(first.status).not.toBe(429);
    const second = await handleApi(registerRequest(), env);
    expect(second.status).toBe(429);
  });

  it("falls back to default RATE_AUTH_MAX when env value is invalid", async () => {
    env.RATE_AUTH_MAX = "not-a-number";
    // Default is 10 — just verify we can make several requests without 429
    for (let i = 0; i < 5; i++) {
      const res = await handleApi(registerRequest(), env);
      expect(res.status).not.toBe(429);
    }
  });
});
