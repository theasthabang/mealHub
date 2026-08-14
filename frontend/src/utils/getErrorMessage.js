// Shared helper so every catch block shows a consistent, useful message instead of
// repeating `error?.response?.data?.message || "..."` (or just console.log(error))
// in 25 different places with slightly different fallback text each time.
export const getErrorMessage = (error) => {
  return error?.response?.data?.message || "Something went wrong. Please try again."
}