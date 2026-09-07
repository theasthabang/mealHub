// One-time backfill: finds every MongoDB order that was paid online BEFORE
// the payments/refunds ledger existed, and creates a matching row in Postgres
// for each one. Run this ONCE, after applying the payments/refunds schema and
// the postgres.js/order.controllers.js changes, to close the gap where old
// orders have no payments row to reference on cancellation.
//
// Safe to run more than once — every insert uses ON CONFLICT (razorpay_payment_id)
// DO NOTHING, so re-running this just skips orders already backfilled.
//
// Run from the backend folder with: node scripts/backfillPayments.js

import mongoose from "mongoose"
import dotenv from "dotenv"
import Order from "../models/order.model.js"
import pgPool from "../utils/postgres.js"

dotenv.config()

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URL)
    console.log("Connected to MongoDB")

    // Only orders that were actually paid online — COD orders never had a
    // Razorpay payment to record in the first place, so there's nothing to
    // backfill for them.
    const paidOnlineOrders = await Order.find({
        paymentMethod: "online",
        payment: true,
        razorpayPaymentId: { $exists: true, $ne: "" }
    })

    console.log(`Found ${paidOnlineOrders.length} online-paid orders to check.`)

    let inserted = 0
    let skipped = 0
    let failed = 0

    for (const order of paidOnlineOrders) {
        try {
            const result = await pgPool.query(
                `INSERT INTO payments (mongo_order_id, razorpay_payment_id, razorpay_order_id, amount, currency, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (razorpay_payment_id) DO NOTHING
                 RETURNING id`,
                [
                    String(order._id),
                    order.razorpayPaymentId,
                    order.razorpayOrderId || null,
                    order.totalAmount,
                    "INR",
                    "captured"
                ]
            )

            if (result.rows.length > 0) {
                inserted++
            } else {
                // ON CONFLICT hit — this order was already backfilled (or,
                // less likely, paid after the ledger went live and somehow
                // wasn't already recorded by verifyPayment).
                skipped++
            }
        } catch (error) {
            failed++
            console.error(`Failed to backfill order ${order._id}:`, error.message)
        }
    }

    console.log(`\nDone. Inserted: ${inserted}, already present: ${skipped}, failed: ${failed}`)

    await mongoose.disconnect()
    await pgPool.end()
}

run().catch((err) => {
    console.error("Backfill script crashed:", err)
    process.exit(1)
})