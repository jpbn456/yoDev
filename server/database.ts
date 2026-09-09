export type DatabaseValue = null | string | number | bigint | boolean | Uint8Array | ArrayBuffer;

export type RunMeta = {
  changes?: number;
  last_row_id?: number | string | bigint;
};

export type RunResult = { meta: RunMeta };

export interface PreparedStatement {
  bind(...values: DatabaseValue[]): PreparedStatement;
  first<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T | null>;
  all<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<RunResult>;
}

export interface Database {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown>;
}
