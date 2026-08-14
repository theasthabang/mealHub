import express from "express"
import dotenv from "dotenv"
dotenv.config()
import connectDb from "./config/db.js"
import cookieParser from "cookie-parser"
import authRouter from "./routes/auth.routes.js"
import cors from "cors"
import userRouter from "./routes/user.routes.js"
import multer from "multer"

import itemRouter from "./routes/item.routes.js"
import shopRouter from "./routes/shop.routes.js"
import orderRouter from "./routes/order.routes.js"
import http from "http"
import { Server } from "socket.io"
import { socketHandler } from "./socket.js"

const app = express()
const server = http.createServer(app)

// FIX (deployment readiness): both CORS origins were hardcoded to localhost — this
// now reads from CLIENT_URL, with the localhost value only as a dev-time fallback.
// Set CLIENT_URL in your production .env to your actual deployed frontend URL (e.g.
// https://your-app.vercel.app), or every cross-origin request (including the socket
// connection) will be rejected by the browser once this is deployed.
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173"

const io = new Server(server, {
    cors: {
        origin: clientUrl,
        credentials: true,
        methods: ['POST', 'GET']
    }
})

app.set("io", io)

// NEW (deployment readiness): most hosts (Render, Railway, Vercel, etc.) put your
// app behind a reverse proxy. Without trust proxy, Express doesn't know the original
// request was HTTPS — which breaks secure cookies (they'd never get set, since
// Express thinks the connection is plain HTTP) and gives req.ip the proxy's address
// instead of the real client's (breaking IP-based rate limiting below).
app.set("trust proxy", 1)

const port = process.env.PORT || 5000
app.use(cors({
    origin: clientUrl,
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/shop", shopRouter)
app.use("/api/item", itemRouter)
app.use("/api/order", orderRouter)

// NEW (Phase 3, #2 — stability): 404 handler for any route that doesn't match one of
// the routers above. Without this, an unmatched API route (typo'd endpoint, old
// frontend hitting a removed route, etc.) falls through to Express's default HTML
// 404 page instead of a clean JSON response the frontend can actually parse.
app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
})

// NEW (Phase 3, #2 — stability): global error-handling middleware. This is the safety
// net every controller's individual try/catch doesn't cover:
//   - Errors from middleware itself (e.g. multer's fileFilter rejecting a non-image,
//     or its fileSize limit being exceeded) call next(err) internally. Without this
//     handler, those currently fall through to Express's default error handler, which
//     returns an ugly HTML error page instead of JSON — something a fetch/axios client
//     can't parse cleanly.
//   - Any genuinely uncaught synchronous error anywhere in the request lifecycle.
// Must be defined with all 4 arguments (err, req, res, next) — that 4-arg signature is
// what tells Express "this is an error handler," and it must be the LAST app.use() call.
app.use((err, req, res, next) => {
    console.error(err)

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "File too large. Maximum size is 5MB." })
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` })
    }

    // multer's fileFilter passes a plain Error (not a MulterError) when it rejects a
    // non-image file
    if (err.message === "Only image files are allowed") {
        return res.status(400).json({ message: err.message })
    }

    if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message })
    }

    return res.status(500).json({ message: "Something went wrong on the server." })
})

// NEW (Phase 3, #2 — stability): last-resort safety nets. These don't replace fixing
// individual bugs (they're a log-and-carry-on measure, not a substitute for the
// try/catch coverage already in every controller), but they stop one truly unexpected
// error — a bug outside any try block, a rejected promise nobody awaited — from
// silently killing the entire Node process for every connected user at once. In
// production, pair this with a process manager (PM2, Docker restart policy, etc.) that
// restarts the process after a logged crash, rather than relying on this alone.
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Promise Rejection:", reason)
})
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err)
})

socketHandler(io)
server.listen(port, () => {
    connectDb()
    console.log(`server started at ${port}`)
})