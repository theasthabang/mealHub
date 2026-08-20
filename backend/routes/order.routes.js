import express from "express"
import rateLimit from "express-rate-limit"
import isAuth from "../middlewares/isAuth.js"
import { acceptOrder, cancelOrderItem, getCurrentOrder, getDeliveryBoyAnalytics, getDeliveryBoyAssignment, getMyOrders, getOrderById, getOwnerAnalytics, getTodayDeliveries, placeOrder, sendDeliveryOtp, updateOrderStatus, verifyDeliveryOtp, verifyPayment } from "../controllers/order.controllers.js"

const orderRouter = express.Router()

// NEW (delivery OTP hardening): route-level rate limiting as defense in depth
// alongside the app-level attempt lockout added in verifyDeliveryOtp — mirrors the
// otpLimiter/authLimiter pattern already used in auth.routes.js, which this pair of
// endpoints previously had none of at all.
const deliveryOtpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: "Too many OTP requests. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
})

const deliveryOtpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
})

orderRouter.post("/place-order", isAuth, placeOrder)
orderRouter.post("/verify-payment", isAuth, verifyPayment)
orderRouter.get("/my-orders", isAuth, getMyOrders)
orderRouter.get("/get-assignments", isAuth, getDeliveryBoyAssignment)
orderRouter.get("/get-current-order", isAuth, getCurrentOrder)
orderRouter.post("/send-delivery-otp", isAuth, deliveryOtpSendLimiter, sendDeliveryOtp)
orderRouter.post("/verify-delivery-otp", isAuth, deliveryOtpVerifyLimiter, verifyDeliveryOtp)
orderRouter.post("/update-status/:orderId/:shopId", isAuth, updateOrderStatus)
// NEW: customer-initiated cancellation, scoped to a single shop-order
orderRouter.post("/cancel/:orderId/:shopId", isAuth, cancelOrderItem)
// FIX (CSRF exposure): was GET, which mutates state (accepts a delivery
// assignment) with no CSRF protection — a malicious <img src="..."> or link
// prefetch on any page a logged-in delivery boy visits could silently trigger
// acceptance with no user gesture at all, and browsers/proxies are free to
// prefetch GET requests. Mutating actions belong on POST.
orderRouter.post('/accept-order/:assignmentId', isAuth, acceptOrder)
orderRouter.get('/get-order-by-id/:orderId', isAuth, getOrderById)
orderRouter.get('/get-today-deliveries', isAuth, getTodayDeliveries)
// NEW: analytics endpoints — both self-scope by req.userId inside the query, so no
// separate role-check middleware is needed (same pattern already used elsewhere,
// e.g. getMyShop)
orderRouter.get('/owner-analytics', isAuth, getOwnerAnalytics)
orderRouter.get('/delivery-analytics', isAuth, getDeliveryBoyAnalytics)

export default orderRouter