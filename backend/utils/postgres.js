import pg from "pg"
const { Pool } = pg

// A separate database, deliberately kept independent from MongoDB. This pool
// is used for exactly one thing: the payments/refunds ledger. It does not
// know about Users, Shops, Orders, or anything else in the main app — those
// stay in MongoDB, where the transactional guarantees this project already
// relies on (the atomic accept-order claim, the price-integrity checks in
// placeOrder) actually work. Payments/refunds are the one part of this
// system's data that's genuinely safe to keep elsewhere: a payment is
// recorded once, after Razorpay has already independently confirmed it, and
// a refund is a decoupled follow-up action — neither needs to share a
// transaction with anything in the Order document itself.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase (and most hosted Postgres) require SSL; rejectUnauthorized:false
    // is the standard setting for connecting to a managed provider's
    // certificate without needing to install their CA chain locally.
    ssl: { rejectUnauthorized: false }
})

pool.on("error", (err) => {
    // A Postgres hiccup shouldn't be able to crash the whole backend — this
    // is a completely separate, optional-in-practice subsystem (MongoDB
    // remains the source of truth for whether an order is cancelled at all;
    // Postgres only records the resulting financial ledger entry).
    console.error("Postgres pool error:", err.message)
})

export default pool