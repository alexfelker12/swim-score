import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import type * as schema from "./schema"

/** A Drizzle database with our schema, whatever driver sits underneath. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>
