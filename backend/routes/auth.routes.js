import express from "express"
import rateLimit from "express-rate-limit"
import { googleAuth, resetPassword, sendCheckoutOtp, sendOtp, setMobileWithoutOtp, signIn, signOut, signUp, verifyCheckoutOtp, verifyOtp } from "../controllers/auth.controllers.js"
import isAuth from "../middlewares/isAuth.js"

const authRouter = express.Router()

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
})

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: "Too many OTP requests. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false
})

authRouter.post("/signup", authLimiter, signUp)
authRouter.post("/signin", authLimiter, signIn)
authRouter.get("/signout", signOut)
authRouter.post("/send-otp", otpLimiter, sendOtp)
authRouter.post("/verify-otp", authLimiter, verifyOtp)
authRouter.post("/reset-password", authLimiter, resetPassword)
authRouter.post("/google-auth", authLimiter, googleAuth)
authRouter.post("/send-checkout-otp", isAuth, otpLimiter, sendCheckoutOtp)
authRouter.post("/verify-checkout-otp", isAuth, authLimiter, verifyCheckoutOtp)
// NEW: temporary dev-only bypass — see setMobileWithoutOtp in auth.controllers.js
// for the two server-side safety checks (blocked in production, requires explicit
// SKIP_MOBILE_OTP=true in .env). Rate-limited too, same as the real OTP endpoints.
authRouter.post("/set-mobile-no-otp", isAuth, authLimiter, setMobileWithoutOtp)

export default authRouter