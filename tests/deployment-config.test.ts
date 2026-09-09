import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("deployment routing", () => {
  it("routes profile SEO before the SPA fallback and applies security headers", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      outputDirectory: string;
      rewrites: Array<{ source: string; destination: string }>;
      headers: Array<{ headers: Array<{ key: string }> }>;
    };
    expect(config.outputDirectory).toBe("frontend/dist");
    expect(config.rewrites[0]).toEqual({ source: "/developers/:slug", destination: "/api/profile-seo?slug=:slug" });
    expect(config.rewrites.at(-1)).toEqual({ source: "/(.*)", destination: "/index.html" });
    expect(config.headers[0]!.headers.map((header) => header.key)).toEqual(expect.arrayContaining([
      "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security",
    ]));
  });

  it("keeps the Cloudflare test database isolated with its configured resource identity", async () => {
    const source = await readFile("cloudflare/wrangler.jsonc", "utf8");
    const config = JSON.parse(source) as { env: { test: { name: string; d1_databases: Array<{ binding: string; database_name: string; database_id: string }> } } };
    const testDatabase = config.env.test.d1_databases[0]!;
    expect(config.env.test.name).toBe("yodev-api-test");
    expect(testDatabase).toEqual(expect.objectContaining({
      binding: "DB",
      database_name: "yodev-test",
      database_id: "8707d7ee-c0b1-45c6-b5ad-c4142ffb31af",
    }));
    expect(testDatabase.database_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(testDatabase.database_id).not.toBe("00000000-0000-0000-0000-000000000000");
  });
});
