import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleApi, respond, type AppEnv } from "../server/application.js";
import { createTursoClientFromEnv, createTursoDatabase } from "../server/turso.js";
import { sendWebResponse, toApiWebRequest } from "./_request.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  let webRequest: Request | undefined;
  try {
    webRequest = toApiWebRequest(request);
    const client = createTursoClientFromEnv();
    try {
      const env: AppEnv = { DB: createTursoDatabase(client), APP_ORIGIN: process.env.APP_ORIGIN, RATE_AUTH_MAX: process.env.RATE_AUTH_MAX };
      await sendWebResponse(respond(await handleApi(webRequest, env), webRequest, env), response);
    } finally {
      client.close();
    }
  } catch (cause) {
    console.error(JSON.stringify({ event: "vercel_request_error", method: request.method, path: request.url, cause: cause instanceof Error ? cause.message : String(cause) }));
    if (response.headersSent || response.destroyed) return;
    const fallbackRequest = webRequest || new Request("https://localhost/api/error");
    const fallbackEnv = { DB: {} as AppEnv["DB"] };
    await sendWebResponse(respond(Response.json({ detail: "Ocurrió un error inesperado." }, { status: 500 }), fallbackRequest, fallbackEnv), response);
  }
}
