import { describe, it, expect, afterAll } from "vitest";
import { unstable_dev, type UnstableDevWorker } from "wrangler";

// Integration tests that boot the real Worker against the local D1 database.
// These are READ-ONLY tests: they only hit GET endpoints and never mutate data,
// so they are safe to run alongside the local dev server.

let worker: UnstableDevWorker;

async function startWorker() {
  if (worker) return worker;
  worker = await unstable_dev("src/index.ts", {
    configPath: "wrangler.jsonc",
    local: true,
    port: 0,
    experimental: { disableExperimentalWarning: true },
  });
  return worker;
}

afterAll(async () => {
  if (worker) {
    await worker.stop();
  }
});

const toJSON = async (res: Response) => {
  const data = await res.json();
  return { status: res.status, data };
};

describe("Worker API integration (read-only)", () => {
  it("GET /api/skills/ returns the skill catalog", async () => {
    const w = await startWorker();
    const res = await w.fetch("/api/skills/");
    const { status, data } = await toJSON(res);
    expect(status).toBe(200);
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(100);
    // Each skill must have a slug and a name
    for (const skill of data.results.slice(0, 10)) {
      expect(skill.name).toBeTruthy();
      expect(skill.slug).toBeTruthy();
    }
  });

  it("GET /api/profiles/ returns paginated published profiles", async () => {
    const w = await startWorker();
    const res = await w.fetch("/api/profiles/?page=1&page_size=12");
    const { status, data } = await toJSON(res);
    expect(status).toBe(200);
    expect(data.pagination).toBeTruthy();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeLessThanOrEqual(12);
  });

  it("GET /api/profiles/ supports the required-skills filter", async () => {
    const w = await startWorker();
    const res = await w.fetch("/api/profiles/?required_skills=python&page_size=12");
    const { status, data } = await toJSON(res);
    expect(status).toBe(200);
    for (const profile of data.results) {
      const slugs = profile.skills.map((s) => (typeof s === "string" ? s : s.slug));
      expect(slugs).toContain("python");
    }
  });

  it("GET /api/profiles/ supports the min-years filter", async () => {
    const w = await startWorker();
    const res = await w.fetch(
      "/api/profiles/?required_skills=python&min_years=2&page_size=12",
    );
    const { status, data } = await toJSON(res);
    expect(status).toBe(200);
    for (const profile of data.results) {
      expect(profile.yearsExperience).toBeGreaterThanOrEqual(2);
    }
  });

  it("GET /api/profiles/:slug/ returns a public profile", async () => {
    const w = await startWorker();
    const listRes = await w.fetch("/api/profiles/?page_size=1");
    const list = await toJSON(listRes);
    if (!list.data.results.length) {
      // No published profiles in this D1; nothing to assert beyond base contract.
      expect(list.data.pagination.total).toBeGreaterThanOrEqual(0);
      return;
    }
    const slug = list.data.results[0].slug;
    const res = await w.fetch(`/api/profiles/${slug}/`);
    const { status, data } = await toJSON(res);
    expect(status).toBe(200);
    expect(data.slug).toBe(slug);
    expect(data.firstName).toBeTruthy();
  });

  it("GET /api/profiles/:slug/ returns 404 for an unknown slug", async () => {
    const w = await startWorker();
    const res = await w.fetch("/api/profiles/unknown-slug-xyz/");
    expect(res.status).toBe(404);
  });
});
