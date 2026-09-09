import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("deployment routing", () => {
  it("routes profile SEO before the SPA fallback and applies security headers", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      outputDirectory: string;
      rewrites: Array<{ source: string; destination: string }>;
      headers: Array<{ headers: Array<{ key: string }> }>;
    };
    expect(config.outputDirectory).toBe("frontend/dist");
    expect(config.rewrites[0]).toEqual({ source: "/api/(.*)", destination: "/api?path=$1" });
    expect(config.rewrites[1]).toEqual({ source: "/developers/:slug", destination: "/api/profile-seo?slug=:slug" });
    expect(config.rewrites.at(-1)).toEqual({ source: "/(.*)", destination: "/index.html" });
    expect(config.headers[0]!.headers.map((header) => header.key)).toEqual(expect.arrayContaining([
      "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security",
    ]));
  });

  it.skipIf(!existsSync(".vercel/output/config.json"))("keeps generated API and profile routes ahead of the SPA fallback", async () => {
    const config = JSON.parse(await readFile(".vercel/output/config.json", "utf8")) as {
      routes: Array<{ src?: string; dest?: string; handle?: string }>;
    };
    const filesystem = config.routes.findIndex((route) => route.handle === "filesystem");
    const apiRewrite = config.routes.findIndex((route) => route.dest?.startsWith("/api?path="));
    const profileRewrite = config.routes.findIndex((route) => route.dest?.startsWith("/api/profile-seo?slug="));
    const spaFallback = config.routes.findIndex((route) => route.dest === "/index.html");

    expect(filesystem).toBeGreaterThanOrEqual(0);
    expect(apiRewrite).toBeGreaterThan(filesystem);
    expect(profileRewrite).toBeGreaterThan(apiRewrite);
    expect(spaFallback).toBeGreaterThan(profileRewrite);
    const apiPattern = new RegExp(config.routes[apiRewrite]!.src!);
    expect([
      "/api/skills/",
      "/api/profiles/",
      "/api/auth/login/",
      "/api/admin/profiles/42/",
    ].every((path) => apiPattern.test(path))).toBe(true);
  });

  it.skipIf(!existsSync(".vercel/output/functions/api/profile-seo.func/.vc-config.json"))("packages the SPA template with the profile function", async () => {
    const config = JSON.parse(await readFile(".vercel/output/functions/api/profile-seo.func/.vc-config.json", "utf8")) as {
      handler: string;
      filePathMap?: Record<string, string>;
    };
    const bundledSource = await readFile(".vercel/output/functions/api/profile-seo.func/api/profile-seo.js", "utf8");

    expect(config.handler).toBe("api/profile-seo.js");
    expect(config.filePathMap?.["frontend/dist/index.html"]).toBe("frontend/dist/index.html");
    expect(bundledSource).toContain('new URL("../frontend/dist/index.html", import.meta.url)');
  });

  it.skipIf(!existsSync(".vercel/output/functions/api/index.func/.vc-config.json"))("packages the shared server modules into every API function bundle with resolvable imports", async () => {
    for (const entry of ["index", "profile-seo"]) {
      const funcDir = `.vercel/output/functions/api/${entry}.func`;
      // The shared server entrypoints must physically exist inside the packaged function.
      for (const moduleName of ["application", "turso", "security"]) {
        expect(existsSync(`${funcDir}/server/${moduleName}.js`), `${funcDir}/server/${moduleName}.js`).toBe(true);
      }
      // Every relative import in the bundled handler must resolve to a file present in the
      // same bundle, or Node ESM fails at runtime with ERR_MODULE_NOT_FOUND (as on yodev-psi).
      const bundledSource = await readFile(`${funcDir}/api/${entry}.js`, "utf8");
      const relativeImports = [...bundledSource.matchAll(/from "(\.[^"]+)"/g)].map((match) => match[1]);
      expect(relativeImports.length).toBeGreaterThan(0);
      for (const specifier of relativeImports) {
        expect(existsSync(resolve(funcDir, "api", specifier)), `${funcDir}/api/${entry}.js imports ${specifier}`).toBe(true);
      }
      expect(bundledSource).toContain('from "../server/application.js"');
      expect(bundledSource).toContain('from "../server/turso.js"');
      expect(bundledSource).toContain('from "./_request.js"');
    }
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
