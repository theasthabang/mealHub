import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
    },
    mobile: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["user", "owner", "deliveryBoy"],
        required: true
    },
    resetOtp: {
        type: String
    },
    isOtpVerified: {
        type: Boolean,
        default: false
    },
    otpExpires: {
        type: Date
    },
    // NEW: checkout-time mobile verification. Deliberately separate fields/names from
    // resetOtp/isOtpVerified/otpExpires above — those already belong to the
    // password-reset flow (email-based OTP), and reusing them here would silently
    // corrupt that unrelated feature.
    isMobileVerified: {
        type: Boolean,
        default: false
    },
    // The specific number that was actually OTP-verified — kept separate from
    // `mobile` (set at signup, never itself verified) so that if a different number
    // is verified at checkout, or `mobile` is ever changed elsewhere, comparing the
    // two tells us whether re-verification is required.
    verifiedMobile: {
        type: String,
        default: null
    },
    mobileOtpHash: {
        type: String,
        default: null
    },
    mobileOtpExpires: {
        type: Date,
        default: null
    },
    // Brute-force guard on verify: wrong-attempt count against the CURRENT
    // mobileOtpHash, reset to 0 every time a new OTP is generated.
    mobileOtpAttempts: {
        type: Number,
        default: 0
    },
    // Rate-limit guard on send: how many OTPs sent within the current window.
    mobileOtpSendCount: {
        type: Number,
        default: 0
    },
    mobileOtpWindowStart: {
        type: Date,
        default: null
    },
    socketId: {
        type: String,

    },
    isOnline: {
        type: Boolean,
        default: false
    },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    }

}, { timestamps: true })

userSchema.index({ location: '2dsphere' })


const User = mongoose.model("User", userSchema)
export default User