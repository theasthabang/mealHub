import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop"
    },
    category: {
        type: String,
        enum: ["Snacks",
            "Main Course",
            "Desserts",
            "Pizza",
            "Burgers",
            "Sandwiches",
            "South Indian",
            "North Indian",
            "Chinese",
            "Fast Food",
            "Others"
        ],
        required: true
    },
    price: {
        type: Number,
        min: 0,
        required: true
    },
    foodType: {
        type: String,
        enum: ["veg", "non veg"],
        required: true
    },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 }
    },
    // NEW: real availability toggle, not a cosmetic badge — placeOrder re-checks this
    // against the database at order time (never trusts the frontend cart's cached
    // copy, which could be stale if an owner marks something unavailable after the
    // customer already added it to their cart).
    isAvailable: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

const Item = mongoose.model("Item", itemSchema)
export default Item