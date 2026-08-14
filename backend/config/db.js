import mongoose from "mongoose"

// FIX (deployment readiness): the original version logged "db error" and just gave
// up on a single failed connection attempt — Express still started and began
// accepting requests regardless, meaning early requests (like the ones you just hit)
// fail with confusing 10-second buffering timeouts instead of a clear "database
// unavailable" state. Real-world causes this actually happens for: an Atlas free-tier
// cluster that's auto-paused from inactivity, a brief network blip, or the database
// simply taking a few seconds longer to wake up than the app takes to boot. A few
// retries with a short delay covers all of these without needing a process manager
// to restart the whole app just to try again.
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 5000

const connectDb = async (attempt = 1) => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("db connected")
    } catch (error) {
        console.log(`db connection error (attempt ${attempt}/${MAX_RETRIES}):`, error.message)
        if (attempt < MAX_RETRIES) {
            setTimeout(() => connectDb(attempt + 1), RETRY_DELAY_MS)
        } else {
            console.error("db connection failed after maximum retries. Check MONGODB_URL, Atlas cluster status, and IP whitelist.")
        }
    }
}

export default connectDb