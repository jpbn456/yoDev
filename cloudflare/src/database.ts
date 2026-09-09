import type { Database, DatabaseValue, PreparedStatement, RunResult } from "../../server/database";

class D1Statement implements PreparedStatement {
  constructor(readonly statement: D1PreparedStatement) {}

  bind(...values: DatabaseValue[]): PreparedStatement {
    const compatible = values.map((value) => typeof value === "boolean" ? Number(value) : value instanceof Uint8Array ? value.buffer : value);
    return new D1Statement(this.statement.bind(...compatible));
  }

  first<T extends Record<string, unknown>>(): Promise<T | null> {
    return this.statement.first<T>();
  }

  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    const result = await this.statement.all<T>();
    return { results: result.results };
  }

  async run(): Promise<RunResult> {
    const result = await this.statement.run();
    return { meta: { changes: result.meta.changes, last_row_id: result.meta.last_row_id } };
  }
}

export function createD1Database(database: D1Database): Database {
  return {
    prepare: (sql) => new D1Statement(database.prepare(sql)),
    batch: (statements) => database.batch(statements.map((statement) => {
      if (!(statement instanceof D1Statement)) throw new TypeError("D1 batch received a statement from another adapter");
      return statement.statement;
    })),
  };
}
