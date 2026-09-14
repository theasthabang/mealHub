import express from "express"
import rateLimit from "express-rate-limit"
import RedisStore from "rate-limit-redis"
import { googleAuth, resetPassword, sendCheckoutOtp, sendOtp, setMobileWithoutOtp, signIn, signOut, signUp, verifyCheckoutOtp, verifyOtp } from "../controllers/auth.controllers.js"
import isAuth from "../middlewares/isAuth.js"
import redisClient, { failOpen } from "../utils/redisClient.js"
import { validate } from "../middlewares/validate.js"
import { signUpSchema, signInSchema, sendOtpSchema, verifyOtpSchema, resetPasswordSchema, googleAuthSchema } from "../validators/authValidators.js"

const authRouter = express.Router()

// FIX (Redis-backed rate limiting): these used to store their counts in each
// server process's own memory — see redisClient.js for the full reasoning on
// why that breaks across restarts and multiple instances. `sendCommand` is the
// hook rate-limit-redis uses to actually talk to Redis through our shared
// client; `prefix` keeps auth's counters in their own namespace, separate from
// the delivery-OTP limiters in order.routes.js sharing the same Redis database.
//
// FIX (real incident): wrapped in failOpen — a Redis timeout during the
// rate-limit check previously took down /api/auth/signin entirely. See
// redisClient.js for the full reasoning; short version: a login route
// shouldn't go down because a secondary service had one slow moment.
const authLimiter = failOpen(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: "rl:auth:"
    })
}))

const otpLimiter = failOpen(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: "Too many OTP requests. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: "rl:otp:"
    })
}))

// NEW (production hardening — input validation): each route now validates its
// body against a Zod schema before the controller ever runs. This replaces
// relying only on ad-hoc `if (!field)` checks scattered inside each
// controller — a schema declares everything a route expects in one place,
// consistently enforced, rather than a check that can be forgotten on a new
// field. See middlewares/validate.js and validators/authValidators.js.
authRouter.post("/signup", authLimiter, validate(signUpSchema), signUp)
authRouter.post("/signin", authLimiter, validate(signInSchema), signIn)
authRouter.get("/signout", signOut)
authRouter.post("/send-otp", otpLimiter, validate(sendOtpSchema), sendOtp)
authRouter.post("/verify-otp", authLimiter, validate(verifyOtpSchema), verifyOtp)
authRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword)
authRouter.post("/google-auth", authLimiter, validate(googleAuthSchema), googleAuth)

// Checkout-time mobile OTP verification — used by MobileVerificationModal.jsx
// during checkout. Behind isAuth since these must run as the actual logged-in
// user (req.userId), never a userId taken from the request body.
authRouter.post("/send-checkout-otp", isAuth, otpLimiter, sendCheckoutOtp)
authRouter.post("/verify-checkout-otp", isAuth, authLimiter, verifyCheckoutOtp)
// Dev-only bypass — see setMobileWithoutOtp in auth.controllers.js for its two
// server-side safety checks (blocked in production, requires explicit
// SKIP_MOBILE_OTP=true in .env). Rate-limited the same as the real OTP endpoints.
authRouter.post("/set-mobile-no-otp", isAuth, authLimiter, setMobileWithoutOtp)

export default authRouter