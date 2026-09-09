import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Readable } from "node:stream";

function protocol(request: VercelRequest): string {
  const forwarded = request.headers["x-forwarded-proto"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || "https";
}

export function toWebRequest(request: VercelRequest): Request {
  const host = request.headers["x-forwarded-host"] || request.headers.host || "localhost";
  const hostname = Array.isArray(host) ? host[0] : host;
  const url = new URL(request.url || "/", `${protocol(request)}://${hostname}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const forwardedFor = request.headers["x-forwarded-for"];
  if (!forwardedFor && request.socket.remoteAddress) headers.set("x-forwarded-for", request.socket.remoteAddress);
  const method = request.method || "GET";
  const abort = new AbortController();
  if (request.aborted) abort.abort();
  else request.once("aborted", () => abort.abort());
  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD" && request.body !== undefined) {
    body = typeof request.body === "string" || Buffer.isBuffer(request.body)
      ? request.body.toString()
      : JSON.stringify(request.body);
  }
  return new Request(url, { method, headers, body, signal: abort.signal });
}

export async function sendWebResponse(response: Response, target: VercelResponse): Promise<void> {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") target.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) target.setHeader("Set-Cookie", cookies);
  if (!response.body) {
    target.end();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const stream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
    stream.once("error", reject);
    target.once("error", reject);
    target.once("finish", resolve);
    target.once("close", () => target.writableFinished ? resolve() : reject(new Error("Client disconnected before the response completed")));
    stream.pipe(target);
  });
}
