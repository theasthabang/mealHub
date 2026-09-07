import { createClient } from "redis"

// One shared Redis connection for the whole backend, created once here and
// reused wherever a Redis-backed feature needs it — right now that's just the
// rate limiters, but the same client can back OTP storage or Socket.IO scaling
// later without adding a second connection.
//
// Why this matters: express-rate-limit's DEFAULT storage lives in each Node
// process's own memory. That breaks in two real ways —
//   1. Run more than one server (multiple Render instances, a load-balanced
//      EC2 setup) and each instance keeps its own separate count. Someone gets
//      20 signin attempts PER INSTANCE, not 20 total — the limit is trivially
//      bypassed by hitting different instances.
//   2. Every restart (a crash, nodemon reloading, a redeploy) wipes the counts
//      — anyone who was locked out after too many wrong delivery-OTP guesses
//      is instantly un-blocked for free.
// Redis fixes both: one shared counter outside any single Node process, that
// survives restarts and stays consistent across however many instances are
// running.
const redisClient = createClient({
    url: process.env.REDIS_URL
})

redisClient.on("error", (err) => {
    // A Redis hiccup shouldn't be able to crash the whole backend — this just
    // logs it. node-redis queues commands issued while the connection is down
    // and flushes them once it reconnects, so a brief blip self-heals; a
    // REDIS_URL that's simply wrong will keep logging this until it's fixed.
    console.error("Redis Client Error:", err.message)
})

// Fire-and-forget connect at module load — node-redis queues any commands
// issued before this resolves (rather than rejecting them), so the very first
// request right after server startup doesn't need to wait for this explicitly.
redisClient.connect()
    .then(() => console.log("Redis connected"))
    .catch((err) => console.error("Redis connection failed:", err.message))

export default redisClient