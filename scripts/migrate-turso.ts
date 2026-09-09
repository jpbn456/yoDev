import { createClient } from "@libsql/client";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function migrate(url: string, authToken?: string): Promise<void> {
  if (url.startsWith("file:")) await mkdir(dirname(resolve(url.slice("file:".length))), { recursive: true });
  const client = createClient({ url, authToken });
  await client.execute("CREATE TABLE IF NOT EXISTS _yodev_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const directory = resolve("cloudflare/migrations");
  const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of files) {
    const exists = await client.execute({ sql: "SELECT 1 FROM _yodev_migrations WHERE name = ?", args: [name] });
    if (exists.rows.length) continue;
    const transaction = await client.transaction("write");
    try {
      await transaction.executeMultiple(await readFile(resolve(directory, name), "utf8"));
      await transaction.execute({ sql: "INSERT INTO _yodev_migrations (name) VALUES (?)", args: [name] });
      await transaction.commit();
      console.log(`Applied ${name}`);
    } catch (cause) {
      await transaction.rollback();
      throw cause;
    } finally {
      transaction.close();
    }
  }
  client.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is required");
  await migrate(url, process.env.TURSO_AUTH_TOKEN);
}
