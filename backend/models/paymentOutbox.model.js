import mongoose from "mongoose"

// The Outbox Pattern's whole point: MongoDB and Postgres are two separate
// databases, so there's no way to wrap "confirm the order paid" and "record
// the payment in the ledger" in one atomic transaction across both of them.
// Instead, this entry — "a Postgres write is owed" — is written atomically
// WITH the order update, inside a single MongoDB transaction (both writes
// are in MongoDB, so that part genuinely is atomic). A separate process then
// reads this collection and keeps retrying the actual Postgres write until
// it succeeds. If the order update ever commits, this entry is guaranteed to
// exist alongside it — there's no window where one happened and the other
// didn't.
const paymentOutboxSchema = new mongoose.Schema({
    mongoOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    razorpayPaymentId: { type: String, required: true },
    razorpayOrderId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["pending", "published", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    lastError: { type: String },
    publishedAt: { type: Date }
}, { timestamps: true })

// Speeds up the sweeper's "find everything still pending" query — this
// collection is read on every sweep interval, so it's worth indexing.
paymentOutboxSchema.index({ status: 1, createdAt: 1 })

const PaymentOutbox = mongoose.model("PaymentOutbox", paymentOutboxSchema)
export default PaymentOutbox