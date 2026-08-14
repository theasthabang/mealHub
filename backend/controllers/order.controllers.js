import DeliveryAssignment from "../models/deliveryAssignment.model.js"
import Order from "../models/order.model.js"
import Shop from "../models/shop.model.js"
import User from "../models/user.model.js"
import Item from "../models/item.model.js"
import { sendDeliveryOtpMail } from "../utils/mail.js"
import { dateKey, getStartDate, fillDateSeries } from "../utils/analyticsHelpers.js"
import RazorPay from "razorpay"
import dotenv from "dotenv"
import { count } from "console"

dotenv.config()
let instance = new RazorPay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const placeOrder = async (req, res) => {
    try {
        const { cartItems, paymentMethod, deliveryAddress, totalAmount, deliveryFee } = req.body
        if (cartItems.length == 0 || !cartItems) {
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
            const unavailable = dbItems.filter(dbItem => !dbItem.isAvailable)
            if (unavailable.length > 0) {
                const err = new Error(`${unavailable.map(i => i.name).join(", ")} ${unavailable.length > 1 ? "are" : "is"} no longer available`)
                err.status = 400
                throw err
            }

            const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0)
            return {
                shop: shop._id,
                owner: shop.owner._id,
                subtotal,
                shopOrderItems: items.map((i) => ({
                    item: i.id,
                    price: i.price,
                    quantity: i.quantity,
                    name: i.name
                }))
            }
        }
        ))

        if (paymentMethod == "online") {
            const razorOrder = await instance.orders.create({
                amount: Math.round(totalAmount * 100),
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            })
            const newOrder = await Order.create({
                user: req.userId,
                paymentMethod,
                deliveryAddress,
                totalAmount,
                // NEW: persist the delivery fee that was already computed client-side,
                // so delivery boy earnings can be calculated from real data later
                deliveryFee: deliveryFee || 0,
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
            totalAmount,
            // NEW: same as above, for the COD path
            deliveryFee: deliveryFee || 0,
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

        order.payment = true
        order.razorpayPaymentId = razorpay_payment_id
        await order.save()

        await order.populate("shopOrders.shopOrderItems.item", "name image price")
        await order.populate("shopOrders.shop", "name")
        await order.populate("shopOrders.owner", "name socketId")
        await order.populate("user", "name email mobile")

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
        if (user.role == "user") {
            const orders = await Order.find({ user: req.userId })
                .sort({ createdAt: -1 })
                .populate("shopOrders.shop", "name")
                .populate("shopOrders.owner", "name email mobile")
                .populate("shopOrders.shopOrderItems.item", "name image price")

            return res.status(200).json(orders)
        } else if (user.role == "owner") {
            const orders = await Order.find({ "shopOrders.owner": req.userId })
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
        const order = await Order.findById(orderId)

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
        shopOrder.status = status
        let deliveryBoysPayload = []
        if (status == "out of delivery" && !shopOrder.assignment) {
            const { longitude, latitude } = order.deliveryAddress
            const nearByDeliveryBoys = await User.find({
                role: "deliveryBoy",
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
                            sentTo:boy._id,
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

        shopOrder.status = "cancelled"
        shopOrder.cancelledAt = Date.now()
        shopOrder.cancelReason = reason || "Not specified"

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
            message: "order cancelled successfully",
            shopOrder: updatedShopOrder
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


export const acceptOrder = async (req, res) => {
    try {
        const { assignmentId } = req.params
        const assignment = await DeliveryAssignment.findById(assignmentId)
        if (!assignment) {
            return res.status(400).json({ message: "assignment not found" })
        }
        if (assignment.status !== "brodcasted") {
            return res.status(400).json({ message: "assignment is expired" })
        }

        // FIX (Phase 2, #1 — authorization): previously any logged-in user (any role)
        // could accept ANY delivery assignment just by knowing/guessing its ID — there
        // was no check that this assignment was actually broadcast to them.
        // `brodcastedTo` is populated only with nearby users whose role is
        // "deliveryBoy" (see updateOrderStatus's nearByDeliveryBoys query), so checking
        // membership in it is sufficient — it also implicitly enforces the role check.
        const isBroadcastToThisUser = assignment.brodcastedTo.some(id => String(id) === String(req.userId))
        if (!isBroadcastToThisUser) {
            return res.status(403).json({ message: "this assignment was not offered to you" })
        }

        const alreadyAssigned = await DeliveryAssignment.findOne({
            assignedTo: req.userId,
            status: { $nin: ["brodcasted", "completed"] }
        })

        if (alreadyAssigned) {
            return res.status(400).json({ message: "You are already assigned to another order" })
        }

        assignment.assignedTo = req.userId
        assignment.status = 'assigned'
        assignment.acceptedAt = new Date()
        await assignment.save()

        const order = await Order.findById(assignment.order)
        if (!order) {
            return res.status(400).json({ message: "order not found" })
        }

        let shopOrder = order.shopOrders.id(assignment.shopOrderId)
        shopOrder.assignedDeliveryBoy = req.userId
        await order.save()


        return res.status(200).json({
            message: 'order accepted'
        })
    } catch (error) {
        return res.status(500).json({ message: `accept order error ${error}` })
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
        const order = await Order.findById(orderId).populate("user")
        const shopOrder = order.shopOrders.id(shopOrderId)
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

        const otp = Math.floor(1000 + Math.random() * 9000).toString()
        shopOrder.deliveryOtp = otp
        shopOrder.otpExpires = Date.now() + 5 * 60 * 1000
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
        const order = await Order.findById(orderId).populate("user")
        const shopOrder = order.shopOrders.id(shopOrderId)
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

        if (shopOrder.deliveryOtp !== otp || !shopOrder.otpExpires || shopOrder.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid/Expired Otp" })
        }

        shopOrder.status = "delivered"
        shopOrder.deliveredAt = Date.now()
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

        const orders=await Order.find({
           "shopOrders.assignedDeliveryBoy":deliveryBoyId,
           "shopOrders.status":"delivered",
           "shopOrders.deliveredAt":{$gte:startsOfDay}
        }).lean()

     let todaysDeliveries=[] 
     
     orders.forEach(order=>{
        order.shopOrders.forEach(shopOrder=>{
            if(shopOrder.assignedDeliveryBoy==deliveryBoyId &&
                shopOrder.status=="delivered" &&
                shopOrder.deliveredAt &&
                shopOrder.deliveredAt>=startsOfDay
            ){
                todaysDeliveries.push(shopOrder)
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

return res.status(200).json(formattedStats)
  

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