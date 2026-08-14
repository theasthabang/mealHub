// NEW: WhatsApp OTP delivery via Twilio's WhatsApp Sandbox, replacing plain SMS.
// Two real reasons for this switch, not just "trying something new":
//   1. WhatsApp messages don't travel over the traditional SMS/telecom network, so
//      India's DLT regulation (which was blocking the MSG91 path) doesn't apply here.
//   2. Twilio's WhatsApp Sandbox works on a free trial account WITHOUT the
//      "verified caller ID" restriction that was blocking the plain-SMS Twilio path —
//      recipients opt in once by messaging the sandbox themselves (see below), and
//      after that you can message them freely.
//
// Kept the function name `sendSmsOtp` and this file's name (sms.js) unchanged on
// purpose — auth.controllers.js imports it by that name and doesn't need to change
// at all, exactly like the earlier Twilio<->MSG91 swap. Only the implementation
// underneath moved from SMS to WhatsApp.
//
// Uses Twilio's plain REST API directly via Node's built-in `fetch` + Basic Auth —
// no `twilio` SDK package needed, consistent with how the MSG91 version avoided a
// new dependency too.

// ⚠️ REQUIRED ONE-TIME STEP, per recipient, before this will work: in the WhatsApp
// app on the phone you're testing with, send a message to Twilio's sandbox number
// with the join code shown in your Twilio Console (Messaging → Try it out →
// Send a WhatsApp message) — something like "join <two-words>". That's Twilio's
// sandbox opt-in; without it, messages to that number will silently fail. This is a
// one-time step per phone number, not per test.

const getTwilioConfig = () => {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
        throw new Error("WhatsApp provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in your .env file.")
    }
    return {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        // Twilio's sandbox number, e.g. "+14155238886" — NOT prefixed with
        // "whatsapp:" in the env var itself; that prefix is added below.
        fromNumber: process.env.TWILIO_WHATSAPP_FROM
    }
}

export const sendSmsOtp = async (mobile, otp) => {
    const { accountSid, authToken, fromNumber } = getTwilioConfig()

    const mobileWithCountryCode = mobile.startsWith("91") ? mobile : `91${mobile}`
    const to = `whatsapp:+${mobileWithCountryCode}`
    const from = `whatsapp:${fromNumber}`

    const body = new URLSearchParams({
        From: from,
        To: to,
        Body: `Your Vingo verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`
    })

    // Twilio's REST API uses HTTP Basic Auth (Account SID as username, Auth Token as
    // password) — Buffer.from/base64 is Node's built-in, no extra dependency needed.
    const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64")

    const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        }
    )

    const data = await response.json()

    if (!response.ok) {
        // Twilio's error responses include a human-readable `message` field —
        // surfacing it directly makes the server log actually diagnosable, same
        // principle as the console.error fix from earlier.
        throw new Error(data.message || "Failed to send WhatsApp OTP via Twilio")
    }
}