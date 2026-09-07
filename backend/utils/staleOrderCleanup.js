import Order from "../models/order.model.js"
import logger from "./logger.js"

// FIX (abandoned-order cleanup): an online order is created in MongoDB BEFORE
// Razorpay's popup even opens (see placeOrder) — payment only flips to true
// afterward, via verifyPayment. Any online attempt that never completes
// (closed popup, failed card, network drop) leaves behind a real order stuck
// forever at payment:false, cluttering the customer's order history with
// something that was never actually placed in any meaningful sense.
//
// Safe to auto-cancel these with no refund logic at all: payment was never
// captured, so there's nothing to refund, and the owner was never even
// notified about them (placeOrder's online branch doesn't emit 'newOrder' —
// that only happens in the COD branch and in verifyPayment after real
// payment success) — so cancelling them affects nobody but tidies up the
// customer's own view.
const STALE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

export const cleanupStaleOnlineOrders = async () => {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS)

    // Matches orders where at least one shopOrder is still "pending" — the
    // per-shopOrder loop below only touches ones that actually are, so a
    // multi-shop order where one leg was already individually cancelled
    // elsewhere isn't double-touched.
    const staleOrders = await Order.find({
        paymentMethod: "online",
        payment: false,
        createdAt: { $lt: cutoff },
        "shopOrders.status": "pending"
    })

    let cleanedCount = 0
    for (const order of staleOrders) {
        let changed = false
        order.shopOrders.forEach(shopOrder => {
            if (shopOrder.status === "pending") {
                shopOrder.status = "cancelled"
                shopOrder.cancelledAt = new Date()
                shopOrder.cancelReason = "Payment was not completed in time"
                changed = true
            }
        })
        if (changed) {
            await order.save()
            cleanedCount++
        }
    }

    if (cleanedCount > 0) {
        logger.info(`Stale order cleanup: auto-cancelled ${cleanedCount} abandoned unpaid online order(s)`)
    }
}

let cleanupIntervalHandle = null

export const startStaleOrderCleanup = (intervalMs = 5 * 60 * 1000) => {
    cleanupIntervalHandle = setInterval(() => {
        cleanupStaleOnlineOrders().catch(err => logger.error({ err }, "Stale order cleanup crashed"))
    }, intervalMs)
    logger.info(`Stale order cleanup started (checks every ${intervalMs / 60000}min, cancels anything unpaid after ${STALE_THRESHOLD_MS / 60000}min)`)
}

export const stopStaleOrderCleanup = () => {
    if (cleanupIntervalHandle) clearInterval(cleanupIntervalHandle)
}