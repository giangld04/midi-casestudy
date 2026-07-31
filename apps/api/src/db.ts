// Single shared Drizzle client for the API process.
// createDb() reads DATABASE_URL and opens a pooled connection on first import.
import { createDb } from "@ama-midi/db";

export const db = createDb();

/** Drizzle client type */
export type Db = typeof db;

/** Transaction handle type, extracted from db.transaction's callback param */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Accepts either the pooled client or an open transaction */
export type DbOrTx = Db | Tx;
