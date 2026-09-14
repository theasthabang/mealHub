import mongoose from "mongoose"

// NEW: real, functioning offers -- either shop-wide ("20% off orders above
// Rs.300") or scoped to one specific item ("Rs.30 off Cappuccino"), never
// both at once, controlled by whether `item` is set. Discounts computed from
// this model are applied SERVER-SIDE in placeOrder, exactly like every price
// in this app -- never trusted from anything the client sends. A discount is
// still a price-affecting value; it gets the same rigor as the price-
// tampering fix built earlier in this project.
const offerSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
        required: true
    },
    // null = applies to this shop's whole order subtotal.
    // set  = applies only to this one specific item's line price.
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 60
    },
    discountType: {
        type: String,
        enum: ["percentage", "flat"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 1
    },
    // Only meaningful for discountType "percentage" -- caps the rupee amount
    // a percentage discount can take off (e.g. "20% off, up to Rs.100").
    // Ignored entirely for "flat" discounts.
    maxDiscountAmount: {
        type: Number,
        default: null
    },
    // Only meaningful when item is null (a shop-wide offer) -- the shop's
    // subtotal must reach this amount before the offer applies. Ignored for
    // item-specific offers, since those apply directly to that item's price
    // regardless of the rest of the order.
    minOrderValue: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    // null = no expiry
    validUntil: {
        type: Date,
        default: null
    }
}, { timestamps: true })

// Speeds up the two real query patterns this gets used for: "all of this
// shop's offers" (owner management view) and "this shop's currently active
// offers" (customer-facing display + placeOrder's discount lookup).
offerSchema.index({ shop: 1, isActive: 1 })

const Offer = mongoose.model("Offer", offerSchema)
export default Offer