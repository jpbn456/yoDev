export type EmailDeliveryResult =
  | { status: "sent" }
  | { status: "failed"; reason: "configuration" | "provider" | "timeout" };

type EmailEnv = Pick<Env, "APP_ORIGIN" | "EMAIL_FROM" | "RESEND_API_KEY">;
type Fetcher = typeof fetch;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function verificationUrl(originValue: string, token: string): URL | null {
  try {
    const origin = new URL(originValue);
    const isLocal = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
    if ((origin.protocol !== "https:" && !(isLocal && origin.protocol === "http:")) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") return null;
    const url = new URL("/verify-email", origin);
    url.searchParams.set("token", token);
    return url;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export async function sendVerificationEmail(
  env: EmailEnv,
  recipient: string,
  firstName: string,
  token: string,
  fetcher: Fetcher = fetch,
): Promise<EmailDeliveryResult> {
  const url = verificationUrl(env.APP_ORIGIN, token);
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !url) return { status: "failed", reason: "configuration" };

  const safeName = escapeHtml(firstName || "developer");
  const safeUrl = escapeHtml(url.toString());
  const text = `Hola ${firstName || "developer"},\n\nConfirma tu correo para poder publicar tu perfil en yoDev.\n\n${url.toString()}\n\nEste enlace vence en 24 horas y solo puede usarse una vez.`;

  try {
    const response = await fetcher(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: recipient,
        subject: "Confirma tu correo en yoDev",
        html: `<p>Hola ${safeName},</p><p>Confirma tu correo para poder publicar tu perfil en yoDev.</p><p><a href="${safeUrl}">Confirmar correo</a></p><p>Este enlace vence en 24 horas y solo puede usarse una vez.</p>`,
        text,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (response.body) await response.body.cancel();
    return response.ok ? { status: "sent" } : { status: "failed", reason: "provider" };
  } catch (cause) {
    return { status: "failed", reason: cause instanceof DOMException && cause.name === "TimeoutError" ? "timeout" : "provider" };
  }
}
