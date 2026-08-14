import mongoose from "mongoose";

const shopOrderItemSchema = new mongoose.Schema({
    item:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
        required:true
    },
    name:String,
    price:Number,
    quantity:Number
}, { timestamps: true })

const shopOrderSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop"
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    subtotal: Number,
    shopOrderItems: [shopOrderItemSchema],
    // FIX (Phase 1): added "cancelled" — required for the cancelOrderItem feature.
    // Without this, order.save() throws a Mongoose validation error the moment
    // anyone tries to cancel a pending order.
    status:{
        type:String,
        enum:["pending","preparing","out of delivery","delivered","cancelled"],
        default:"pending"
    },
  assignment:{
     type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryAssignment",
    default:null
  },
  assignedDeliveryBoy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
deliveryOtp:{
        type:String,
        default:null
    },
otpExpires:{
        type:Date,
        default:null
    },
deliveredAt:{
    type:Date,
    default:null
},
// NEW (Phase 1): set by cancelOrderItem when a customer cancels a pending shop-order
cancelledAt:{
    type:Date,
    default:null
},
cancelReason:{
    type:String,
    default:null
}

}, { timestamps: true })

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    paymentMethod: {
        type: String,
        enum: ['cod', "online"],
        required: true
    },
    deliveryAddress: {
        text: String,
        latitude: Number,
        longitude: Number
    },
    totalAmount: {
        type: Number
    }
    ,
    // NEW: previously the delivery fee was only ever computed client-side in
    // CheckOut.jsx and folded invisibly into totalAmount — there was no way to
    // recover "just the delivery fee" from a saved order. Needed so delivery boy
    // earnings (= delivery fee only, not food cost) can actually be calculated.
    deliveryFee: {
        type: Number,
        default: 0
    },
    shopOrders: [shopOrderSchema],
    payment:{
        type:Boolean,
        default:false
    },
    razorpayOrderId:{
        type:String,
        default:""
    },
   razorpayPaymentId:{
    type:String,
       default:""
   }
}, { timestamps: true })

// NEW (Phase 3 candidate, not applied yet — flagging only): indexing `user` and
// `shopOrders.owner` would speed up getMyOrders, which queries on both. Left out of
// this patch since Phase 1 is model-shape-only; revisit in the indexing pass.

const Order=mongoose.model("Order",orderSchema)
export default Order