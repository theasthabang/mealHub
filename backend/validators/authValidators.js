import { z } from "zod"

// Applied to the auth routes as the worked example of this validation
// pattern — these are the highest-risk endpoints to start with (anyone,
// unauthenticated, can hit them). Extend this same pattern to other routers
// (item, shop, order) as a follow-up, rather than retrofitting the entire
// API in one pass — each new schema is a small, independent, low-risk
// addition, not a rewrite.

const MOBILE_REGEX = /^[6-9]\d{9}$/ // Indian 10-digit mobile numbers, matches the regex already used server-side elsewhere in this app

export const signUpSchema = z.object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    mobile: z.string().regex(MOBILE_REGEX, "Please enter a valid 10-digit mobile number"),
    role: z.enum(["user", "owner", "deliveryBoy"], { message: "Role must be user, owner, or deliveryBoy" })
})

export const signInSchema = z.object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required")
})

export const sendOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address")
})

export const verifyOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    otp: z.string().min(4, "Please enter the OTP")
})

export const resetPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    newPassword: z.string().min(6, "Password must be at least 6 characters")
})

export const googleAuthSchema = z.object({
    idToken: z.string().min(1, "Google authentication token is missing"),
    mobile: z.string().regex(MOBILE_REGEX, "Please enter a valid 10-digit mobile number").optional(),
    role: z.enum(["user", "owner", "deliveryBoy"]).optional()
})