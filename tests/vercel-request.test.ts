import { describe, expect, it } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { EventEmitter } from "node:events";
import { sendWebResponse, toApiWebRequest, toWebRequest } from "../api/_request";

describe("Vercel Web API bridge", () => {
  it("preserves method, body, forwarded origin and client IP", async () => {
    const request = Object.assign(new EventEmitter(), {
      method: "POST", url: "/api/auth/login/", body: { email: "a@example.com" },
      headers: { host: "internal", "x-forwarded-host": "yodev.example", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.10" },
      socket: {},
    }) as unknown as VercelRequest;
    const web = toWebRequest(request);
    expect(web.url).toBe("https://yodev.example/api/auth/login/");
    expect(web.headers.get("x-forwarded-for")).toBe("203.0.113.10");
    expect(await web.json()).toEqual({ email: "a@example.com" });
  });

  it.each([
    ["/api?path=skills%2F", "skills/", "https://yodev.example/api/skills/"],
    ["/api?path=auth%2Flogin%2F", "auth/login/", "https://yodev.example/api/auth/login/"],
    ["/api?path=admin%2Fprofiles%2F42%2F&review=pending", "admin/profiles/42/", "https://yodev.example/api/admin/profiles/42/?review=pending"],
  ])("reconstructs rewritten API path %s", (requestUrl, path, expected) => {
    const request = Object.assign(new EventEmitter(), {
      method: "GET", url: requestUrl, query: { path },
      headers: { "x-forwarded-host": "yodev.example", "x-forwarded-proto": "https" },
      socket: {},
    }) as unknown as VercelRequest;

    expect(toApiWebRequest(request).url).toBe(expected);
    expect(request.url).toBe(requestUrl);
  });

  it("writes multiple Set-Cookie headers without folding", async () => {
    const events = new EventEmitter();
    const headers = new Map<string, string | string[]>();
    const target = Object.assign(events, {
      statusCode: 0,
      setHeader(name: string, value: string | string[]) { headers.set(name, value); },
      write() { return true; },
      end() { events.emit("finish"); },
      on: events.on.bind(events), once: events.once.bind(events), emit: events.emit.bind(events),
    }) as unknown as VercelResponse;
    const responseHeaders = new Headers();
    responseHeaders.append("Set-Cookie", "a=1; Path=/");
    responseHeaders.append("Set-Cookie", "b=2; Path=/");
    await sendWebResponse(new Response(null, { status: 204, headers: responseHeaders }), target);
    expect(headers.get("Set-Cookie")).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });
});
