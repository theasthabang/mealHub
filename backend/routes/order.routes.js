import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { acceptOrder, cancelOrderItem, getCurrentOrder, getDeliveryBoyAnalytics, getDeliveryBoyAssignment, getMyOrders, getOrderById, getOwnerAnalytics, getTodayDeliveries, placeOrder, sendDeliveryOtp, updateOrderStatus, verifyDeliveryOtp, verifyPayment } from "../controllers/order.controllers.js"

const orderRouter = express.Router()

orderRouter.post("/place-order", isAuth, placeOrder)
orderRouter.post("/verify-payment", isAuth, verifyPayment)
orderRouter.get("/my-orders", isAuth, getMyOrders)
orderRouter.get("/get-assignments", isAuth, getDeliveryBoyAssignment)
orderRouter.get("/get-current-order", isAuth, getCurrentOrder)
orderRouter.post("/send-delivery-otp", isAuth, sendDeliveryOtp)
orderRouter.post("/verify-delivery-otp", isAuth, verifyDeliveryOtp)
orderRouter.post("/update-status/:orderId/:shopId", isAuth, updateOrderStatus)
// NEW: customer-initiated cancellation, scoped to a single shop-order
orderRouter.post("/cancel/:orderId/:shopId", isAuth, cancelOrderItem)
orderRouter.get('/accept-order/:assignmentId', isAuth, acceptOrder)
orderRouter.get('/get-order-by-id/:orderId', isAuth, getOrderById)
orderRouter.get('/get-today-deliveries', isAuth, getTodayDeliveries)
// NEW: analytics endpoints — both self-scope by req.userId inside the query, so no
// separate role-check middleware is needed (same pattern already used elsewhere,
// e.g. getMyShop)
orderRouter.get('/owner-analytics', isAuth, getOwnerAnalytics)
orderRouter.get('/delivery-analytics', isAuth, getDeliveryBoyAnalytics)

export default orderRouter