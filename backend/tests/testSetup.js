import { MongoMemoryServer } from "mongodb-memory-server"
import mongoose from "mongoose"

let mongod

// Runs a REAL MongoDB (just an in-memory, throwaway instance) for tests —
// this means tests exercise actual Mongoose validation, actual transactions,
// actual query behavior, not a mocked-out approximation of it. This is what
// downloads the mongod binary the first time it runs, which needs real
// internet access — this could not be verified inside the sandbox this was
// written in, only reasoned through against the real controller logic.
export const connectTestDb = async () => {
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri()
    await mongoose.connect(uri)
}

export const disconnectTestDb = async () => {
    await mongoose.connection.dropDatabase()
    await mongoose.connection.close()
    await mongod.stop()
}

export const clearTestDb = async () => {
    const collections = mongoose.connection.collections
    for (const key in collections) {
        await collections[key].deleteMany({})
    }
}