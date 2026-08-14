import jwt from "jsonwebtoken"

// FIX (Phase 3, #4 — silent failure): the old catch block just did `console.log(error)`
// with no return and no throw, meaning a failed jwt.sign() silently returned `undefined`.
// Every caller (signUp, signIn, googleAuth) then did `res.cookie("token", undefined, ...)`
// and still returned a 200/201 with the user's data — the client would look successfully
// logged in, but every subsequent request would fail isAuth with an invalid token, and
// there'd be no clear error anywhere pointing at the real cause. Throwing here instead
// lets the caller's own try/catch (which already wraps every genToken call) catch it and
// return a proper 500.
const genToken = async (userId) => {
    try {
        const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" })
        return token
    } catch (error) {
        throw new Error(`Failed to generate auth token: ${error.message}`)
    }
}

export default genToken