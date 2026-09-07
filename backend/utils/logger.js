import pino from "pino"

// Structured logging, replacing scattered console.log/console.error calls.
// In development this pretty-prints to the terminal (readable, colorized);
// in production it emits plain JSON lines — the shape most log-aggregation
// services (Render's own log viewer included) expect, so entries stay
// searchable and filterable by level instead of being an undifferentiated
// wall of text.
const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined
})

export default logger