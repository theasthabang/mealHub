import { jest } from "@jest/globals"
import { connectTestDb, disconnectTestDb, clearTestDb } from "./testSetup.js"
import mongoose from "mongoose"
import User from "../models/user.model.js"
import Shop from "../models/shop.model.js"
import Item from "../models/item.model.js"
import Order from "../models/order.model.js"
import { placeOrder } from "../controllers/order.controllers.js"

// Mocks Razorpay's SDK so this test never makes a real network call — only
// the COD path is exercised here, but the mock exists so import of
// order.controllers.js (which constructs a Razorpay instance at module load)
// doesn't itself require real API keys during tests.
jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({
        orders: { create: jest.fn() }
    }))
})

const mockRes = () => {
    const res = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
}

describe("placeOrder — price integrity", () => {
    beforeAll(async () => await connectTestDb())
    afterAll(async () => await disconnectTestDb())
    afterEach(async () => await clearTestDb())

    it("uses the database price, ignoring a tampered client-supplied price", async () => {
        // Set up: a real customer, a real open shop, a real item priced at ₹500
        const owner = await User.create({
            fullName: "Shop Owner", email: "owner@test.com", mobile: "9876543210", role: "owner"
        })
        const customer = await User.create({
            fullName: "Customer", email: "customer@test.com", mobile: "9876543211", role: "user",
            isMobileVerified: true
        })
        const shop = await Shop.create({
            name: "Test Shop", image: "http://test.com/img.jpg", owner: owner._id,
            city: "Kolkata", state: "WB", address: "Test address", isOpen: true
        })
        const item = await Item.create({
            name: "Real Item", image: "http://test.com/item.jpg", shop: shop._id,
            category: "Snacks", price: 500, foodType: "veg", isAvailable: true
        })

        // Attack: client claims the item costs ₹1, not the real ₹500
        const req = {
            userId: customer._id,
            app: { get: jest.fn().mockReturnValue(null) }, // no real socket.io instance in tests
            body: {
                cartItems: [{
                    id: item._id.toString(),
                    shop: shop._id.toString(),
                    price: 1,        // tampered
                    quantity: 1,
                    name: "Real Item"
                }],
                paymentMethod: "cod",
                deliveryAddress: { text: "Test", latitude: 22.5, longitude: 88.3 }
            }
        }
        const res = mockRes()

        await placeOrder(req, res)

        // The created order's actual subtotal should reflect the REAL ₹500
        // price from the database, never the ₹1 the client tried to submit.
        const createdOrder = await Order.findOne({ user: customer._id })
        expect(createdOrder).not.toBeNull()
        expect(createdOrder.shopOrders[0].subtotal).toBe(500)
        expect(createdOrder.shopOrders[0].shopOrderItems[0].price).toBe(500)
    })
})