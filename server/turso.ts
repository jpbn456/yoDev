import { createClient, type Client, type InStatement, type ResultSet, type Value } from "@libsql/client";
import type { Database, DatabaseValue, PreparedStatement, RunResult } from "./database";

function inputValue(value: DatabaseValue): Value {
  if (typeof value === "boolean") return Number(value);
  if (value instanceof Uint8Array) return Uint8Array.from(value).buffer;
  return value;
}

function rowObject<T extends Record<string, unknown>>(row: Record<string, Value>): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value])) as T;
}

class TursoStatement implements PreparedStatement {
  private values: DatabaseValue[] = [];

  constructor(readonly client: Client, readonly sql: string) {}

  bind(...values: DatabaseValue[]): PreparedStatement {
    const statement = new TursoStatement(this.client, this.sql);
    statement.values = values;
    return statement;
  }

  toInput(): InStatement {
    return { sql: this.sql, args: this.values.map(inputValue) };
  }

  private async execute(): Promise<ResultSet> {
    return this.client.execute(this.toInput());
  }

  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    const result = await this.execute();
    return result.rows[0] ? rowObject<T>(result.rows[0]) : null;
  }

  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    const result = await this.execute();
    return { results: result.rows.map((row) => rowObject<T>(row)) };
  }

  async run(): Promise<RunResult> {
    const result = await this.execute();
    return { meta: { changes: result.rowsAffected, last_row_id: result.lastInsertRowid } };
  }
}

export function createTursoDatabase(client: Client): Database {
  return {
    prepare: (sql) => new TursoStatement(client, sql),
    async batch(statements) {
      const inputs = statements.map((statement) => {
        if (!(statement instanceof TursoStatement) || statement.client !== client) {
          throw new TypeError("Turso batch received a statement from another adapter");
        }
        return statement.toInput();
      });
      return client.batch(inputs, "write");
    },
  };
}

export function createTursoClientFromEnv(environment: NodeJS.ProcessEnv = process.env): Client {
  const url = environment.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is required");
  return createClient({ url, authToken: environment.TURSO_AUTH_TOKEN });
}
