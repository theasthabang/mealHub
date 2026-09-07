// Reusable validation middleware. Wraps a Zod schema so any route can opt in
// with one line: `router.post('/signup', validate(signUpSchema), signUp)`.
//
// Deliberately built as a small, reusable wrapper rather than adding manual
// `if (!field)` checks to each controller — that pattern already exists
// scattered across this codebase, and every occurrence of it is a place a
// check can be forgotten. A schema declares everything a route expects in
// one place, and this middleware enforces it consistently everywhere it's
// applied.
export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
        return res.status(400).json({
            message: "Invalid request",
            errors: result.error.issues.map(issue => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        })
    }

    // Zod's parsed output (result.data) is what actually passed validation —
    // using it instead of the raw req.body means any extra/unexpected fields
    // a client sent get stripped, not silently passed through to the controller.
    req.body = result.data
    next()
}