export default {
    testEnvironment: "node",
    // No transform — this project uses native ESM (import/export) directly,
    // so nothing needs transpiling. Jest's ESM support is run via the
    // --experimental-vm-modules Node flag (see the "test" script in
    // package.json), not through a Babel transform.
    transform: {},
    testMatch: ["**/tests/**/*.test.js"],
    // Individual tests spin up a real (in-memory) MongoDB, which can take a
    // few seconds on first run while the binary downloads — generous timeout
    // to avoid flaky failures on a slow connection.
    testTimeout: 30000
}