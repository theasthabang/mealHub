import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
// FIX (dead code): removed unused `{ hash }` named import — bcrypt.hash is called via
// the default export everywhere in this file, the named import was never used
import genToken from "../utils/token.js"
import { sendOtpMail } from "../utils/mail.js"
import { sendSmsOtp } from "../utils/sms.js"
import crypto from "crypto"

// NEW (deployment readiness): the cookie config was hardcoded `secure: false` and
// `sameSite: "strict"` everywhere — fine on localhost, broken in production. Two
// real problems this fixes:
//   1. `secure: false` means the cookie is sent over plain HTTP. Most hosts
//      (Render, Railway, Vercel) serve over HTTPS, and browsers increasingly refuse
//      to even set/send cookies marked insecure on an HTTPS page.
//   2. `sameSite: "strict"` blocks the cookie entirely in the extremely common
//      deployment shape where frontend and backend live on different domains (e.g.
//      Vercel for the frontend, Render for the backend) — the browser won't attach
//      a "strict" cookie to a cross-site request at all, so every authenticated
//      request would silently fail post-deploy even though login itself "succeeds."
// This single helper is reused everywhere a cookie is set OR cleared, so all four
// call sites can't drift out of sync with each other — clearCookie in particular
// only actually clears a cookie if its options match what was used to set it.
const isProduction = process.env.NODE_ENV === "production"
const getCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
})

export const signUp = async (req, res) => {
    try {
        const { fullName, email, password, mobile, role } = req.body
        let user = await User.findOne({ email })
        if (user) {
            return res.status(400).json({ message: "User Already exist." })
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "password must be at least 6 characters." })
        }
        if (mobile.length < 10) {
            return res.status(400).json({ message: "mobile no must be at least 10 digits." })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        user = await User.create({
            fullName,
            email,
            role,
            mobile,
            password: hashedPassword
        })

        const token = await genToken(user._id)
        res.cookie("token", token, getCookieOptions())

        return res.status(201).json(user)

    } catch (error) {
        return res.status(500).json({ message: `sign up error: ${error.message}` })
    }
}

export const signIn = async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: "User does not exist." })
        }

        // FIX (Phase 2, #5): a user who signed up via Google has no `password` field
        // (it's not `required` in the schema, correctly, since Google auth never sets
        // one). Without this check, bcrypt.compare(password, undefined) throws, which
        // was landing in the catch block as a raw 500 instead of a clear message.
        if (!user.password) {
            return res.status(400).json({ message: "This account uses Google sign-in. Please continue with Google." })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: "incorrect Password" })
        }

        const token = await genToken(user._id)
        res.cookie("token", token, getCookieOptions())

        return res.status(200).json(user)

    } catch (error) {
        return res.status(500).json({ message: `sign in error: ${error.message}` })
    }
}

export const signOut = async (req, res) => {
    try {
        res.clearCookie("token", getCookieOptions())
        return res.status(200).json({ message: "log out successfully" })
    } catch (error) {
        return res.status(500).json({ message: `sign out error: ${error.message}` })
    }
}

export const sendOtp = async (req, res) => {
    try {
        const { email } = req.body
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: "User does not exist." })
        }
        const otp = Math.floor(1000 + Math.random() * 9000).toString()
        user.resetOtp = otp
        user.otpExpires = Date.now() + 5 * 60 * 1000
        user.isOtpVerified = false
        await user.save()
        await sendOtpMail(email, otp)
        return res.status(200).json({ message: "otp sent successfully" })
    } catch (error) {
        return res.status(500).json({ message: `send otp error: ${error.message}` })
    }
}

export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body
        const user = await User.findOne({ email })
        if (!user || user.resetOtp != otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "invalid/expired otp" })
        }
        user.isOtpVerified = true
        user.resetOtp = undefined
        user.otpExpires = undefined
        await user.save()
        return res.status(200).json({ message: "otp verify successfully" })
    } catch (error) {
        return res.status(500).json({ message: `verify otp error: ${error.message}` })
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body
        const user = await User.findOne({ email })
        if (!user || !user.isOtpVerified) {
            return res.status(400).json({ message: "otp verification required" })
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword
        user.isOtpVerified = false
        await user.save()
        return res.status(200).json({ message: "password reset successfully" })
    } catch (error) {
        return res.status(500).json({ message: `reset password error: ${error.message}` })
    }
}

export const googleAuth = async (req, res) => {
    try {
        const { fullName, email, mobile, role } = req.body
        let user = await User.findOne({ email })
        if (!user) {
            // FIX (rebuilt flow): SignIn.jsx's Google button only ever sends
            // { email } — no fullName/role at all, since Sign In shouldn't be
            // collecting new-account info. If we don't even have those, there's
            // truly no way to create an account here — tell the user to sign up.
            if (!fullName || !role) {
                return res.status(400).json({ message: "No account found for this email. Please sign up first." })
            }
            // NEW: SignUp.jsx's Google button now calls this endpoint immediately
            // after the Google popup succeeds — before asking for mobile, since
            // Google's own OAuth data never includes a phone number. On this first
            // call we have fullName + role (from Google + the page's role picker)
            // but not mobile yet. Instead of failing, tell the frontend exactly
            // what's still needed so it can show a quick follow-up step, rather
            // than blocking the whole Google popup behind a pre-filled form field.
            if (!mobile) {
                return res.status(200).json({ needsMobile: true, email, fullName })
            }
            user = await User.create({
                fullName, email, mobile, role
            })
        }

        const token = await genToken(user._id)
        res.cookie("token", token, getCookieOptions())

        return res.status(200).json(user)


    } catch (error) {
        return res.status(500).json({ message: `googleAuth error: ${error.message}` })
    }
}

const MOBILE_REGEX = /^[6-9]\d{9}$/ // Indian 10-digit mobile numbers, consistent with the rest of this app

// NEW: checkout-time mobile OTP — send step. Protected by isAuth (see auth.routes.js),
// so `req.userId` is always the actual logged-in user; this never trusts a userId from
// the request body, which is what "the backend must verify that the authenticated
// user is the one requesting the verification" actually means in practice.
export const sendCheckoutOtp = async (req, res) => {
    try {
        const { mobileNumber } = req.body
        if (!mobileNumber || !MOBILE_REGEX.test(mobileNumber)) {
            return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." })
        }

        const user = await User.findById(req.userId)
        if (!user) {
            return res.status(400).json({ message: "User not found." })
        }

        // Rate limit: max 3 sends per 10-minute window per user, so a real SMS
        // provider (which costs money per message) can't be spammed
        const now = Date.now()
        const windowMs = 10 * 60 * 1000
        if (user.mobileOtpWindowStart && now - user.mobileOtpWindowStart.getTime() < windowMs) {
            if (user.mobileOtpSendCount >= 3) {
                return res.status(429).json({ message: "Too many OTP requests. Please try again in a few minutes." })
            }
            user.mobileOtpSendCount += 1
        } else {
            user.mobileOtpWindowStart = new Date(now)
            user.mobileOtpSendCount = 1
        }

        // Secure random 6-digit OTP — crypto.randomInt, not Math.random
        const otp = crypto.randomInt(100000, 999999).toString()
        const otpHash = await bcrypt.hash(otp, 10)

        user.mobileOtpHash = otpHash
        user.mobileOtpExpires = new Date(now + 5 * 60 * 1000)
        user.mobileOtpAttempts = 0 // reset brute-force counter for the new OTP
        await user.save()

        try {
            await sendSmsOtp(mobileNumber, otp)
        } catch (smsError) {
            // FIX: this was swallowing the real error completely — nothing logged
            // server-side, nothing in the response beyond a generic message. That
            // made it impossible to tell "SMS provider isn't configured" apart from "wrong
            // credentials" apart from any other real failure.
            // other real failure. Logging the actual error now so it's visible in
            // the backend terminal.
            console.error("SMS send error:", smsError.message)
            return res.status(500).json({ message: "Failed to send OTP. Please try again." })
        }

        return res.status(200).json({ message: "OTP sent successfully." })
    } catch (error) {
        return res.status(500).json({ message: `send checkout otp error: ${error.message}` })
    }
}

// NEW: checkout-time mobile OTP — verify step.
export const verifyCheckoutOtp = async (req, res) => {
    try {
        const { mobileNumber, otp } = req.body
        if (!mobileNumber || !otp) {
            return res.status(400).json({ message: "Mobile number and OTP are required." })
        }

        const user = await User.findById(req.userId)
        if (!user) {
            return res.status(400).json({ message: "User not found." })
        }

        if (!user.mobileOtpHash || !user.mobileOtpExpires) {
            return res.status(400).json({ message: "Please request an OTP first." })
        }

        if (user.mobileOtpExpires.getTime() < Date.now()) {
            return res.status(400).json({ message: "OTP expired. Please request a new OTP." })
        }

        // Brute-force guard: 5 wrong attempts against the current OTP locks it out
        // until a new one is requested
        if (user.mobileOtpAttempts >= 5) {
            return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." })
        }

        const isMatch = await bcrypt.compare(otp, user.mobileOtpHash)
        if (!isMatch) {
            user.mobileOtpAttempts += 1
            await user.save()
            return res.status(400).json({ message: "Invalid OTP. Please try again." })
        }

        user.isMobileVerified = true
        user.verifiedMobile = mobileNumber
        user.mobileOtpHash = null
        user.mobileOtpExpires = null
        user.mobileOtpAttempts = 0
        await user.save()

        return res.status(200).json({ message: "Mobile number verified successfully.", isMobileVerified: true, verifiedMobile: mobileNumber })
    } catch (error) {
        return res.status(500).json({ message: `verify checkout otp error: ${error.message}` })
    }
}

// NEW: temporary bypass — takes the mobile number and marks it verified WITHOUT
// actually sending/checking an OTP. This exists purely to unblock local development
// while the real Twilio account is stuck behind trial restrictions (verified
// numbers, Content Template approval, all gated behind an upgrade). The real
// sendCheckoutOtp/verifyCheckoutOtp flow above is untouched and still fully working
// — the moment SKIP_MOBILE_OTP is removed from .env, the app goes straight back to
// requiring real OTP verification, no other code changes needed.
//
// Two independent safety checks, both server-side, neither trusting the frontend:
//   1. NODE_ENV === "production" hard-blocks this no matter what — this must never
//      be reachable on a real deployment, even by accident.
//   2. SKIP_MOBILE_OTP must be explicitly "true" in .env — it's not the default
//      behavior, someone has to deliberately turn it on.
export const setMobileWithoutOtp = async (req, res) => {
    try {
        if (process.env.NODE_ENV === "production") {
            return res.status(403).json({ message: "OTP verification is required." })
        }
        if (process.env.SKIP_MOBILE_OTP !== "true") {
            return res.status(403).json({ message: "OTP verification is required." })
        }

        const { mobileNumber } = req.body
        if (!mobileNumber || !MOBILE_REGEX.test(mobileNumber)) {
            return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." })
        }

        const user = await User.findById(req.userId)
        if (!user) {
            return res.status(400).json({ message: "User not found." })
        }

        user.isMobileVerified = true
        user.verifiedMobile = mobileNumber
        user.mobileOtpHash = null
        user.mobileOtpExpires = null
        user.mobileOtpAttempts = 0
        await user.save()

        // Same response shape as verifyCheckoutOtp above, on purpose — the frontend
        // doesn't need to know which path it went through.
        return res.status(200).json({ message: "Mobile number saved.", isMobileVerified: true, verifiedMobile: mobileNumber })
    } catch (error) {
        return res.status(500).json({ message: `set mobile without otp error: ${error.message}` })
    }
}