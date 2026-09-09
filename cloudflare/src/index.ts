import { createD1Database } from "./database";
import { handleApi, injectProfileMeta, respond, type AppEnv } from "../../server/application";

export default {
  async fetch(request, env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const appEnv: AppEnv = {
      DB: createD1Database(env.DB),
      APP_ORIGIN: env.APP_ORIGIN,
      CORS_ORIGIN: env.CORS_ORIGIN,
      RATE_AUTH_MAX: env.RATE_AUTH_MAX,
    };
    try {
      const path = new URL(request.url).pathname;
      let response = path.startsWith("/api/")
        ? await handleApi(request, appEnv)
        : await env.ASSETS.fetch(request);
      if (!path.startsWith("/api/")) response = await injectProfileMeta(response, path, request, appEnv);
      console.log(JSON.stringify({ event: "request", requestId, method: request.method, path, status: response.status, durationMs: Date.now() - started }));
      return respond(response, request, appEnv);
    } catch (cause) {
      const path = new URL(request.url).pathname;
      console.error(JSON.stringify({ event: "request_error", requestId, method: request.method, path, cause: String(cause) }));
      return respond(Response.json({ detail: "Ocurrió un error inesperado." }, { status: 500 }), request, appEnv);
    }
  },
} satisfies ExportedHandler<Env>;
