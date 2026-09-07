import { jest } from "@jest/globals"
import { connectTestDb, disconnectTestDb, clearTestDb } from "./testSetup.js"
import User from "../models/user.model.js"
import Shop from "../models/shop.model.js"
import Order from "../models/order.model.js"
import DeliveryAssignment from "../models/deliveryAssignment.model.js"
import { acceptOrder } from "../controllers/order.controllers.js"

jest.mock("razorpay", () => {
    return jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } }))
})

const mockRes = () => {
    const res = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
}

describe("acceptOrder — race condition", () => {
    beforeAll(async () => await connectTestDb())
    afterAll(async () => await disconnectTestDb())
    afterEach(async () => await clearTestDb())

    it("only lets ONE of two concurrent accept requests actually win the same assignment", async () => {
        const owner = await User.create({
            fullName: "Owner", email: "owner2@test.com", mobile: "9876543212", role: "owner"
        })
        const boyA = await User.create({
            fullName: "Delivery Boy A", email: "boyA@test.com", mobile: "9876543213", role: "deliveryBoy"
        })
        const boyB = await User.create({
            fullName: "Delivery Boy B", email: "boyB@test.com", mobile: "9876543214", role: "deliveryBoy"
        })
        const shop = await Shop.create({
            name: "Shop", image: "http://test.com/img.jpg", owner: owner._id,
            city: "Kolkata", state: "WB", address: "Test", isOpen: true
        })
        const order = await Order.create({
            user: owner._id, // arbitrary — not the focus of this test
            paymentMethod: "cod",
            deliveryAddress: { text: "Test", latitude: 22.5, longitude: 88.3 },
            totalAmount: 300,
            shopOrders: [{
                shop: shop._id, owner: owner._id, subtotal: 300,
                shopOrderItems: [], status: "out of delivery"
            }]
        })
        const shopOrderId = order.shopOrders[0]._id

        const assignment = await DeliveryAssignment.create({
            order: order._id,
            shop: shop._id,
            shopOrderId,
            brodcastedTo: [boyA._id, boyB._id],
            status: "brodcasted"
        })

        // Fire both accept requests genuinely concurrently — this is the
        // actual race condition scenario, not two sequential calls.
        const resA = mockRes()
        const resB = mockRes()

        await Promise.all([
            acceptOrder({ userId: boyA._id, params: { assignmentId: assignment._id.toString() } }, resA),
            acceptOrder({ userId: boyB._id, params: { assignmentId: assignment._id.toString() } }, resB)
        ])

        // Exactly one of the two responses should be a 200 (accepted), the
        // other should be a 400 (already taken) — never both 200, which
        // would mean both delivery boys believe they won the same job.
        const statusCalls = [resA.status.mock.calls[0][0], resB.status.mock.calls[0][0]]
        const successCount = statusCalls.filter(code => code === 200).length
        expect(successCount).toBe(1)

        // The assignment itself should be claimed by exactly one of them —
        // whichever won — never left ambiguous or claimed by both.
        const finalAssignment = await DeliveryAssignment.findById(assignment._id)
        expect(finalAssignment.status).toBe("assigned")
        expect([boyA._id.toString(), boyB._id.toString()]).toContain(finalAssignment.assignedTo.toString())

        // The Order's own shopOrder should agree with the assignment — this
        // is the atomicity guarantee: both documents update together or not
        // at all, never one saying "assigned" while the other still shows
        // nobody assigned.
        const finalOrder = await Order.findById(order._id)
        const finalShopOrder = finalOrder.shopOrders.id(shopOrderId)
        expect(finalShopOrder.assignedDeliveryBoy?.toString()).toBe(finalAssignment.assignedTo.toString())
    })
})