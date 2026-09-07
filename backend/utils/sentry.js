import * as Sentry from "@sentry/node"

// Error tracking: every unhandled error currently only goes to structured
// logs (see logger.js), which is only visible if someone's actively watching
// them. Sentry catches unhandled exceptions in real time and surfaces them
// with a full stack trace and request context — the difference between
// finding out something broke because a customer emailed you, versus finding
// out the moment it happens.
//
// Requires SENTRY_DSN in .env — get this free from sentry.io (Node/Express
// project). initSentry() must be called BEFORE any routes are set up in
// index.js, and registerSentryErrorHandler() must be called AFTER all routes
// but BEFORE the existing global error-handling middleware — Sentry needs to
// see the error first to report it, then your own handler still runs to
// decide the actual HTTP response.
export const initSentry = () => {
    if (!process.env.SENTRY_DSN) {
        console.warn("SENTRY_DSN not set — error tracking is disabled. Set it in .env to enable Sentry.")
        return
    }
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.1 // captures 10% of transactions for performance monitoring — cheap way to avoid burning through Sentry's free-tier event quota
    })
}

export const registerSentryErrorHandler = (app) => {
    if (!process.env.SENTRY_DSN) return
    Sentry.setupExpressErrorHandler(app)
}

export default Sentry