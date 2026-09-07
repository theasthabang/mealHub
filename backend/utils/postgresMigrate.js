import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import pgPool from "./postgres.js"
import logger from "./logger.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// FIX (the exact bug from tonight): previously, creating the payments/refunds
// tables was a manual, one-time step — paste the schema into Supabase's SQL
// Editor yourself. That step is easy to forget, and forgetting it produces no
// error until someone actually tries to use the tables, at which point it
// surfaces as a confusing "relation does not exist" failure deep inside a
// refund attempt — exactly what happened here.
//
// This runs the same schema SQL automatically, every time the server starts.
// It's safe to run on every single restart, forever: every statement in the
// schema file uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS, so
// re-running it against a database that already has the tables does nothing —
// there's no "already applied" tracking needed for something this simple.
//
// Reads the .sql file rather than duplicating the SQL as a JS string, so the
// schema file stays the single source of truth — no risk of this function's
// copy silently drifting from the real schema.
export const runPostgresMigrations = async () => {
    const schemaPath = path.join(__dirname, "..", "db", "payments_refunds_schema.sql")

    if (!fs.existsSync(schemaPath)) {
        logger.warn(`Postgres migration file not found at ${schemaPath} — skipping. Payments/refunds tables will not be auto-created.`)
        return
    }

    const schemaSql = fs.readFileSync(schemaPath, "utf8")

    try {
        await pgPool.query(schemaSql)
        logger.info("Postgres schema migration applied (payments/refunds tables ready).")
    } catch (error) {
        // Deliberately NOT crashing the server over this — Postgres is a
        // secondary system here (see postgres.js's own comment on this same
        // principle). If this fails, payments/refunds-related features won't
        // work correctly, but MongoDB-based order/delivery flows should keep
        // running regardless. Logged clearly so it's visible, not silent.
        logger.error({ err: error }, "Postgres migration failed — payments/refunds features may not work until this is fixed.")
    }
}