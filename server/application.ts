import { hashPassword, randomToken, sha256, verifyPassword } from "./security";
import type { Database, DatabaseValue, PreparedStatement } from "./database";

export type AppEnv = {
  DB: Database;
  APP_ORIGIN?: string;
  CORS_ORIGIN?: string;
  RATE_AUTH_MAX?: string;
};

type JsonRecord = Record<string, unknown>;
type UserRow = { id: number; email: string; first_name: string; last_name: string; is_staff: number };
type ProfileRow = UserRow & {
  profile_id: number; slug: string; professional_title: string; introduction: string; profile_email: string;
  linkedin_url: string; portfolio_url: string; visible_contacts: string; country: string; region: string; city: string;
  work_modes: string; palette: string; font: string; layout: string; alignment: string; is_owner_featured: number;
  is_published: number; is_reviewed: number; reviewed_at: string | null; updated_at: string;
};
type ExperienceRow = { company: string; role: string; start_date: string; end_date: string; is_current: number; description: string; technologies: string };
type LanguageRow = { language: string; proficiency: string };
type EducationRow = { institution: string; degree: string; field: string; start_date: string; end_date: string; is_current: number };
type Experience = { company: string; role: string; start: string; end: string; current: boolean; description: string; technologies: string[] };
type Language = { language: string; proficiency: string };
type Education = { institution: string; degree: string; field: string; start: string; end: string; current: boolean };

const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });
const error = (detail: string, status = 400) => json({ detail }, status);
const now = () => new Date().toISOString();
const empty = () => new Response(null, { status: 204 });

/**
 * In-memory sliding-window rate limiter.
 * NOTE: state is per-isolate — in production Cloudflare may run several isolates,
 * so this is a best-effort first line of defense, not a hard guarantee across instances.
 * Keep windows short and limits low to be effective against casual brute-force/spam.
 */
const RATE_WINDOW_MS = 15 * 60 * 1000;   // 15 minutes
const RATE_AUTH_MAX = 10;                // default login/register attempts per window
const rateBuckets = new Map<string, { hits: number; resetAt: number }>();

/** Reads the configured auth rate limit from env, falling back to the default. */
function authMax(env: AppEnv): number {
  const value = Number(env.RATE_AUTH_MAX);
  return Number.isFinite(value) && value > 0 ? value : RATE_AUTH_MAX;
}

function rateCheck(key: string, max: number = RATE_AUTH_MAX): boolean {
  const bucket = rateBuckets.get(key);
  const nowMs = Date.now();
  if (!bucket || bucket.resetAt <= nowMs) {
    rateBuckets.set(key, { hits: 1, resetAt: nowMs + RATE_WINDOW_MS });
    return true;
  }
  bucket.hits += 1;
  return bucket.hits <= max;
}

function clientKey(request: Request, suffix = "auth"): string {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
  return `${ip}:${suffix}`;
}

// ---- CSRF: Double-Submit Cookie pattern ----
// The token lives in the csrftoken cookie AND must be echoed in the
// X-CSRFToken header. An attacker cannot read or set the victim's cookie
// (SameSite=Lax + no cross-origin read), so matching header+cookie proves intent.

function csrf(request: Request, token?: string): string {
  const provided = token || request.headers.get("X-CSRFToken") || "";
  const cookieToken = cookies(request).get("csrftoken") || "";
  return provided && cookieToken && provided === cookieToken ? cookieToken : "";
}

function requireCsrf(request: Request): string | null {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  if (origin && origin !== requestOrigin) return null;
  if (!origin && referer) {
    try { if (new URL(referer).origin !== requestOrigin) return null; } catch { return null; }
  }
  const token = csrf(request);
  return token || null;
}

/** Returns an error message if the password is too weak, or null if acceptable. */
function passwordError(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > 128) return "La contraseña no puede superar los 128 caracteres.";
  return null;
}

function parseList(value: string): string[] {
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

function cookies(request: Request): Map<string, string> {
  return new Map((request.headers.get("Cookie") || "").split(";").flatMap((part) => {
    const [key, ...values] = part.trim().split("=");
    return key ? [[key, values.join("=")]] : [];
  }));
}

function sessionCookie(token: string, request: Request): string {
  return `yodev_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

function clearSessionCookie(request: Request): string {
  return `yodev_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

function cors(request: Request, env: AppEnv): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin && origin !== "null") {
    const allowed = (env.CORS_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean);
    if (allowed.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Vary", "Origin");
      headers.set("Access-Control-Allow-Headers", "Content-Type, X-CSRFToken");
      headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    }
  }
  return headers;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function respond(response: Response, request: Request, env: AppEnv): Response {
  const headers = cors(request, env);
  response.headers.forEach((value, key) => headers.set(key, value));
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return new Response(response.body, { status: response.status, headers });
}

async function body(request: Request): Promise<JsonRecord | null> {
  try { return await request.json() as JsonRecord; } catch { return null; }
}

async function currentUser(request: Request, env: AppEnv): Promise<UserRow | null> {
  const token = cookies(request).get("yodev_session");
  if (!token) return null;
  const session = await env.DB.prepare(
    "SELECT u.id, u.email, u.first_name, u.last_name, u.is_staff FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(await sha256(token), now()).first<UserRow>();
  return session || null;
}

async function createSession(userId: number, request: Request, env: AppEnv): Promise<string> {
  const token = randomToken();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .bind(userId, await sha256(token), expires).run();
  return sessionCookie(token, request);
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "developer";
}

async function uniqueSlug(firstName: string, lastName: string, env: AppEnv): Promise<string> {
  const base = slugify(`${firstName}-${lastName}`);
  let candidate = base;
  for (let sequence = 2; await env.DB.prepare("SELECT 1 FROM profiles WHERE slug = ?").bind(candidate).first(); sequence += 1) candidate = `${base}-${sequence}`;
  return candidate;
}

async function skillsFor(profileId: number, env: AppEnv): Promise<{ name: string; slug: string }[]> {
  const result = await env.DB.prepare("SELECT s.name, s.slug FROM skills s JOIN profile_skills ps ON ps.skill_id = s.id WHERE ps.profile_id = ? ORDER BY s.name")
    .bind(profileId).all<{ name: string; slug: string }>();
  return result.results;
}

async function resumeFor(profileId: number, env: AppEnv): Promise<{ experiences: Experience[]; languages: Language[]; education: Education[] }> {
  const [experienceRows, languageRows, educationRows] = await Promise.all([
    env.DB.prepare("SELECT company, role, start_date, end_date, is_current, description, technologies FROM profile_experiences WHERE profile_id = ? ORDER BY sort_order, id").bind(profileId).all<ExperienceRow>(),
    env.DB.prepare("SELECT language, proficiency FROM profile_languages WHERE profile_id = ? ORDER BY sort_order, id").bind(profileId).all<LanguageRow>(),
    env.DB.prepare("SELECT institution, degree, field, start_date, end_date, is_current FROM profile_education WHERE profile_id = ? ORDER BY sort_order, id").bind(profileId).all<EducationRow>(),
  ]);
  return {
    experiences: experienceRows.results.map((item) => ({ company: item.company, role: item.role, start: item.start_date, end: item.end_date, current: Boolean(item.is_current), description: item.description, technologies: parseList(item.technologies) })),
    languages: languageRows.results,
    education: educationRows.results.map((item) => ({ institution: item.institution, degree: item.degree, field: item.field, start: item.start_date, end: item.end_date, current: Boolean(item.is_current) })),
  };
}

function location(row: ProfileRow): string | null {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || null;
}

function yearsFromExperiences(experiences: Experience[]): number {
  if (!experiences || !experiences.length) return 0;
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const exp of experiences) {
    if (exp.start) {
      const [y, m] = exp.start.split("-").map(Number);
      const d = new Date(y, (m || 1) - 1);
      if (!earliest || d < earliest) earliest = d;
    }
    if (exp.current || !exp.end) {
      const now = new Date();
      if (!latest || now > latest) latest = now;
    } else if (exp.end) {
      const [y, m] = exp.end.split("-").map(Number);
      const d = new Date(y, (m || 1) - 1);
      if (!latest || d > latest) latest = d;
    }
  }
  if (!earliest || !latest) return 0;
  return Math.max(0, Math.floor((latest.getTime() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

function yearsFrom(range: { earliest: string; latest: string } | null): number {
  if (!range || !range.earliest || !range.latest) return 0;
  const [ey, em] = range.earliest.split("-").map(Number);
  const [ly, lm] = range.latest.split("-").map(Number);
  const start = new Date(ey, (em || 1) - 1);
  const end = new Date(ly, (lm || 1) - 1);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

async function yearsForProfiles(profileIds: number[], env: AppEnv): Promise<Map<number, number>> {
  const yearsMap = new Map<number, number>();
  if (!profileIds.length) return yearsMap;
  const placeholders = profileIds.map(() => "?").join(",");
  const yearRows = await env.DB.prepare(`
    SELECT profile_id,
      MIN(start_date) as earliest,
      MAX(CASE WHEN is_current = 1 OR end_date = '' THEN date('now') ELSE end_date END) as latest
    FROM profile_experiences
    WHERE profile_id IN (${placeholders}) AND start_date != ''
    GROUP BY profile_id
  `).bind(...profileIds).all<{ profile_id: number; earliest: string; latest: string }>();
  for (const row of yearRows.results) {
    const years = yearsFrom({ earliest: row.earliest, latest: row.latest });
    if (years > 0) yearsMap.set(row.profile_id, years);
  }
  return yearsMap;
}

async function serialize(row: ProfileRow, env: AppEnv, detail = false, privateFields = false, yearsExperience?: number): Promise<JsonRecord> {
  const visible = parseList(row.visible_contacts);
  const skills = await skillsFor(row.profile_id, env);
  const profile: JsonRecord = {
    id: row.profile_id, slug: row.slug, firstName: row.first_name, lastName: row.last_name, title: row.professional_title,
    location: location(row), workModes: parseList(row.work_modes), skills,
    style: { palette: row.palette, font: row.font, layout: row.layout, alignment: row.alignment },
    contacts: { email: privateFields || visible.includes("email") ? row.profile_email || null : null, linkedin: privateFields || visible.includes("linkedin") ? row.linkedin_url || null : null },
    isReviewed: Boolean(row.is_reviewed), isFeatured: Boolean(row.is_owner_featured),
    yearsExperience: yearsExperience ?? 0,
  };
  if (detail) {
    const resume = await resumeFor(row.profile_id, env);
    Object.assign(profile, { introduction: row.introduction, portfolio: row.portfolio_url, country: row.country, region: row.region, city: row.city, ...resume, yearsExperience: yearsExperience ?? yearsFromExperiences(resume.experiences) });
  }
  if (privateFields) Object.assign(profile, {
    editable: { firstName: row.first_name, lastName: row.last_name, email: row.profile_email, linkedin: row.linkedin_url, visibleContacts: visible, workModes: parseList(row.work_modes), skills: skills.map((skill) => skill.slug), isPublished: Boolean(row.is_published) },
    isAdmin: Boolean(row.is_staff),
  });
  return profile;
}

const profileSelect = "SELECT p.id AS profile_id, p.slug, p.professional_title, p.introduction, p.email AS profile_email, p.linkedin_url, p.portfolio_url, p.visible_contacts, p.country, p.region, p.city, p.work_modes, p.palette, p.font, p.layout, p.alignment, p.is_owner_featured, p.is_published, p.is_reviewed, p.reviewed_at, p.updated_at, u.id, u.email, u.first_name, u.last_name, u.is_staff FROM profiles p JOIN users u ON u.id = p.user_id";

async function profileBySlug(slug: string, env: AppEnv, publicOnly = true): Promise<ProfileRow | null> {
  return env.DB.prepare(`${profileSelect} WHERE p.slug = ?${publicOnly ? " AND p.is_published = 1" : ""}`).bind(slug).first<ProfileRow>();
}

async function profileForUser(userId: number, env: AppEnv): Promise<ProfileRow | null> {
  return env.DB.prepare(`${profileSelect} WHERE p.user_id = ?`).bind(userId).first<ProfileRow>();
}

function stringValue(data: JsonRecord, key: string, fallback = ""): string {
  return typeof data[key] === "string" ? data[key].trim() : fallback;
}

function permitted(data: JsonRecord, key: string, choices: string[], fallback: string[]): string[] {
  if (!Array.isArray(data[key])) return fallback;
  return data[key].filter((value): value is string => typeof value === "string" && choices.includes(value));
}

function resumeData(data: JsonRecord): { experiences?: Experience[]; languages?: Language[]; education?: Education[]; detail?: string } {
  const cleanString = (item: JsonRecord, key: string, maximum: number): string | null => {
    if (item[key] === undefined) return "";
    return typeof item[key] === "string" && item[key].trim().length <= maximum ? item[key].trim() : null;
  };
  const cleanDate = (item: JsonRecord, key: string): string | null => {
    const value = cleanString(item, key, 7);
    return value !== null && (!value || /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) ? value : null;
  };
  const result: { experiences?: Experience[]; languages?: Language[]; education?: Education[]; detail?: string } = {};
  for (const key of ["experiences", "languages", "education"] as const) {
    if (data[key] === undefined) continue;
    if (!Array.isArray(data[key]) || data[key].length > 50) return { detail: `${key} debe ser una lista de hasta 50 elementos.` };
    const values: unknown[] = [];
    for (const entry of data[key]) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { detail: `Cada elemento de ${key} debe ser un objeto.` };
      const item = entry as JsonRecord;
      if (key === "experiences") {
        const company = cleanString(item, "company", 160); const role = cleanString(item, "role", 160);
        const start = cleanDate(item, "start"); const end = cleanDate(item, "end"); const description = cleanString(item, "description", 4000);
        if ([company, role, start, end, description].includes(null) || (item.current !== undefined && typeof item.current !== "boolean")) return { detail: "Revisá los campos de experiencia y usá fechas AAAA-MM." };
        if (item.technologies !== undefined && (!Array.isArray(item.technologies) || item.technologies.length > 30 || item.technologies.some((value) => typeof value !== "string" || value.trim().length > 80))) return { detail: "Las tecnologías deben ser una lista de hasta 30 textos." };
        const current = item.current === true;
        values.push({ company, role, start, end: current ? "" : end, current, description, technologies: (item.technologies || []).map((value: string) => value.trim()).filter(Boolean) });
      } else if (key === "languages") {
        const language = cleanString(item, "language", 100); const proficiency = cleanString(item, "proficiency", 100);
        if (language === null || proficiency === null) return { detail: "Revisá los campos de idiomas." };
        values.push({ language, proficiency });
      } else {
        const institution = cleanString(item, "institution", 200); const degree = cleanString(item, "degree", 160); const field = cleanString(item, "field", 160);
        const start = cleanDate(item, "start"); const end = cleanDate(item, "end");
        if ([institution, degree, field, start, end].includes(null) || (item.current !== undefined && typeof item.current !== "boolean")) return { detail: "Revisa los campos de educación y usa fechas AAAA-MM y un valor booleano para En curso." };
        const current = item.current === true;
        values.push({ institution, degree, field, start, end: current ? "" : end, current });
      }
    }
    if (key === "experiences") result.experiences = values as Experience[];
    if (key === "languages") result.languages = values as Language[];
    if (key === "education") result.education = values as Education[];
  }
  return result;
}

export async function handleApi(request: Request, env: AppEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request, env) });
  if (!path.startsWith("/api/")) return error("No encontrado.", 404);

  if (path === "/api/csrf/" && method === "GET") {
    const token = randomToken();
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ csrfToken: token }, 200, { "Set-Cookie": `csrftoken=${token}; Path=/; SameSite=Lax; Max-Age=7200${secure}` });
  }
  if (path === "/api/skills/" && method === "GET") {
    const result = await env.DB.prepare("SELECT name, slug FROM skills ORDER BY name").all<{ name: string; slug: string }>();
    return json({ results: result.results });
  }
  if (path === "/api/auth/register/" && method === "POST") {
    if (!rateCheck(clientKey(request, "register"), authMax(env))) return error("Demasiados intentos. Esperá unos minutos e intentá de nuevo.", 429);
    if (!requireCsrf(request)) return error("Token de seguridad inválido. Recargá la página e intentá de nuevo.", 403);
    const data = await body(request);
    if (!data) return error("El cuerpo debe ser JSON válido.");
    const firstName = stringValue(data, "firstName"); const lastName = stringValue(data, "lastName");
    const email = stringValue(data, "email").toLowerCase(); const password = stringValue(data, "password");
    if (!firstName || !lastName || !email || !password) return error("Nombre, apellido, correo y contraseña son obligatorios.");
    const weak = passwordError(password);
    if (weak) return error(weak);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Ingresá un correo electrónico válido.");
    if (firstName.length > 80 || lastName.length > 80) return error("Nombre y apellido son demasiado largos.");
    const existing = await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first();
    if (existing) return error("Ya existe una cuenta con ese correo.");
    const user = await env.DB.prepare("INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)")
      .bind(email, await hashPassword(password), firstName, lastName).run();
    const userId = Number(user.meta.last_row_id);
    await env.DB.prepare("INSERT INTO profiles (user_id, slug, professional_title, introduction, email, created_at, updated_at) VALUES (?, ?, 'Developer', '', ?, ?, ?)")
      .bind(userId, await uniqueSlug(firstName, lastName, env), email, now(), now()).run();
    return json({ id: userId, email }, 201, { "Set-Cookie": await createSession(userId, request, env) });
  }
  if (path === "/api/auth/login/" && method === "POST") {
    if (!rateCheck(clientKey(request, "login"), authMax(env))) return error("Demasiados intentos de ingreso. Esperá unos minutos e intentá de nuevo.", 429);
    if (!requireCsrf(request)) return error("Token de seguridad inválido. Recargá la página e intentá de nuevo.", 403);
    const data = await body(request);
    const email = data ? stringValue(data, "email").toLowerCase() : ""; const password = data ? stringValue(data, "password") : "";
    const user = await env.DB.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").bind(email).first<{ id: number; email: string; password_hash: string }>();
    if (!user || !(await verifyPassword(password, user.password_hash))) return error("Correo o contraseña incorrectos.", 401);
    return json({ id: user.id, email: user.email }, 200, { "Set-Cookie": await createSession(user.id, request, env) });
  }
  if (path === "/api/auth/logout/" && method === "POST") {
    if (!requireCsrf(request)) return error("Token de seguridad inválido.", 403);
    const token = cookies(request).get("yodev_session");
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    const response = empty(); response.headers.set("Set-Cookie", clearSessionCookie(request)); return response;
  }
  if (path === "/api/me/profile/") {
    const user = await currentUser(request, env);
    if (!user) return error("Iniciá sesión para gestionar tu perfil.", 401);
    if (method !== "GET" && !requireCsrf(request)) return error("Token de seguridad inválido. Recargá la página e intentá de nuevo.", 403);
    let profile = await profileForUser(user.id, env);
    if (!profile) {
      await env.DB.prepare("INSERT INTO profiles (user_id, slug, professional_title, introduction, email, created_at, updated_at) VALUES (?, ?, 'Developer', '', ?, ?, ?)")
        .bind(user.id, await uniqueSlug(user.first_name, user.last_name, env), user.email, now(), now()).run();
      profile = await profileForUser(user.id, env);
    }
    if (!profile) return error("No pudimos crear el perfil.", 500);
    if (method === "GET") return json(await serialize(profile, env, true, true));
    if (method === "DELETE") { await env.DB.prepare("DELETE FROM profiles WHERE id = ?").bind(profile.profile_id).run(); return empty(); }
    if (method !== "PUT") return error("Método no permitido.", 405);
    const data = await body(request); if (!data) return error("El cuerpo debe ser JSON válido.");
    const resume = resumeData(data); if (resume.detail) return error(resume.detail);
    const firstName = stringValue(data, "firstName", user.first_name); const lastName = stringValue(data, "lastName", user.last_name);
    if (!firstName || !lastName) return error("Nombre y apellido son obligatorios.");
    const title = stringValue(data, "title", profile.professional_title); const introduction = stringValue(data, "introduction", profile.introduction);
    const published = data.isPublished === undefined ? Boolean(profile.is_published) : Boolean(data.isPublished);
    if (published && !title) return error("Completá el título antes de publicar el perfil.");
    const style = typeof data.style === "object" && data.style !== null ? data.style as JsonRecord : {};
    const styleValue = (key: string, allowed: string[], fallback: string) => typeof style[key] === "string" && allowed.includes(style[key] as string) ? style[key] as string : fallback;
    const email = stringValue(data, "email", profile.profile_email); const timestamp = now();
    const statements: PreparedStatement[] = [
      env.DB.prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?").bind(firstName, lastName, user.id),
      env.DB.prepare("UPDATE profiles SET professional_title = ?, introduction = ?, email = ?, linkedin_url = ?, portfolio_url = ?, country = ?, region = ?, city = ?, visible_contacts = ?, work_modes = ?, palette = ?, font = ?, layout = ?, alignment = ?, is_published = ?, updated_at = ? WHERE id = ?")
        .bind(title, introduction, email, stringValue(data, "linkedin", profile.linkedin_url), stringValue(data, "portfolio", profile.portfolio_url), stringValue(data, "country", profile.country), stringValue(data, "region", profile.region), stringValue(data, "city", profile.city), JSON.stringify(permitted(data, "visibleContacts", ["email", "linkedin"], parseList(profile.visible_contacts))), JSON.stringify(permitted(data, "workModes", ["remote", "hybrid", "onsite"], parseList(profile.work_modes))), styleValue("palette", ["ink", "ocean", "orchid", "moss", "sunset", "terracotta", "lagoon", "slate"], profile.palette), styleValue("font", ["sans", "serif", "geometric"], profile.font), styleValue("layout", ["classic", "centered", "compact"], profile.layout), styleValue("alignment", ["left", "center"], profile.alignment), Number(published), timestamp, profile.profile_id),
    ];
    if (Array.isArray(data.skills)) {
      const slugs = data.skills.filter((value): value is string => typeof value === "string");
      statements.push(env.DB.prepare("DELETE FROM profile_skills WHERE profile_id = ?").bind(profile.profile_id));
      for (const slug of slugs) statements.push(env.DB.prepare("INSERT OR IGNORE INTO profile_skills (profile_id, skill_id) SELECT ?, id FROM skills WHERE slug = ?").bind(profile.profile_id, slug));
    }
    if (resume.experiences) {
      statements.push(env.DB.prepare("DELETE FROM profile_experiences WHERE profile_id = ?").bind(profile.profile_id));
      resume.experiences.forEach((item, order) => statements.push(env.DB.prepare("INSERT INTO profile_experiences (profile_id, sort_order, company, role, start_date, end_date, is_current, description, technologies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(profile.profile_id, order, item.company, item.role, item.start, item.end, Number(item.current), item.description, JSON.stringify(item.technologies))));
    }
    if (resume.languages) {
      statements.push(env.DB.prepare("DELETE FROM profile_languages WHERE profile_id = ?").bind(profile.profile_id));
      resume.languages.forEach((item, order) => statements.push(env.DB.prepare("INSERT INTO profile_languages (profile_id, sort_order, language, proficiency) VALUES (?, ?, ?, ?)").bind(profile.profile_id, order, item.language, item.proficiency)));
    }
    if (resume.education) {
      statements.push(env.DB.prepare("DELETE FROM profile_education WHERE profile_id = ?").bind(profile.profile_id));
      resume.education.forEach((item, order) => statements.push(env.DB.prepare("INSERT INTO profile_education (profile_id, sort_order, institution, degree, field, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(profile.profile_id, order, item.institution, item.degree, item.field, item.start, item.end, Number(item.current))));
    }
    await env.DB.batch(statements);
    const updated = await profileForUser(user.id, env); return json(await serialize(updated!, env, true, true));
  }
  if (path === "/api/profiles/" && method === "GET") {
    const required = (url.searchParams.get("required_skills") || "").split(",").filter(Boolean);
    const optional = (url.searchParams.get("optional_skills") || "").split(",").filter(Boolean);
    const languages = (url.searchParams.get("languages") || "").split(",").map((value) => value.trim()).filter(Boolean);
    const clauses = ["p.is_published = 1"]; const values: DatabaseValue[] = [];
    for (const slug of required) { clauses.push("EXISTS (SELECT 1 FROM profile_skills ps JOIN skills s ON s.id = ps.skill_id WHERE ps.profile_id = p.id AND s.slug = ?)"); values.push(slug); }
    for (const language of languages) { clauses.push("EXISTS (SELECT 1 FROM profile_languages pl WHERE pl.profile_id = p.id AND LOWER(pl.language) = LOWER(?))"); values.push(language); }
    for (const key of ["country", "region", "city"] as const) { const value = url.searchParams.get(key); if (value) { clauses.push(`LOWER(p.${key}) = LOWER(?)`); values.push(value); } }
    const modes = (url.searchParams.get("work_modes") || "").split(",").filter(Boolean);
    if (modes.length) { clauses.push(`EXISTS (SELECT 1 FROM json_each(p.work_modes) WHERE value IN (${modes.map(() => "?").join(",")}))`); values.push(...modes); }
    const minYears = Number(url.searchParams.get("min_years")) || 0;
    if (minYears > 0) {
      clauses.push(`EXISTS (
        SELECT 1 FROM profile_experiences pe
        WHERE pe.profile_id = p.id AND pe.start_date != ''
        GROUP BY pe.profile_id
        HAVING CAST((julianday(COALESCE(MAX(CASE WHEN pe.is_current = 1 OR pe.end_date = '' THEN date('now') ELSE pe.end_date END), date('now'))) - julianday(MIN(pe.start_date))) / 365.25 AS INTEGER) >= ?
      )`);
      values.push(minYears);
    }
    const where = clauses.join(" AND "); const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM profiles p WHERE ${where}`).bind(...values).first<{ total: number }>();
    const requestedPage = Math.max(1, Number(url.searchParams.get("page")) || 1); const pageSize = Math.min(24, Math.max(1, Number(url.searchParams.get("page_size")) || 12));
    const total = count?.total || 0; const pages = Math.max(1, Math.ceil(total / pageSize)); const page = Math.min(requestedPage, pages);
    const relevance = url.searchParams.get("sort") === "relevance" && optional.length ? `(SELECT COUNT(*) FROM profile_skills ps JOIN skills s ON s.id = ps.skill_id WHERE ps.profile_id = p.id AND s.slug IN (${optional.map(() => "?").join(",")}))` : "p.id * 0";
    const rows = await env.DB.prepare(`${profileSelect} WHERE ${where} ORDER BY p.is_owner_featured DESC, ${relevance} DESC, LOWER(u.last_name), LOWER(u.first_name) LIMIT ? OFFSET ?`)
      .bind(...values, ...(url.searchParams.get("sort") === "relevance" && optional.length ? optional : []), pageSize, (page - 1) * pageSize).all<ProfileRow>();
    const yearsMap = await yearsForProfiles(rows.results.map((row) => row.profile_id), env);
    return json({ results: await Promise.all(rows.results.map((row) => serialize(row, env, false, false, yearsMap.get(row.profile_id) || 0))), pagination: { page, pageSize, pages, total, hasNext: page < pages, hasPrevious: page > 1 } });
  }
  const detailMatch = path.match(/^\/api\/profiles\/([^/]+)\/$/);
  if (detailMatch && method === "GET") { const profile = await profileBySlug(detailMatch[1], env); return profile ? json(await serialize(profile, env, true)) : error("Perfil no encontrado.", 404); }

  if (path === "/api/admin/dashboard/" && method === "GET") {
    const user = await currentUser(request, env); if (!user) return error("Iniciá sesión para acceder al panel.", 401); if (!user.is_staff) return error("No tenés permiso para acceder al panel.", 403);
    const review = url.searchParams.get("review"); const filter = review === "pending" ? "WHERE p.is_reviewed = 0" : review === "changed" ? "WHERE p.is_reviewed = 1 AND p.updated_at > p.reviewed_at" : "";
    const total = (await env.DB.prepare(`SELECT COUNT(*) AS total FROM profiles p ${filter}`).first<{ total: number }>())?.total || 0;
    const pageSize = Math.min(24, Math.max(1, Number(url.searchParams.get("page_size")) || 20));
    const pages = Math.max(1, Math.ceil(total / pageSize)); const page = Math.min(Math.max(1, Number(url.searchParams.get("page")) || 1), pages);
    const rows = await env.DB.prepare(`${profileSelect} ${filter} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`).bind(pageSize, (page - 1) * pageSize).all<ProfileRow>();
    const profiles = await Promise.all(rows.results.map(async (row) => ({ ...await serialize(row, env, true, true), updatedAt: row.updated_at, needsReviewAttention: Boolean(row.is_reviewed && row.reviewed_at && row.updated_at > row.reviewed_at) })));
    const summary = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM profiles WHERE is_reviewed = 0) AS pendingReview, (SELECT COUNT(*) FROM profiles WHERE is_published = 1) AS published").first<JsonRecord>();
    return json({ profiles, pagination: { page, pageSize, pages, total, hasNext: page < pages, hasPrevious: page > 1 }, summary });
  }
  const adminProfile = path.match(/^\/api\/admin\/profiles\/(\d+)\/$/);
  if (adminProfile && (method === "POST" || method === "DELETE")) {
    const user = await currentUser(request, env); if (!user) return error("Iniciá sesión para acceder al panel.", 401); if (!user.is_staff) return error("No tenés permiso para acceder al panel.", 403);
    if (!requireCsrf(request)) return error("Token de seguridad inválido. Recargá la página e intentá de nuevo.", 403);
    const profile = await env.DB.prepare(`${profileSelect} WHERE p.id = ?`).bind(Number(adminProfile[1])).first<ProfileRow>(); if (!profile) return error("Perfil no encontrado.", 404);
    if (method === "DELETE") { await env.DB.prepare("DELETE FROM profiles WHERE id = ?").bind(profile.profile_id).run(); return empty(); }
    const data = await body(request) || {}; const featured = data.isFeatured === undefined ? Boolean(profile.is_owner_featured) : Boolean(data.isFeatured); const timestamp = now();
    const statements = [env.DB.prepare("UPDATE profiles SET is_owner_featured = ?, is_reviewed = 1, reviewed_at = ?, updated_at = ? WHERE id = ?").bind(Number(featured), timestamp, timestamp, profile.profile_id)];
    if (featured) statements.unshift(env.DB.prepare("UPDATE profiles SET is_owner_featured = 0 WHERE is_owner_featured = 1").bind());
    await env.DB.batch(statements);
    const updated = await env.DB.prepare(`${profileSelect} WHERE p.id = ?`).bind(profile.profile_id).first<ProfileRow>(); return json({ ...await serialize(updated!, env, true, true), updatedAt: updated!.updated_at, needsReviewAttention: false });
  }
  return error("No encontrado.", 404);
}

export async function injectProfileMeta(response: Response, path: string, request: Request, env: AppEnv): Promise<Response> {
  const match = path.match(/^\/developers\/([^/]+)\/?$/);
  if (!match) return response;
  const slug = match[1];
  const base = canonicalOrigin(request, env);
  const profile = await profileBySlug(slug, env); // publicOnly = true
  if (!profile) return response;
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) return response;
  const html = await response.text();
  const name = `${profile.first_name} ${profile.last_name}`.trim() || "Perfil";
  const title = `${name} — ${profile.professional_title || "Developer"} en yoDev`;
  const description = profile.introduction ? profile.introduction.slice(0, 150) : `Conocé el perfil de ${name} en yoDev.`;
  const profileUrl = `${base}/developers/${slug}`;
  let result = html;
  result = replaceTitle(result, title);
  result = upsertHeadTag(result, "meta", "name", "description", "content", description);
  result = upsertHeadTag(result, "meta", "property", "og:title", "content", title);
  result = upsertHeadTag(result, "meta", "property", "og:description", "content", description);
  result = upsertHeadTag(result, "meta", "property", "og:url", "content", profileUrl);
  result = upsertHeadTag(result, "meta", "property", "og:type", "content", "profile");
  result = upsertHeadTag(result, "meta", "property", "profile:first_name", "content", profile.first_name);
  result = upsertHeadTag(result, "meta", "property", "profile:last_name", "content", profile.last_name);
  result = upsertHeadTag(result, "meta", "name", "twitter:title", "content", title);
  result = upsertHeadTag(result, "meta", "name", "twitter:description", "content", description);
  result = upsertHeadTag(result, "link", "rel", "canonical", "href", profileUrl);
  return new Response(result, { status: response.status, headers: response.headers });
}

export function canonicalOrigin(request: Request, env: AppEnv): string {
  const configured = env.APP_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function replaceTitle(html: string, title: string): string {
  const tag = `<title>${escapeContent(title)}</title>`;
  return /<title(?:\s[^>]*)?>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>/i, tag)
    : html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function upsertHeadTag(html: string, tag: "meta" | "link", key: string, keyValue: string, valueKey: string, value: string): string {
  const escapedKeyValue = keyValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<${tag}\\b(?=[^>]*\\b${key}=["']${escapedKeyValue}["'])[^>]*>`, "i");
  const replacement = `<${tag} ${key}="${escapeAttribute(keyValue)}" ${valueKey}="${escapeAttribute(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace(/<\/head>/i, `${replacement}\n</head>`);
}

export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeContent(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
