import { jest } from "@jest/globals"
import { connectTestDb, disconnectTestDb, clearTestDb } from "./testSetup.js"
import User from "../models/user.model.js"
import Shop from "../models/shop.model.js"
import Order from "../models/order.model.js"
import { sendDeliveryOtp, verifyDeliveryOtp } from "../controllers/order.controllers.js"

jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } }))
})
jest.mock("../utils/mail.js", () => ({
    sendDeliveryOtpMail: jest.fn().mockResolvedValue(true)
}))

const mockRes = () => {
    const res = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
}

describe("Delivery OTP", () => {
    let order, shopOrderId, deliveryBoy

    beforeAll(async () => await connectTestDb())
    afterAll(async () => await disconnectTestDb())

    beforeEach(async () => {
        await clearTestDb()

        const owner = await User.create({
            fullName: "Owner", email: "owner3@test.com", mobile: "9876543215", role: "owner"
        })
        deliveryBoy = await User.create({
            fullName: "Delivery Boy", email: "boy3@test.com", mobile: "9876543216", role: "deliveryBoy"
        })
        const customer = await User.create({
            fullName: "Customer", email: "cust3@test.com", mobile: "9876543217", role: "user"
        })
        const shop = await Shop.create({
            name: "Shop", image: "http://test.com/img.jpg", owner: owner._id,
            city: "Kolkata", state: "WB", address: "Test", isOpen: true
        })
        order = await Order.create({
            user: customer._id,
            paymentMethod: "cod",
            deliveryAddress: { text: "Test", latitude: 22.5, longitude: 88.3 },
            totalAmount: 300,
            shopOrders: [{
                shop: shop._id, owner: owner._id, subtotal: 300,
                shopOrderItems: [], status: "out of delivery",
                assignedDeliveryBoy: deliveryBoy._id
            }]
        })
        shopOrderId = order.shopOrders[0]._id

        await sendDeliveryOtp(
            { userId: deliveryBoy._id, body: { orderId: order._id.toString(), shopOrderId: shopOrderId.toString() } },
            mockRes()
        )
    })

    it("stores the OTP as a bcrypt hash, never in plaintext", async () => {
        const savedOrder = await Order.findById(order._id)
            .select('+shopOrders.deliveryOtpHash')
        const hash = savedOrder.shopOrders.id(shopOrderId).deliveryOtpHash
        expect(hash).not.toBeNull()
        // A bcrypt hash is never a plain 4-digit string
        expect(hash).not.toMatch(/^\d{4}$/)
        expect(hash.startsWith("$2")).toBe(true) // bcrypt hash prefix
    })

    it("locks out after 5 wrong OTP attempts", async () => {
        for (let i = 0; i < 5; i++) {
            const res = mockRes()
            await verifyDeliveryOtp(
                { userId: deliveryBoy._id, body: { orderId: order._id.toString(), shopOrderId: shopOrderId.toString(), otp: "0000" } },
                res
            )
        }

        // 6th attempt should be blocked with 429, regardless of what OTP is guessed
        const finalRes = mockRes()
        await verifyDeliveryOtp(
            { userId: deliveryBoy._id, body: { orderId: order._id.toString(), shopOrderId: shopOrderId.toString(), otp: "0000" } },
            finalRes
        )
        expect(finalRes.status).toHaveBeenCalledWith(429)
    })

    it("rejects a verify attempt from someone who isn't the assigned delivery boy", async () => {
        const someoneElse = await User.create({
            fullName: "Random", email: "random@test.com", mobile: "9876543218", role: "deliveryBoy"
        })
        const res = mockRes()
        await verifyDeliveryOtp(
            { userId: someoneElse._id, body: { orderId: order._id.toString(), shopOrderId: shopOrderId.toString(), otp: "0000" } },
            res
        )
        expect(res.status).toHaveBeenCalledWith(403)
    })
})