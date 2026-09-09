import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFile } from "node:fs/promises";
import { injectProfileMeta, respond, type AppEnv } from "../server/application";
import { createTursoClientFromEnv, createTursoDatabase } from "../server/turso";
import { sendWebResponse, toWebRequest } from "./_request";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  try {
    const webRequest = toWebRequest(request);
    const slug = typeof request.query.slug === "string" ? request.query.slug : "";
    const template = await readFile(new URL("../frontend/dist/index.html", import.meta.url), "utf8");
    const client = createTursoClientFromEnv();
    try {
      const env: AppEnv = { DB: createTursoDatabase(client), APP_ORIGIN: process.env.APP_ORIGIN };
      const html = new Response(template, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      const rendered = await injectProfileMeta(html, `/developers/${encodeURIComponent(slug)}`, webRequest, env);
      await sendWebResponse(respond(rendered, webRequest, env), response);
    } finally {
      client.close();
    }
  } catch (cause) {
    console.error(JSON.stringify({ event: "vercel_profile_seo_error", path: request.url, cause: cause instanceof Error ? cause.message : String(cause) }));
    if (!response.headersSent && !response.destroyed) response.status(500).json({ detail: "Ocurrió un error inesperado." });
  }
}
