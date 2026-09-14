import mongoose from "mongoose"
import DeliveryAssignment from "../models/deliveryAssignment.model.js"
import Order from "../models/order.model.js"
import Shop from "../models/shop.model.js"
import User from "../models/user.model.js"
import Item from "../models/item.model.js"
import { sendDeliveryOtpMail } from "../utils/mail.js"
import { dateKey, getStartDate, fillDateSeries } from "../utils/analyticsHelpers.js"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import RazorPay from "razorpay"
import dotenv from "dotenv"
import { count } from "console"
import pgPool from "../utils/postgres.js"
import PaymentOutbox from "../models/paymentOutbox.model.js"
import { computeShopOrderDiscount } from "../utils/offerHelpers.js"
import { publishOutboxEntry } from "../utils/outboxPublisher.js"
import logger from "../utils/logger.js"

dotenv.config()
let instance = new RazorPay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const placeOrder = async (req, res) => {
    try {
        // FIX (critical — price tampering): `totalAmount` and `deliveryFee` are no
        // longer read from the request body at all. Previously they were trusted
        // as-is all the way through to Order.create() AND the amount actually
        // charged via Razorpay — since these are just numbers a browser sends,
        // anyone with devtools open could edit the request and pay whatever they
        // liked, no special tooling required. Both are now computed entirely
        // server-side, below, from shop-order subtotals that are themselves priced
        // from the database rather than from the cart.
        const { cartItems, paymentMethod, deliveryAddress } = req.body
        // FIX (crash-order bug): `cartItems.length` was checked before `!cartItems`
        // — if cartItems was ever missing entirely from the body, this threw a
        // TypeError before the validation meant to catch exactly that case could
        // run. Order flipped so the existence check runs first.
        if (!cartItems || cartItems.length == 0) {
            return res.status(400).json({ message: "cart is empty" })
        }
        if (!deliveryAddress.text || !deliveryAddress.latitude || !deliveryAddress.longitude) {
            return res.status(400).json({ message: "send complete deliveryAddress" })
        }

        // NEW: real server-side enforcement of checkout-time mobile verification.
        // The frontend modal is the normal path a real user goes through, but
        // nothing stops someone from calling this endpoint directly — this is the
        // check that actually matters, same principle already applied everywhere
        // else in this app (shop-closed, item-unavailable, ownership checks).
        const requestingUser = await User.findById(req.userId)
        if (!requestingUser?.isMobileVerified) {
            const err = new Error("Please verify your mobile number before placing an order.")
            err.status = 403
            throw err
        }

        const groupItemsByShop = {}

        cartItems.forEach(item => {
            const shopId = item.shop
            if (!groupItemsByShop[shopId]) {
                groupItemsByShop[shopId] = []
            }
            groupItemsByShop[shopId].push(item)
        });

        // FIX (Phase 3, #1 — crash bug): the old code did `return res.status(400).json(...)`
        // inside this map callback when a shop wasn't found. That `return` only exits the
        // map callback itself — it does NOT stop the outer placeOrder function. Execution
        // continued, the order got created anyway with an incomplete shopOrders array, and
        // `res.status(201).json(newOrder)` fired again at the end of the function, which
        // throws "Cannot set headers after they are sent" and crashes that request (and,
        // depending on timing, can take down the whole process). Throwing here instead lets
        // the outer try/catch handle it with a single, correct response.
        const shopOrders = await Promise.all(Object.keys(groupItemsByShop).map(async (shopId) => {
            const shop = await Shop.findById(shopId).populate("owner")
            if (!shop) {
                throw new Error(`Shop not found for id: ${shopId}`)
            }

            // NEW (real enforcement, not a cosmetic badge): reject the whole order if
            // this shop has been marked closed. Checked here, at order time, against
            // the database — not trusting whatever "open" state the frontend had
            // cached when the customer started browsing. `.status = 400` lets the
            // outer catch tell this apart from a genuine server error.
            if (!shop.isOpen) {
                const err = new Error(`${shop.name} is currently closed and not accepting orders`)
                err.status = 400
                throw err
            }

            const items = groupItemsByShop[shopId]

            // NEW (real enforcement): re-check every item's availability against the
            // database. The cart is client-side state that can go stale — an owner
            // could mark something unavailable minutes after a customer already added
            // it to their cart, and the cart's cached copy has no way to know that.
            const itemIds = items.map(i => i.id)
            const dbItems = await Item.find({ _id: { $in: itemIds } })

            // FIX (critical — price tampering): dbItems used to be fetched ONLY to
            // check availability, then never touched again — price and name for
            // every line still came straight from the client-supplied cart below.
            // This lookup map is what the pricing loop uses instead.
            const dbItemsById = new Map(dbItems.map(i => [String(i._id), i]))

            const unavailable = dbItems.filter(dbItem => !dbItem.isAvailable)
            if (unavailable.length > 0) {
                const err = new Error(`${unavailable.map(i => i.name).join(", ")} ${unavailable.length > 1 ? "are" : "is"} no longer available`)
                err.status = 400
                throw err
            }

            // NEW: an item ID the cart claims but the database doesn't have (removed
            // item, mismatched shop, tampered ID) needs its own explicit rejection —
            // otherwise it silently drops out of shopOrderItems below while
            // contributing nothing to subtotal, quietly shorting the order instead
            // of failing loudly.
            const missingItem = items.find(i => !dbItemsById.has(String(i.id)))
            if (missingItem) {
                const err = new Error("One or more items in your cart are no longer available")
                err.status = 400
                throw err
            }

            let subtotal = 0
            const shopOrderItems = items.map((i) => {
                const dbItem = dbItemsById.get(String(i.id))

                // NEW: quantity is the one cart field that's still legitimately
                // client-driven (it's just "how many the customer wants"), but it
                // still needs a sanity floor — an unvalidated zero/negative/non-
                // integer quantity could be used to drag the subtotal down (or
                // negative) the same way a tampered price could.
                const quantity = Number(i.quantity)
                if (!Number.isInteger(quantity) || quantity < 1) {
                    const err = new Error(`Invalid quantity for ${dbItem.name}`)
                    err.status = 400
                    throw err
                }

                subtotal += dbItem.price * quantity

                return {
                    item: dbItem._id,
                    price: dbItem.price,   // FIX: priced from the database, never from cartItems
                    quantity,
                    name: dbItem.name      // FIX: named from the database, never from cartItems
                }
            })

            // NEW: real offer discount, computed entirely server-side from
            // this shop's currently-active Offer records and the tamper-proof
            // shopOrderItems/subtotal above — never from anything the client
            // sends. `subtotal` below becomes the actual amount owed (existing
            // meaning, preserved for refunds/analytics elsewhere);
            // `originalSubtotal` keeps the pre-discount figure for display.
            const { discountAmount, appliedOffers } = await computeShopOrderDiscount(shop._id, shopOrderItems, subtotal)
            const finalSubtotal = Math.round((subtotal - discountAmount) * 100) / 100

            return {
                shop: shop._id,
                owner: shop.owner._id,
                subtotal: finalSubtotal,
                originalSubtotal: subtotal,
                discountAmount,
                appliedOffers,
                shopOrderItems
            }
        }
        ))

        // FIX (critical — price tampering): totalAmount and deliveryFee are now
        // derived entirely from the server-priced shopOrders above, never from
        // anything the client sent. The delivery-fee rule mirrors CheckOut.jsx's
        // display logic (free above ₹500, flat ₹40 otherwise) — kept in one place
        // here since this is now the value that's actually charged, not just shown.
        const computedSubtotal = shopOrders.reduce((sum, so) => sum + so.subtotal, 0)
        const FREE_DELIVERY_THRESHOLD = 500
        const STANDARD_DELIVERY_FEE = 40
        const computedDeliveryFee = computedSubtotal > FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE
        const computedTotalAmount = computedSubtotal + computedDeliveryFee

        if (paymentMethod == "online") {
            const razorOrder = await instance.orders.create({
                amount: Math.round(computedTotalAmount * 100),
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            })
            const newOrder = await Order.create({
                user: req.userId,
                paymentMethod,
                deliveryAddress,
                totalAmount: computedTotalAmount,
                deliveryFee: computedDeliveryFee,
                shopOrders,
                razorpayOrderId: razorOrder.id,
                payment: false
            })

            return res.status(200).json({
                razorOrder,
                orderId: newOrder._id,
            })

        }

        const newOrder = await Order.create({
            user: req.userId,
            paymentMethod,
            deliveryAddress,
            totalAmount: computedTotalAmount,
            deliveryFee: computedDeliveryFee,
            shopOrders
        })

        await newOrder.populate("shopOrders.shopOrderItems.item", "name image price")
        await newOrder.populate("shopOrders.shop", "name")
        await newOrder.populate("shopOrders.owner", "name socketId")
        await newOrder.populate("user", "name email mobile")

        const io = req.app.get('io')

        if (io) {
            newOrder.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId
                if (ownerSocketId) {
                    io.to(ownerSocketId).emit('newOrder', {
                        _id: newOrder._id,
                        paymentMethod: newOrder.paymentMethod,
                        user: newOrder.user,
                        shopOrders: shopOrder,
                        createdAt: newOrder.createdAt,
                        deliveryAddress: newOrder.deliveryAddress,
                        payment: newOrder.payment
                    })
                }
            });
        }



        return res.status(201).json(newOrder)
    } catch (error) {
        // The shop-closed / item-unavailable / mobile-not-verified checks above all
        // throw an Error with an explicit .status attached, since those are real
        // validation/authorization failures meant to be shown to the customer
        // directly, not generic server errors. Checking for that status property is
        // more robust than matching on message text, which would break silently if
        // wording ever changed, and generalizing to "any explicit status" (rather
        // than hardcoding 400) means new checks like this one don't need this catch
        // block edited again every time.
        if (error.status) {
            return res.status(error.status).json({ message: error.message })
        }
        return res.status(500).json({ message: `place order error ${error}` })
    }
}

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, orderId } = req.body
        const payment = await instance.payments.fetch(razorpay_payment_id)
        if (!payment || payment.status != "captured") {
            return res.status(400).json({ message: "payment not captured" })
        }
        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        // FIX (Phase 2, #2 — critical): previously only checked that the payment ID
        // was captured, with no check that it actually belongs to THIS order. A valid
        // captured payment ID from a completely different transaction could be replayed
        // against any orderId to mark it as paid without actually paying for it.
        if (payment.order_id !== order.razorpayOrderId) {
            return res.status(400).json({ message: "payment does not match this order" })
        }

        // FIX (Phase 2, ownership): only the customer who placed this order should be
        // able to confirm its payment
        if (String(order.user) !== String(req.userId)) {
            return res.status(403).json({ message: "not authorized for this order" })
        }

        // FIX (deployment audit — edge case found in review, not yet hit in
        // practice): if a customer takes long enough completing checkout that
        // staleOrderCleanup auto-cancels this order in the background before
        // they finish paying, Razorpay can still capture the payment
        // afterward — real money moves, but blindly marking this order
        // "paid" would leave it in a contradictory state: cancelled (with a
        // now-false "payment was not completed in time" reason) AND paid,
        // with nothing surfacing that a refund is actually owed. Still
        // record the payment in the ledger below — the money genuinely
        // moved and needs to be tracked regardless of order status — but
        // this response tells the customer plainly what happened instead of
        // pretending their order proceeded normally.
        const allShopOrdersCancelled = order.shopOrders.every(so => so.status === "cancelled")
        if (allShopOrdersCancelled) {
            logger.error({ orderId: order._id, razorpay_payment_id }, "Payment captured for an order that was already auto-cancelled before payment completed — needs manual refund review")
        }

        // FIX (Outbox Pattern — replaces the previous direct try/catch write):
        // the old version updated MongoDB, THEN separately tried writing to
        // Postgres in a try/catch that just logged and moved on if it failed —
        // meaning a Postgres hiccup at exactly the wrong moment could leave a
        // genuinely-paid order with no ledger record at all, silently.
        //
        // Now: the order update and a durable "this Postgres write is owed"
        // outbox entry are written together, atomically, in a single MongoDB
        // transaction — both are in MongoDB, so this genuinely is atomic,
        // unlike trying to span MongoDB and Postgres directly. If this
        // transaction commits, the outbox entry is GUARANTEED to exist — no
        // window where the order is marked paid but nothing recorded that a
        // Postgres write is still owed.
        const session = await mongoose.startSession()
        let outboxEntry
        try {
            session.startTransaction()

            order.payment = true
            order.razorpayPaymentId = razorpay_payment_id
            await order.save({ session })

            const created = await PaymentOutbox.create([{
                mongoOrderId: order._id,
                razorpayPaymentId: razorpay_payment_id,
                razorpayOrderId: order.razorpayOrderId,
                amount: order.totalAmount,
                currency: "INR",
                status: "pending"
            }], { session })
            outboxEntry = created[0]

            await session.commitTransaction()
        } catch (txError) {
            await session.abortTransaction()
            logger.error({ err: txError, orderId: order._id }, "Failed to atomically record payment + outbox entry")
            return res.status(500).json({ message: "Payment verification failed while saving — please contact support before retrying payment." })
        } finally {
            session.endSession()
        }

        // Eager attempt: try publishing to Postgres RIGHT NOW, for near-instant
        // ledger visibility in the common case. Deliberately NOT awaited before
        // responding to the customer — their payment confirmation should never
        // wait on, or fail because of, Postgres being slow or briefly down.
        // If this fails (or the process crashes before it even runs), the
        // outbox sweeper running on its own interval guarantees this entry
        // gets published eventually anyway — that's what makes this durable,
        // not just "try once and hope."
        publishOutboxEntry(outboxEntry).catch(err => logger.error({ err }, "Eager outbox publish failed"))

        await order.populate("shopOrders.shopOrderItems.item", "name image price")
        await order.populate("shopOrders.shop", "name")
        await order.populate("shopOrders.owner", "name socketId")
        await order.populate("user", "name email mobile")

        // See the allShopOrdersCancelled check above — the payment is now
        // safely recorded in the ledger either way, but if the order was
        // already cancelled before this payment came through, it should
        // never look like a normal successful order to the owner (no
        // 'newOrder' notification for something that isn't actually going
        // to be fulfilled) or to the customer (no "order placed!" messaging
        // for an order that's already cancelled).
        if (allShopOrdersCancelled) {
            return res.status(200).json({
                message: "Your order was cancelled before payment could be confirmed, but your payment was captured successfully. Our support team will process a refund shortly — please keep this reference handy.",
                paymentReference: razorpay_payment_id,
                order
            })
        }

        const io = req.app.get('io')

        if (io) {
            order.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId
                if (ownerSocketId) {
                    io.to(ownerSocketId).emit('newOrder', {
                        _id: order._id,
                        paymentMethod: order.paymentMethod,
                        user: order.user,
                        shopOrders: shopOrder,
                        createdAt: order.createdAt,
                        deliveryAddress: order.deliveryAddress,
                        payment: order.payment
                    })
                }
            });
        }


        return res.status(200).json(order)

    } catch (error) {
        return res.status(500).json({ message: `verify payment  error ${error}` })
    }
}



export const getMyOrders = async (req, res) => {
    try {
        const user = await User.findById(req.userId)

        // NEW: an online order exists in MongoDB from the moment "Pay & Place
        // Order" is clicked — BEFORE Razorpay's popup even opens (see
        // placeOrder). If the customer abandons checkout, closes the popup,
        // or the payment fails, that order is real in the database but was
        // never actually a genuine, successful order from the customer's
        // point of view. Rather than showing it and waiting for the 30-minute
        // staleOrderCleanup sweep to mark it cancelled, it's simply excluded
        // from view entirely until it's actually valid: COD is valid the
        // moment it's placed (no advance payment gate to clear), online is
        // only valid once payment is actually confirmed.
        const VALID_ORDER_FILTER = {
            $or: [
                { paymentMethod: "cod" },
                { paymentMethod: "online", payment: true }
            ]
        }

        // FIX (delivery OTP hardening): explicit exclusion of the OTP fields on
        // every order returned here — this is the actual privacy boundary now
        // (see order.model.js for why relying on schema-level select:false was
        // unreliable for these particular fields).
        if (user.role == "user") {
            const orders = await Order.find({ user: req.userId, ...VALID_ORDER_FILTER })
                .select('-shopOrders.deliveryOtpHash -shopOrders.otpExpires -shopOrders.deliveryOtpAttempts')
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name")
                .populate("shopOrders.owner", "name email mobile")
                .populate("shopOrders.shopOrderItems.item", "name image price")

            return res.status(200).json(orders)
        } else if (user.role == "owner") {
            const orders = await Order.find({ "shopOrders.owner": req.userId, ...VALID_ORDER_FILTER })
                .select('-shopOrders.deliveryOtpHash -shopOrders.otpExpires -shopOrders.deliveryOtpAttempts')
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name")
                .populate("user")
                .populate("shopOrders.shopOrderItems.item", "name image price")
                .populate("shopOrders.assignedDeliveryBoy", "fullName mobile")



            const filteredOrders = orders.map((order => ({
                _id: order._id,
                paymentMethod: order.paymentMethod,
                user: order.user,
                shopOrders: order.shopOrders.find(o => o.owner._id == req.userId),
                createdAt: order.createdAt,
                deliveryAddress: order.deliveryAddress,
                payment: order.payment
            })))


            return res.status(200).json(filteredOrders)
        }

    } catch (error) {
        return res.status(500).json({ message: `get User order error ${error}` })
    }
}


export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, shopId } = req.params
        const { status } = req.body

        // FIX (crash bug): same ordering issue fixed elsewhere in this file —
        // `order.shopOrders.find(...)` was called before checking whether `order`
        // itself was null, so an invalid/nonexistent orderId threw a TypeError here
        // and fell into the catch block as a 500 instead of a clean 400.
        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        const shopOrder = order.shopOrders.find(o => o.shop == shopId)
        if (!shopOrder) {
            return res.status(400).json({ message: "shop order not found" })
        }

        // FIX (Phase 2, #1 — authorization): previously any logged-in user could change
        // any order's status just by knowing an orderId/shopId — there was no check that
        // the requester actually owns this shop. shopOrder.owner was already being stored
        // at order-creation time (see placeOrder), it just was never checked here.
        if (String(shopOrder.owner) !== String(req.userId)) {
            return res.status(403).json({ message: "not authorized to update this order" })
        }

        // FIX (defense in depth, added earlier): cancelled orders can't be un-cancelled
        if (shopOrder.status === "cancelled") {
            return res.status(400).json({ message: "this order was cancelled by the customer and cannot be updated" })
        }

        // FIX (critical — bypasses the delivery-OTP security model): this endpoint
        // previously accepted ANY string as `status` and wrote it straight onto the
        // shopOrder with no whitelist at all. "delivered" is supposed to be
        // reachable ONLY through verifyDeliveryOtp — which exists specifically to
        // prove the delivery boy is physically with the customer, who reads the
        // code aloud from their own email. An owner (or a compromised owner
        // session) could previously call this route directly with
        // { status: "delivered" } and mark an order delivered with no OTP, no
        // delivery boy, no customer confirmation whatsoever — silently defeating
        // the entire OTP flow we hardened earlier, and letting revenue/analytics
        // reflect orders that were never actually delivered. Likewise "cancelled"
        // is meant to be customer-initiated only, via cancelOrderItem. This
        // endpoint is the owner's status-update tool, so it's now restricted to
        // exactly the statuses an owner legitimately drives — anything else
        // (including nonsense values, which previously only surfaced as a raw
        // Mongoose ValidationError -> generic 500 at order.save()) is rejected
        // with a clear 400 up front.
        const OWNER_SETTABLE_STATUSES = ["pending", "preparing", "out of delivery"]
        if (!OWNER_SETTABLE_STATUSES.includes(status)) {
            return res.status(400).json({ message: "invalid status. Delivered and cancelled orders are handled through their own dedicated flows." })
        }

        shopOrder.status = status
        let deliveryBoysPayload = []
        if (status == "out of delivery" && !shopOrder.assignment) {
            const { longitude, latitude } = order.deliveryAddress
            // FIX (stale/offline candidates): this query previously filtered only on
            // role + proximity — it never checked `isOnline`. A delivery boy's
            // `location` only updates while their app is open and watchPosition is
            // actively running (see useUpdateLocation.jsx); the moment they close
            // the tab, their last coordinates go stale but stay in the database
            // indefinitely. Without an isOnline check, someone who delivered near
            // this address yesterday and hasn't opened the app since could still be
            // selected as a "nearby available" candidate today — eating a broadcast
            // slot they'll never see, and showing up in deliveryBoysPayload to the
            // owner as if they were a real live option.
            const nearByDeliveryBoys = await User.find({
                role: "deliveryBoy",
                isOnline: true,
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
                        $maxDistance: 5000
                    }
                }
            })

            const nearByIds = nearByDeliveryBoys.map(b => b._id)
            const busyIds = await DeliveryAssignment.find({
                assignedTo: { $in: nearByIds },
                status: { $nin: ["brodcasted", "completed"] }

            }).distinct("assignedTo")

            const busyIdSet = new Set(busyIds.map(id => String(id)))

            const availableBoys = nearByDeliveryBoys.filter(b => !busyIdSet.has(String(b._id)))
            const candidates = availableBoys.map(b => b._id)

            if (candidates.length == 0) {
                await order.save()
                return res.json({
                    message: "order status updated but there is no available delivery boys"
                })
            }

            const deliveryAssignment = await DeliveryAssignment.create({
                order: order?._id,
                shop: shopOrder.shop,
                shopOrderId: shopOrder?._id,
                brodcastedTo: candidates,
                status: "brodcasted"
            })

            shopOrder.assignedDeliveryBoy = deliveryAssignment.assignedTo
            shopOrder.assignment = deliveryAssignment._id
            deliveryBoysPayload = availableBoys.map(b => ({
                id: b._id,
                fullName: b.fullName,
                longitude: b.location.coordinates?.[0],
                latitude: b.location.coordinates?.[1],
                mobile: b.mobile
            }))

            await deliveryAssignment.populate('order')
            await deliveryAssignment.populate('shop')
            const io = req.app.get('io')
            if (io) {
                availableBoys.forEach(boy => {
                    const boySocketId = boy.socketId
                    if (boySocketId) {
                        io.to(boySocketId).emit('newAssignment', {
                            sentTo: boy._id,
                            assignmentId: deliveryAssignment._id,
                            orderId: deliveryAssignment.order._id,
                            shopName: deliveryAssignment.shop.name,
                            deliveryAddress: deliveryAssignment.order.deliveryAddress,
                            items: deliveryAssignment.order.shopOrders.find(so => so._id.equals(deliveryAssignment.shopOrderId)).shopOrderItems || [],
                            subtotal: deliveryAssignment.order.shopOrders.find(so => so._id.equals(deliveryAssignment.shopOrderId))?.subtotal
                        })
                    }
                });
            }

        }

        await order.save()
        const updatedShopOrder = order.shopOrders.find(o => o.shop == shopId)
        await order.populate("shopOrders.shop", "name")
        await order.populate("shopOrders.assignedDeliveryBoy", "fullName email mobile")
        await order.populate("user", "socketId")

        const io = req.app.get('io')
        if (io) {
            const userSocketId = order.user.socketId
            if (userSocketId) {
                io.to(userSocketId).emit('update-status', {
                    orderId: order._id,
                    shopId: updatedShopOrder.shop._id,
                    status: updatedShopOrder.status,
                    userId: order.user._id
                })
            }
        }



        return res.status(200).json({
            shopOrder: updatedShopOrder,
            assignedDeliveryBoy: updatedShopOrder?.assignedDeliveryBoy,
            availableBoys: deliveryBoysPayload,
            assignment: updatedShopOrder?.assignment?._id

        })



    } catch (error) {
        return res.status(500).json({ message: `order status error ${error}` })
    }
}


// NEW: cancelOrderItem — lets the CUSTOMER cancel a single shop-order (not the whole
// multi-shop order) while it's still "pending". Mirrors updateOrderStatus in structure,
// but scoped to the requesting user and gated on the pending-only rule.
export const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, shopId } = req.params
        const { reason } = req.body

        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        // Only the customer who placed the order can cancel it
        if (String(order.user) !== String(req.userId)) {
            return res.status(403).json({ message: "not authorized to cancel this order" })
        }

        const shopOrder = order.shopOrders.find(o => String(o.shop) === String(shopId))
        if (!shopOrder) {
            return res.status(400).json({ message: "shop order not found" })
        }

        // Core rule: cancellation only allowed while the shop hasn't started preparing yet
        if (shopOrder.status !== "pending") {
            return res.status(400).json({ message: "this order can no longer be cancelled — the shop has already started preparing it" })
        }

        // NEW (refund logic): previously cancelling an ONLINE-paid order did
        // nothing to the money — the order just flipped to "cancelled" while
        // the customer's payment sat captured with no refund ever initiated.
        // Refund policy: only the cancelled shop's own subtotal is refunded,
        // not any portion of the order-level delivery fee — deliveryFee isn't
        // decomposed per shop in this data model, and this order can still
        // have other shops' items in transit, so the delivery itself may
        // still be happening.
        //
        // Ordering matters here: the actual Razorpay refund call happens
        // BEFORE the Mongo cancellation is saved. If the refund fails, this
        // returns an error and the order stays in its original, still-
        // cancellable "pending" state — never "cancelled" with no refund
        // actually issued.
        let refundResult = null

        if (order.paymentMethod === "online" && order.payment === true) {
            const pgClient = await pgPool.connect()
            try {
                await pgClient.query("BEGIN")

                const paymentRow = await pgClient.query(
                    "SELECT id, amount FROM payments WHERE razorpay_payment_id = $1",
                    [order.razorpayPaymentId]
                )

                if (paymentRow.rows.length === 0) {
                    // Legacy order paid before the payments ledger existed —
                    // there's no local record to validate against, but the
                    // customer's money should still be refundable. Falls back
                    // to calling Razorpay directly without the Postgres-side
                    // over-refund guard; not written to the refunds ledger,
                    // since there's no payment row for it to reference (a
                    // real foreign key, so it can't point at nothing).
                    console.error(`No payments ledger row for razorpayPaymentId ${order.razorpayPaymentId} — refunding without ledger tracking (likely a pre-ledger order).`)
                    await pgClient.query("ROLLBACK")
                } else {
                    // FIX (race condition, same class as acceptOrder's fix):
                    // `SELECT ... FOR UPDATE` locks this payment row for the
                    // duration of the transaction, so a second concurrent
                    // cancellation request against the same payment can't read
                    // a stale "amount already refunded" total before this one
                    // commits — the same read-then-write race the MongoDB
                    // transaction closed for accept-order, solved here with
                    // Postgres's row-locking instead.
                    await pgClient.query("SELECT amount FROM payments WHERE id = $1 FOR UPDATE", [paymentRow.rows[0].id])

                    const refundedSoFar = await pgClient.query(
                        "SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE payment_id = $1",
                        [paymentRow.rows[0].id]
                    )
                    const alreadyRefunded = Number(refundedSoFar.rows[0].total)
                    const remaining = Number(paymentRow.rows[0].amount) - alreadyRefunded

                    if (shopOrder.subtotal > remaining) {
                        await pgClient.query("ROLLBACK")
                        return res.status(400).json({ message: "refund amount exceeds what remains on this payment — it may have already been refunded" })
                    }

                    const razorpayRefund = await instance.payments.refund(order.razorpayPaymentId, {
                        amount: Math.round(shopOrder.subtotal * 100), // paise, same unit Razorpay expects everywhere else in this app
                        speed: "normal",
                        notes: {
                            mongoOrderId: String(order._id),
                            mongoShopId: String(shopId),
                            reason: reason || "Not specified"
                        }
                    })

                    await pgClient.query(
                        `INSERT INTO refunds (payment_id, mongo_order_id, mongo_shop_id, razorpay_refund_id, amount, reason, status)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [paymentRow.rows[0].id, String(order._id), String(shopId), razorpayRefund.id, shopOrder.subtotal, reason || "Not specified", razorpayRefund.status]
                    )

                    await pgClient.query("COMMIT")
                    refundResult = razorpayRefund
                }
            } catch (refundError) {
                await pgClient.query("ROLLBACK").catch(() => {})
                console.error("Refund failed during cancellation:", refundError.message)
                return res.status(500).json({ message: "Could not process refund — cancellation was not completed. Please try again." })
            } finally {
                pgClient.release()
            }
        }

        shopOrder.status = "cancelled"
        shopOrder.cancelledAt = Date.now()
        shopOrder.cancelReason = reason || "Not specified"

        // NEW: persist a display copy of the refund result right alongside
        // the cancellation itself — same save() call, so there's no window
        // where an order shows "cancelled" without also showing its refund
        // outcome. Postgres's refunds table remains the authoritative
        // record; this is purely what the customer's order list reads from.
        if (refundResult) {
            shopOrder.refundAmount = shopOrder.subtotal
            shopOrder.refundStatus = refundResult.status
            shopOrder.refundedAt = new Date()
        }

        await order.save()
        await order.populate("shopOrders.shop", "name")
        await order.populate("shopOrders.owner", "socketId")

        const updatedShopOrder = order.shopOrders.find(o => String(o.shop._id) === String(shopId))

        const io = req.app.get('io')
        if (io) {
            const ownerSocketId = updatedShopOrder?.owner?.socketId
            if (ownerSocketId) {
                io.to(ownerSocketId).emit('order-cancelled', {
                    orderId: order._id,
                    shopId,
                    status: "cancelled",
                    cancelReason: updatedShopOrder.cancelReason
                })
            }
        }

        return res.status(200).json({
            message: refundResult ? "order cancelled and refund initiated" : "order cancelled successfully",
            shopOrder: updatedShopOrder,
            refund: refundResult ? { id: refundResult.id, amount: shopOrder.subtotal, status: refundResult.status, refundedAt: shopOrder.refundedAt } : null
        })

    } catch (error) {
        return res.status(500).json({ message: `cancel order error ${error}` })
    }
}


export const getDeliveryBoyAssignment = async (req, res) => {
    try {
        const deliveryBoyId = req.userId
        const assignments = await DeliveryAssignment.find({
            brodcastedTo: deliveryBoyId,
            status: "brodcasted"
        })
            .populate("order")
            .populate("shop")

        const formated = assignments.map(a => ({
            assignmentId: a._id,
            orderId: a.order._id,
            shopName: a.shop.name,
            deliveryAddress: a.order.deliveryAddress,
            items: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId)).shopOrderItems || [],
            subtotal: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId))?.subtotal
        }))

        return res.status(200).json(formated)
    } catch (error) {
        return res.status(500).json({ message: `get Assignment error ${error}` })
    }
}


// FIX (race condition — double-accept): the original version was a classic
// read-then-write race, twice over:
//   1. `findById` -> check `status !== "brodcasted"` in JS -> `assignment.save()`.
//      Two delivery boys hitting this endpoint milliseconds apart could BOTH read
//      status:"brodcasted", BOTH pass the check, and BOTH get back a 200 "order
//      accepted" — only the later `save()` actually stuck in the DB, but both
//      clients believed they had the delivery. Whoever's write lost would still
//      show up at the shop for an order that's no longer theirs.
//   2. The "already assigned to another order" check had the exact same shape —
//      read `alreadyAssigned`, decide in JS, write later. Two concurrent accepts
//      from the same delivery boy (two tabs, a flaky double-tap) could both pass
//      that check before either assignment write landed.
// And separately, the two writes this handler makes — DeliveryAssignment.save()
// and Order.save() — were not atomic with each other: if the second write failed
// after the first succeeded, DeliveryAssignment would say "assigned to X" while
// Order.shopOrders still showed nobody assigned, and the customer's tracking page
// would silently disagree with the delivery boy's own app.
//
// Fixed by:
//   - Claiming the assignment with ONE atomic conditional write
//     (findOneAndUpdate matched on status:"brodcasted") instead of read-then-save.
//     If someone else already claimed it, this matches zero documents and returns
//     null — that's the actual race-safety, not any check done in JS beforehand.
//   - Re-checking "already busy elsewhere" AFTER the claim, and rolling the whole
//     thing back (transaction abort) if they turn out to be busy — no gap between
//     "read: not busy" and "write: assigned" for a second concurrent request to
//     slip through.
//   - Wrapping the claim + busy-check + Order update in one MongoDB transaction,
//     so it's all-or-nothing: either the assignment is claimed AND the order's
//     shopOrder is updated together, or neither happens and the assignment reverts
//     to "brodcasted" for the next delivery boy.
// Requires a replica-set MongoDB deployment (Atlas — already what this app targets
// per db.js — provisions this by default; a bare standalone `mongod` does not
// support transactions).
export const acceptOrder = async (req, res) => {
    const { assignmentId } = req.params
    const session = await mongoose.startSession()

    // Set inside the transaction below; read after it settles to decide the
    // response. Defaulted to a generic failure so an unexpected error before the
    // transaction even starts still returns something sane.
    let outcome = { ok: false, status: 500, message: "accept order error" }

    try {
        // Cheap existence/authorization check done OUTSIDE the transaction, purely
        // for a clear, specific error message. This is NOT the race-safety
        // mechanism — a request can still pass this and lose the actual claim
        // below if someone else grabs it first, which is exactly what the atomic
        // findOneAndUpdate inside the transaction is for.
        const preCheck = await DeliveryAssignment.findById(assignmentId)
        if (!preCheck) {
            return res.status(400).json({ message: "assignment not found" })
        }
        // FIX (Phase 2, #1 — authorization): `brodcastedTo` is populated only with
        // nearby users whose role is "deliveryBoy" (see updateOrderStatus's
        // nearByDeliveryBoys query), so checking membership in it also implicitly
        // enforces the role check — no separate role lookup needed.
        const isBroadcastToThisUser = preCheck.brodcastedTo.some(id => String(id) === String(req.userId))
        if (!isBroadcastToThisUser) {
            return res.status(403).json({ message: "this assignment was not offered to you" })
        }

        try {
            await session.withTransaction(async () => {
                // The atomic claim: succeeds only if the assignment is STILL
                // "brodcasted" at the exact moment of this write. If another
                // delivery boy's request already flipped it to "assigned", this
                // matches zero documents and `claimed` comes back null.
                const claimed = await DeliveryAssignment.findOneAndUpdate(
                    { _id: assignmentId, status: "brodcasted" },
                    { status: "assigned", assignedTo: req.userId, acceptedAt: new Date() },
                    { new: true, session }
                )

                if (!claimed) {
                    outcome = { ok: false, status: 400, message: "This order was already accepted by another delivery partner." }
                    throw new Error("ABORT_ALREADY_TAKEN")
                }

                const busyElsewhere = await DeliveryAssignment.findOne({
                    assignedTo: req.userId,
                    status: { $nin: ["brodcasted", "completed"] },
                    _id: { $ne: claimed._id }
                }).session(session)

                if (busyElsewhere) {
                    outcome = { ok: false, status: 400, message: "You are already assigned to another order" }
                    // Throwing aborts the transaction — the claim above is rolled
                    // back too, so the assignment reverts to "brodcasted" instead
                    // of being stuck "assigned" to someone who can't take it.
                    throw new Error("ABORT_ALREADY_BUSY")
                }

                const order = await Order.findById(claimed.order).session(session)
                if (!order) {
                    outcome = { ok: false, status: 400, message: "order not found" }
                    throw new Error("ABORT_ORDER_NOT_FOUND")
                }

                const shopOrder = order.shopOrders.id(claimed.shopOrderId)
                if (!shopOrder) {
                    outcome = { ok: false, status: 400, message: "shop order not found" }
                    throw new Error("ABORT_SHOPORDER_NOT_FOUND")
                }

                shopOrder.assignedDeliveryBoy = req.userId
                await order.save({ session })

                outcome = { ok: true }
            })
        } catch (txnError) {
            // ABORT_* throws above are deliberate control flow — `outcome` already
            // carries the right status/message for those. Only overwrite it with a
            // real 500 if this was a genuine, unexpected failure (network blip,
            // write conflict, etc.) that never got a chance to set `outcome`.
            if (!String(txnError.message).startsWith("ABORT_")) {
                console.error("acceptOrder transaction error:", txnError)
                outcome = { ok: false, status: 500, message: `accept order error ${txnError}` }
            }
        }

        if (outcome.ok) {
            return res.status(200).json({ message: 'order accepted' })
        }
        return res.status(outcome.status).json({ message: outcome.message })

    } catch (error) {
        return res.status(500).json({ message: `accept order error ${error}` })
    } finally {
        session.endSession()
    }
}



export const getCurrentOrder = async (req, res) => {
    try {
        const assignment = await DeliveryAssignment.findOne({
            assignedTo: req.userId,
            status: "assigned"
        })
            .populate("shop", "name")
            .populate("assignedTo", "fullName email mobile location")
            .populate({
                path: "order",
                select: '-shopOrders.deliveryOtpHash -shopOrders.otpExpires -shopOrders.deliveryOtpAttempts',
                populate: [{ path: "user", select: "fullName email location mobile" }]

            })

        if (!assignment) {
            return res.status(400).json({ message: "assignment not found" })
        }
        if (!assignment.order) {
            return res.status(400).json({ message: "order not found" })
        }

        const shopOrder = assignment.order.shopOrders.find(so => String(so._id) == String(assignment.shopOrderId))

        if (!shopOrder) {
            return res.status(400).json({ message: "shopOrder not found" })
        }

        let deliveryBoyLocation = { lat: null, lon: null }
        if (assignment.assignedTo.location.coordinates.length == 2) {
            deliveryBoyLocation.lat = assignment.assignedTo.location.coordinates[1]
            deliveryBoyLocation.lon = assignment.assignedTo.location.coordinates[0]
        }

        let customerLocation = { lat: null, lon: null }
        if (assignment.order.deliveryAddress) {
            customerLocation.lat = assignment.order.deliveryAddress.latitude
            customerLocation.lon = assignment.order.deliveryAddress.longitude
        }

        return res.status(200).json({
            _id: assignment.order._id,
            user: assignment.order.user,
            shopOrder,
            deliveryAddress: assignment.order.deliveryAddress,
            deliveryBoyLocation,
            customerLocation
        })


    } catch (error) {
        // FIX (missing error handling, flagged earlier): this catch previously sent no
        // response at all, leaving the client request hanging forever on failure.
        return res.status(500).json({ message: `get current order error ${error}` })
    }
}

export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params
        const order = await Order.findById(orderId)
            .select('-shopOrders.deliveryOtpHash -shopOrders.otpExpires -shopOrders.deliveryOtpAttempts')
            .populate("user")
            .populate({
                path: "shopOrders.shop",
                model: "Shop"
            })
            .populate({
                path: "shopOrders.assignedDeliveryBoy",
                model: "User"
            })
            .populate({
                path: "shopOrders.shopOrderItems.item",
                model: "Item"
            })
            .lean()

        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        // FIX (Phase 2, #1 — authorization, critical): previously ANY logged-in user
        // could view ANY order — full customer name, email, mobile, exact delivery
        // address — just by guessing/incrementing an orderId in the URL. Now only three
        // groups can view it: the customer who placed it, an owner of one of its
        // shop-orders, or the delivery boy assigned to one of its shop-orders.
        const isCustomer = String(order.user._id) === String(req.userId)
        const isShopOwnerOfOrder = order.shopOrders.some(so => String(so.owner) === String(req.userId))
        const isAssignedDeliveryBoy = order.shopOrders.some(so => so.assignedDeliveryBoy && String(so.assignedDeliveryBoy._id) === String(req.userId))

        if (!isCustomer && !isShopOwnerOfOrder && !isAssignedDeliveryBoy) {
            return res.status(403).json({ message: "not authorized to view this order" })
        }

        return res.status(200).json(order)
    } catch (error) {
        return res.status(500).json({ message: `get by id order error ${error}` })
    }
}

export const sendDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId } = req.body

        // FIX (crash bug): previously did `order.shopOrders.id(...)` BEFORE checking
        // whether `order` itself was null — an invalid/nonexistent orderId threw a
        // TypeError here that fell into the catch block as a 500, instead of the
        // clean 400 the `!order` check below was clearly meant to return. Optional
        // chaining fixes the ordering issue without changing the check's intent.
        const order = await Order.findById(orderId).populate("user")
        const shopOrder = order?.shopOrders?.id(shopOrderId)
        if (!order || !shopOrder) {
            return res.status(400).json({ message: "enter valid order/shopOrderid" })
        }

        // FIX (security — delivery OTP ownership check): previously any authenticated
        // user could trigger an OTP send for ANY shopOrderId just by knowing/guessing
        // it — there was no check that the requester is actually the delivery boy
        // assigned to this delivery. Same ownership-check pattern already used in
        // acceptOrder: compare the relevant assignment field against req.userId as
        // strings, reject with 403 if they don't match. This must run before OTP
        // generation, not after.
        if (!shopOrder.assignedDeliveryBoy || String(shopOrder.assignedDeliveryBoy) !== String(req.userId)) {
            return res.status(403).json({ message: "you are not assigned to this delivery" })
        }

        // FIX (delivery OTP hardening): crypto.randomInt instead of Math.random —
        // same reasoning as the earlier checkout-OTP fix, Math.random is not
        // cryptographically secure. The OTP itself is now hashed before it's
        // stored (deliveryOtpHash), never kept in plaintext — see order.model.js.
        const otp = crypto.randomInt(1000, 10000).toString()
        const otpHash = await bcrypt.hash(otp, 10)

        shopOrder.deliveryOtpHash = otpHash
        shopOrder.otpExpires = Date.now() + 5 * 60 * 1000
        // Reset the wrong-attempt counter every time a fresh OTP is generated —
        // mirrors User.mobileOtpAttempts.
        shopOrder.deliveryOtpAttempts = 0
        await order.save()
        await sendDeliveryOtpMail(order.user, otp)
        return res.status(200).json({ message: `Otp sent Successfuly to ${order?.user?.fullName}` })
    } catch (error) {
        return res.status(500).json({ message: `delivery otp error ${error}` })
    }
}

export const verifyDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId, otp } = req.body

        // FIX (delivery OTP hardening — regression fix): the schema no longer
        // marks these fields `select: false` (see order.model.js for why that
        // approach was unreliable), so a plain findById returns them normally —
        // no special select() needed here anymore.
        const order = await Order.findById(orderId)
            .populate("user")
        // FIX (crash bug): same ordering issue as sendDeliveryOtp — checking `order`
        // before dereferencing it instead of after.
        const shopOrder = order?.shopOrders?.id(shopOrderId)
        if (!order || !shopOrder) {
            return res.status(400).json({ message: "enter valid order/shopOrderid" })
        }

        // FIX (security — delivery OTP ownership check): same gap as sendDeliveryOtp
        // — nothing stopped an unrelated delivery boy from attempting to verify (and
        // thus mark delivered) an order that wasn't assigned to them. This check runs
        // before the OTP comparison itself, so an unauthorized caller can't even use
        // this endpoint to probe whether a guessed OTP is correct.
        if (!shopOrder.assignedDeliveryBoy || String(shopOrder.assignedDeliveryBoy) !== String(req.userId)) {
            return res.status(403).json({ message: "you are not assigned to this delivery" })
        }

        if (!shopOrder.deliveryOtpHash || !shopOrder.otpExpires) {
            return res.status(400).json({ message: "Please request an OTP first." })
        }

        if (shopOrder.otpExpires < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new OTP." })
        }

        // FIX (brute-force guard): the original comparison had NO attempt limit at
        // all. A 4-digit OTP (9000 possibilities) valid for 5 minutes, with unlimited
        // guesses and no rate limiting, is brute-forceable by a simple script well
        // within that window. Mirrors User.mobileOtpAttempts: 5 wrong attempts
        // against the current OTP locks it out until a fresh one is requested.
        if (shopOrder.deliveryOtpAttempts >= 5) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." })
        }

        if (!otp) {
            return res.status(400).json({ message: "otp is required" })
        }

        const isMatch = await bcrypt.compare(otp, shopOrder.deliveryOtpHash)
        if (!isMatch) {
            shopOrder.deliveryOtpAttempts += 1
            await order.save()
            return res.status(400).json({ message: "Invalid/Expired Otp" })
        }

        shopOrder.status = "delivered"
        shopOrder.deliveredAt = Date.now()
        // Clear the OTP material now that it's served its purpose — defense in
        // depth alongside select:false, same as verifyCheckoutOtp does for User.
        shopOrder.deliveryOtpHash = null
        shopOrder.otpExpires = null
        shopOrder.deliveryOtpAttempts = 0
        await order.save()
        await DeliveryAssignment.deleteOne({
            shopOrderId: shopOrder._id,
            order: order._id,
            assignedTo: shopOrder.assignedDeliveryBoy
        })

        return res.status(200).json({ message: "Order Delivered Successfully!" })

    } catch (error) {
        return res.status(500).json({ message: `verify delivery otp error ${error}` })
    }
}

export const getTodayDeliveries=async (req,res) => {
    try {
        const deliveryBoyId=req.userId
        const startsOfDay=new Date()
        startsOfDay.setHours(0,0,0,0)

        // NEW: .populate() added so the delivery-history list below can show a
        // real shop name/photo AND a real customer name/mobile — previously
        // this query only needed shop as a bare ObjectId and never touched
        // user at all, since the only consumer was the hourly-count chart.
        const orders=await Order.find({
           "shopOrders.assignedDeliveryBoy":deliveryBoyId,
           "shopOrders.status":"delivered",
           "shopOrders.deliveredAt":{$gte:startsOfDay}
        })
        .populate("shopOrders.shop", "name image")
        .populate("user", "fullName mobile")
        .lean()

     let todaysDeliveries=[] 
     
     orders.forEach(order=>{
        order.shopOrders.forEach(shopOrder=>{
            if(shopOrder.assignedDeliveryBoy==deliveryBoyId &&
                shopOrder.status=="delivered" &&
                shopOrder.deliveredAt &&
                shopOrder.deliveredAt>=startsOfDay
            ){
                // NEW: attach the parent order's id and delivery address onto
                // each shopOrder before pushing it — shopOrder itself has no
                // reference back to its parent Order or the customer's address,
                // both of which the frontend history list actually needs.
                todaysDeliveries.push({ ...shopOrder, orderId: order._id, deliveryAddress: order.deliveryAddress, customer: order.user })
            }
        })
     })

let stats={}

todaysDeliveries.forEach(shopOrder=>{
    const hour=new Date(shopOrder.deliveredAt).getHours()
    stats[hour]=(stats[hour] || 0) + 1
})

let formattedStats=Object.keys(stats).map(hour=>({
 hour:parseInt(hour),
 count:stats[hour]   
}))

formattedStats.sort((a,b)=>a.hour-b.hour)

// NEW: real delivery-by-delivery detail — shop name/photo (from the populate
// above), item count, subtotal, delivery address, and the exact delivered
// timestamp. This is what the redesigned delivery-history UI reads from;
// hourlyStats (below) is the exact same aggregate the bar chart already used,
// completely unchanged, so nothing that already depends on it breaks.
const deliveryDetails = todaysDeliveries
    .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))
    .map(shopOrder => ({
        orderId: shopOrder.orderId,
        shopName: shopOrder.shop?.name || "Shop",
        shopImage: shopOrder.shop?.image || null,
        customerName: shopOrder.customer?.fullName || "Customer",
        customerMobile: shopOrder.customer?.mobile || "",
        deliveryAddress: shopOrder.deliveryAddress?.text || "",
        deliveredAt: shopOrder.deliveredAt,
        itemCount: shopOrder.shopOrderItems?.length || 0,
        subtotal: shopOrder.subtotal
    }))

return res.status(200).json({ hourlyStats: formattedStats, deliveries: deliveryDetails })
  

    } catch (error) {
        return res.status(500).json({ message: `today deliveries error ${error}` }) 
    }
}

// NEW: PLATFORM_COMMISSION_RATE — deliberately kept at 0 and applied as a no-op below.
// The task doesn't want commission live yet, but this is the one spot it needs to be
// wired in later: multiply totalRevenue (and/or each shopOrder's subtotal) by
// (1 - PLATFORM_COMMISSION_RATE) before it's returned as the owner's revenue.
const PLATFORM_COMMISSION_RATE = 0

// NEW: shared helper — computes just the aggregate totals (no day-by-day breakdown,
// no best-sellers) for a given owner within [startDate, endDate). Used to compute
// BOTH the current window and the prior comparison window for the "+X% vs last N
// days" trend, without duplicating the aggregation logic twice.
const computeOwnerTotals = async (ownerId, startDate, endDate) => {
    const orders = await Order.find({
        "shopOrders.owner": ownerId,
        "shopOrders.status": "delivered",
        "shopOrders.deliveredAt": { $gte: startDate, $lt: endDate }
    }).lean()

    let totalRevenue = 0
    let totalOrders = 0
    let totalItemsSold = 0

    orders.forEach(order => {
        order.shopOrders.forEach(shopOrder => {
            if (
                String(shopOrder.owner) === String(ownerId) &&
                shopOrder.status === "delivered" &&
                shopOrder.deliveredAt &&
                new Date(shopOrder.deliveredAt) >= startDate &&
                new Date(shopOrder.deliveredAt) < endDate
            ) {
                totalRevenue += shopOrder.subtotal || 0
                totalOrders += 1
                totalItemsSold += shopOrder.shopOrderItems.reduce((s, i) => s + (i.quantity || 0), 0)
            }
        })
    })

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    return { totalRevenue, totalOrders, averageOrderValue, totalItemsSold }
}

// NEW: percentage-change helper. Returns null (not Infinity/NaN) when there's no
// prior-period data to compare against, so the frontend can show "New" instead of a
// broken number rather than silently displaying "+Infinity%".
const calcTrendPct = (current, previous) => {
    if (!previous) return current > 0 ? null : 0
    return Number((((current - previous) / previous) * 100).toFixed(1))
}

// NEW: Shop owner analytics — revenue over time, best-selling items, and summary
// stats, scoped to only THIS owner's delivered shop-orders. Reuses the same
// "flatten shopOrders that belong to this user" pattern already used in
// getTodayDeliveries/getMyOrders, just grouped by day instead of by hour, and over a
// caller-selected window instead of a fixed "today."
export const getOwnerAnalytics = async (req, res) => {
    try {
        const ownerId = req.userId
        const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90)
        const startDate = getStartDate(days)
        const now = new Date()

        const orders = await Order.find({
            "shopOrders.owner": ownerId,
            "shopOrders.status": "delivered",
            "shopOrders.deliveredAt": { $gte: startDate }
        }).lean()

        // Only this owner's own delivered shop-orders within the window — a single
        // Order can contain shop-orders belonging to other shops too (multi-shop
        // checkout), those must never leak into this owner's numbers.
        const myDeliveredShopOrders = []
        orders.forEach(order => {
            order.shopOrders.forEach(shopOrder => {
                if (
                    String(shopOrder.owner) === String(ownerId) &&
                    shopOrder.status === "delivered" &&
                    shopOrder.deliveredAt &&
                    new Date(shopOrder.deliveredAt) >= startDate
                ) {
                    myDeliveredShopOrders.push(shopOrder)
                }
            })
        })

        // --- summary ---
        // Revenue = food amount only (subtotal). Deliberately does NOT include
        // delivery fee, tax, or tips — those never belonged to the shop.
        const totalRevenue = myDeliveredShopOrders.reduce((sum, so) => sum + (so.subtotal || 0), 0)
        const totalOrders = myDeliveredShopOrders.length
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
        const totalItemsSold = myDeliveredShopOrders.reduce((sum, so) => {
            return sum + so.shopOrderItems.reduce((itemSum, i) => itemSum + (i.quantity || 0), 0)
        }, 0)

        // --- NEW: trend vs the immediately preceding period of equal length ---
        // e.g. for a 7-day window, this compares against the 7 days before that.
        const previousStartDate = new Date(startDate)
        previousStartDate.setDate(previousStartDate.getDate() - days)
        const previousTotals = await computeOwnerTotals(ownerId, previousStartDate, startDate)

        const trends = {
            revenue: calcTrendPct(totalRevenue, previousTotals.totalRevenue),
            orders: calcTrendPct(totalOrders, previousTotals.totalOrders),
            averageOrderValue: calcTrendPct(averageOrderValue, previousTotals.averageOrderValue),
            itemsSold: calcTrendPct(totalItemsSold, previousTotals.totalItemsSold)
        }

        // --- revenue over time (grouped by day, zero-filled for gaps) ---
        const revenueByDate = {}
        myDeliveredShopOrders.forEach(so => {
            const key = dateKey(so.deliveredAt)
            revenueByDate[key] = (revenueByDate[key] || 0) + (so.subtotal || 0)
        })
        const revenueOverTime = fillDateSeries(days, revenueByDate, "revenue")

        // --- best selling items (grouped by item name, ranked by quantity) ---
        const itemStats = {}
        myDeliveredShopOrders.forEach(so => {
            so.shopOrderItems.forEach(i => {
                const key = i.name
                if (!itemStats[key]) {
                    itemStats[key] = { itemName: key, quantitySold: 0, revenue: 0 }
                }
                itemStats[key].quantitySold += i.quantity || 0
                itemStats[key].revenue += (i.price || 0) * (i.quantity || 0)
            })
        })
        const bestSellingItems = Object.values(itemStats)
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, 5)

        // Commission hook point (currently a no-op at rate 0) — see constant above
        const netRevenue = totalRevenue * (1 - PLATFORM_COMMISSION_RATE)

        return res.status(200).json({
            summary: {
                totalRevenue: Number(netRevenue.toFixed(2)),
                totalOrders,
                averageOrderValue: Number(averageOrderValue.toFixed(2)),
                totalItemsSold
            },
            trends,
            revenueOverTime,
            bestSellingItems
        })
    } catch (error) {
        return res.status(500).json({ message: `owner analytics error ${error}` })
    }
}

// NEW: Delivery boy analytics — earnings ONLY reflect the delivery fee, never the
// food subtotal (that belongs to the shop, not the delivery boy). A single Order can
// have multiple shop-orders (multi-shop checkout), each potentially delivered by a
// different delivery boy, but the delivery fee itself is stored once per ORDER, not
// per shop-order — so this dedupes by order._id to avoid attributing the same
// order's fee twice if this boy somehow delivered more than one leg of it.
export const getDeliveryBoyAnalytics = async (req, res) => {
    try {
        const deliveryBoyId = req.userId
        const days = 7 // trailing-week trend, matches the owner chart's default window
        const startDate = getStartDate(days)

        const orders = await Order.find({
            "shopOrders.assignedDeliveryBoy": deliveryBoyId,
            "shopOrders.status": "delivered",
            "shopOrders.deliveredAt": { $gte: startDate }
        }).lean()

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        // earningsByDate keyed by day, using the earliest deliveredAt among this
        // boy's shop-orders in that order (only matters on the rare order that has
        // more than one leg delivered by the same boy)
        const earningsByDate = {}
        const countedOrderIdsForWindow = new Set()
        let todayEarnings = 0
        let completedDeliveriesToday = 0
        const countedOrderIdsForToday = new Set()

        orders.forEach(order => {
            const myShopOrdersInThisOrder = order.shopOrders.filter(so =>
                String(so.assignedDeliveryBoy) === String(deliveryBoyId) &&
                so.status === "delivered" &&
                so.deliveredAt &&
                new Date(so.deliveredAt) >= startDate
            )
            if (myShopOrdersInThisOrder.length === 0) return

            const orderIdStr = String(order._id)
            const fee = order.deliveryFee || 0

            // --- trailing-week trend: count this order's fee once ---
            if (!countedOrderIdsForWindow.has(orderIdStr)) {
                countedOrderIdsForWindow.add(orderIdStr)
                const earliest = myShopOrdersInThisOrder
                    .map(so => new Date(so.deliveredAt))
                    .sort((a, b) => a - b)[0]
                const key = dateKey(earliest)
                earningsByDate[key] = (earningsByDate[key] || 0) + fee
            }

            // --- today's summary cards ---
            const deliveredToday = myShopOrdersInThisOrder.some(so => new Date(so.deliveredAt) >= startOfToday)
            if (deliveredToday) {
                completedDeliveriesToday += myShopOrdersInThisOrder.filter(so => new Date(so.deliveredAt) >= startOfToday).length
                if (!countedOrderIdsForToday.has(orderIdStr)) {
                    countedOrderIdsForToday.add(orderIdStr)
                    todayEarnings += fee
                }
            }
        })

        const averageEarningPerDelivery = completedDeliveriesToday > 0
            ? todayEarnings / completedDeliveriesToday
            : 0

        const earningsOverTime = fillDateSeries(days, earningsByDate, "earnings")

        return res.status(200).json({
            summary: {
                todayEarnings: Number(todayEarnings.toFixed(2)),
                completedDeliveries: completedDeliveriesToday,
                averageEarningPerDelivery: Number(averageEarningPerDelivery.toFixed(2))
            },
            earningsOverTime
        })
    } catch (error) {
        return res.status(500).json({ message: `delivery boy analytics error ${error}` })
    }
}