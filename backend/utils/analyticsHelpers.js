// Shared helpers for owner + delivery-boy analytics, so the "group by day and fill
// in missing dates so the chart has no gaps" logic isn't duplicated in both
// controllers.

// Normalizes any Date to a "YYYY-MM-DD" string key, used to group records by day.
export const dateKey = (date) => {
    const d = new Date(date)
    return d.toISOString().split("T")[0]
}

// Returns an array of "YYYY-MM-DD" strings for the trailing `days` days, oldest
// first, INCLUDING today. Used to pre-fill a revenue/earnings chart with zeroes for
// any day that had no orders, so the line chart doesn't jump straight from one data
// point to the next with a gap in between.
export const buildTrailingDateKeys = (days) => {
    const keys = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        keys.push(dateKey(d))
    }
    return keys
}

// Returns the Date marking the start of the trailing `days`-day window (used as a
// $gte filter in Mongo queries).
export const getStartDate = (days) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    return start
}

// Merges a { "YYYY-MM-DD": number } totals map into a zero-filled, ordered array of
// { date, value } for charting — every day in the range appears, even ones with 0.
export const fillDateSeries = (days, totalsByDate, valueKey) => {
    const keys = buildTrailingDateKeys(days)
    return keys.map(date => ({
        date,
        [valueKey]: Number((totalsByDate[date] || 0).toFixed(2))
    }))
}