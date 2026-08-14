import jwt from "jsonwebtoken"

// FIX (Phase 2, #3): every failure here — no token, malformed decode, and (critically)
// an EXPIRED token — previously returned 500. A 500 tells the frontend "something broke
// on the server," not "please log in again," so an expired session just surfaced as a
// generic error toast on whatever action the user happened to try next. All auth
// failures now return 401 consistently. A frontend axios interceptor that redirects to
// /signin on any 401 is still a Phase 4 item, not yet built — this file only makes that
// possible by giving it a consistent status code to watch for.
const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token
        if (!token) {
            return res.status(401).json({ message: "Not authenticated. Please log in." })
        }
        const decodeToken = jwt.verify(token, process.env.JWT_SECRET)
        if (!decodeToken) {
            return res.status(401).json({ message: "Invalid session. Please log in again." })
        }
        req.userId = decodeToken.userId
        next()
    } catch (error) {
        // jwt.verify throws TokenExpiredError / JsonWebTokenError for expired or
        // tampered tokens — both are auth failures, not server failures
        return res.status(401).json({ message: "Session expired or invalid. Please log in again." })
    }
}

export default isAuth