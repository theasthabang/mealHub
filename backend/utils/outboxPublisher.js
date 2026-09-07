import PaymentOutbox from "../models/paymentOutbox.model.js"
import pgPool from "./postgres.js"
import logger from "./logger.js"

// After this many failed attempts, stop auto-retrying and mark it "failed"
// instead of "pending" — the same "give up automatically retrying and flag
// it for a human" idea a dead letter queue captures, just without a separate
// queue system backing it (this app doesn't have one).
const MAX_ATTEMPTS = 10

// Publishes ONE outbox entry to Postgres. Called two different ways: once,
// eagerly, right after the entry is created (for low latency in the common
// case), and again later by the sweep below for anything that eager attempt
// missed — a crash before it could run, Postgres being briefly unreachable,
// etc. Idempotent by design: razorpay_payment_id is UNIQUE in Postgres with
// ON CONFLICT DO NOTHING, so calling this twice for the same entry (the
// eager attempt AND a sweep both catching it) can never create a duplicate
// payment row.
export const publishOutboxEntry = async (entry) => {
    try {
        await pgPool.query(
            `INSERT INTO payments (mongo_order_id, razorpay_payment_id, razorpay_order_id, amount, currency, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (razorpay_payment_id) DO NOTHING`,
            [String(entry.mongoOrderId), entry.razorpayPaymentId, entry.razorpayOrderId || null, entry.amount, entry.currency, "captured"]
        )
        entry.status = "published"
        entry.publishedAt = new Date()
        await entry.save()
        return true
    } catch (error) {
        entry.attempts += 1
        entry.lastError = error.message
        entry.status = entry.attempts >= MAX_ATTEMPTS ? "failed" : "pending"
        await entry.save()
        logger.error({ outboxId: entry._id, attempts: entry.attempts, err: error.message }, "Outbox publish attempt failed")
        return false
    }
}

// The durable safety net. This is what actually makes the guarantee hold:
// even in the worst case — the process dies the instant after the MongoDB
// transaction commits, before the eager attempt below ever runs — the entry
// survives in MongoDB (that write already committed), and this sweep will
// find and publish it the next time it runs, whenever the server's back up.
// Capped at 50 per sweep so one huge backlog can't make a single sweep run
// forever and block the next one from starting on schedule.
export const sweepPendingOutboxEntries = async () => {
    const pendingEntries = await PaymentOutbox.find({ status: "pending" }).limit(50)
    for (const entry of pendingEntries) {
        await publishOutboxEntry(entry)
    }
    if (pendingEntries.length > 0) {
        logger.info(`Outbox sweep processed ${pendingEntries.length} pending entr${pendingEntries.length === 1 ? "y" : "ies"}`)
    }
}

let sweepIntervalHandle = null

export const startOutboxSweeper = (intervalMs = 30000) => {
    sweepIntervalHandle = setInterval(() => {
        sweepPendingOutboxEntries().catch(err => logger.error({ err }, "Outbox sweep crashed"))
    }, intervalMs)
    logger.info(`Outbox sweeper started (every ${intervalMs / 1000}s)`)
}

export const stopOutboxSweeper = () => {
    if (sweepIntervalHandle) clearInterval(sweepIntervalHandle)
}