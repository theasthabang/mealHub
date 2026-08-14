import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { FaWallet, FaBoxOpen, FaChartLine, FaShoppingBasket } from "react-icons/fa"
import { serverUrl } from '../App'
import { getErrorMessage } from '../utils/getErrorMessage'

const RANGE_OPTIONS = [
    { label: "7 Days", value: 7 },
    { label: "30 Days", value: 30 },
    { label: "90 Days", value: 90 },
]

// LAYOUT REDESIGN (dashboard density pass): all fetch logic below (fetchAnalytics,
// useEffect, formatDateLabel) is untouched from before — only the returned JSX
// structure changed. Previously this rendered one big boxed panel containing the
// filter row, summary cards, revenue chart, and best-sellers list all stacked
// vertically inside a single <div>. That's what was eating so much vertical space.
//
// Now it renders two separate, top-level pieces:
//   1. A standalone 4-card stat row (their own individual cards, not nested inside a
//      bigger box) — this is what OwnerDashboard.jsx places directly under the shop
//      header, per "place four analytics cards directly below the shop card."
//   2. A single analytics panel below that, with the revenue chart and best-sellers
//      list side by side (grid-cols-2 on desktop) instead of stacked — this is what
//      turns two tall vertical blocks into one shorter horizontal row.
// The days-filter chips stay attached to this component's own header since changing
// them affects BOTH the stat cards and the charts (same `days` query param drives
// both) — keeping the filter here, rather than splitting it off into
// OwnerDashboard.jsx, keeps that dependency obvious instead of hidden.
function OwnerAnalytics() {
    const [days, setDays] = useState(7)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const fetchAnalytics = async () => {
        setLoading(true)
        setError(false)
        try {
            const result = await axios.get(`${serverUrl}/api/order/owner-analytics?days=${days}`, { withCredentials: true })
            setData(result.data)
        } catch (err) {
            setError(true)
            toast.error(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnalytics()
    }, [days])

    const formatDateLabel = (dateStr) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    }

    if (loading) {
        return (
            <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center justify-center py-10'>
                <div className='w-8 h-8 border-4 border-[#ff4d2d] border-t-transparent rounded-full animate-spin mb-3' />
                <p className='text-gray-500 text-sm'>Loading analytics...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center justify-center py-10 text-center'>
                <p className='text-gray-500 text-sm mb-2'>Couldn't load analytics right now.</p>
                <button onClick={fetchAnalytics} className='text-sm text-[#ff4d2d] font-medium hover:underline'>Try again</button>
            </div>
        )
    }

    const isEmpty = data?.summary.totalOrders === 0

    return (
        // Reduced from mb-5/mb-6/gap-6-style spacing throughout this file down to a
        // consistent gap-4/gap-5, per the spacing requirement.
        <div className='flex flex-col gap-4'>
            {/* Filter row — sits above both the stat cards and the charts panel below,
                since `days` drives both */}
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                <h2 className='text-base font-bold text-gray-800'>Analytics Overview</h2>
                <div className='flex gap-2'>
                    {RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setDays(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${days === opt.value
                                ? "bg-[#ff4d2d] text-white border-[#ff4d2d]"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#ff4d2d]"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {isEmpty ? (
                <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center justify-center py-10 text-center'>
                    <div className='bg-orange-100 p-4 rounded-full mb-3'>
                        <FaBoxOpen className='text-[#ff4d2d] w-7 h-7' />
                    </div>
                    <p className='text-gray-700 font-semibold mb-1'>No delivered orders yet</p>
                    <p className='text-gray-400 text-sm'>Analytics will show up here once orders start getting delivered.</p>
                </div>
            ) : (
                <>
                    {/* Stat cards: standalone row, each card is its own top-level
                        white card now (was nested inside the big analytics box
                        before) — this is what "directly below the shop card" needs
                        to visually read as its own dashboard section. */}
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                        <StatCard icon={<FaWallet />} label="Total Revenue" value={`₹${data.summary.totalRevenue}`} />
                        <StatCard icon={<FaBoxOpen />} label="Delivered Orders" value={data.summary.totalOrders} />
                        <StatCard icon={<FaChartLine />} label="Avg. Order Value" value={`₹${data.summary.averageOrderValue}`} />
                        <StatCard icon={<FaShoppingBasket />} label="Items Sold" value={data.summary.totalItemsSold} />
                    </div>

                    {/* Charts panel: revenue trend + best sellers SIDE BY SIDE on
                        desktop (lg:grid-cols-2), stacked on tablet/mobile. This is
                        the main space-saving change — two ~220px-tall stacked
                        sections became one ~220px-tall row. */}
                    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4'>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
                            <div>
                                <h3 className='text-sm font-semibold text-gray-700 mb-2'>Revenue Over Time</h3>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={data.revenueOverTime}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip labelFormatter={formatDateLabel} formatter={(value) => [`₹${value}`, "Revenue"]} />
                                        <Line type="monotone" dataKey="revenue" stroke="#ff4d2d" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div>
                                <h3 className='text-sm font-semibold text-gray-700 mb-2'>Best Selling Items</h3>
                                {data.bestSellingItems.length === 0 ? (
                                    <p className='text-sm text-gray-400'>No items sold in this period.</p>
                                ) : (
                                    <div className='space-y-2.5 max-h-[200px] overflow-y-auto pr-1'>
                                        {data.bestSellingItems.map((item, index) => {
                                            const maxQty = data.bestSellingItems[0].quantitySold || 1
                                            const widthPct = Math.max((item.quantitySold / maxQty) * 100, 6)
                                            return (
                                                <div key={index}>
                                                    <div className='flex justify-between text-xs mb-1'>
                                                        <span className='font-medium text-gray-800 truncate pr-2'>{item.itemName}</span>
                                                        <span className='text-gray-500 flex-shrink-0'>{item.quantitySold} sold · ₹{item.revenue.toFixed(0)}</span>
                                                    </div>
                                                    <div className='w-full bg-gray-100 rounded-full h-1.5'>
                                                        <div className='bg-[#ff4d2d] h-1.5 rounded-full transition-all' style={{ width: `${widthPct}%` }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({ icon, label, value }) {
    // Restyled as a genuine standalone KPI card (bg-white + its own shadow/border)
    // instead of a muted sub-card nested inside a bigger box — matches the "modern
    // SaaS dashboard, rounded-xl, light shadow" look of Shopify Admin / Swiggy
    // Partner style stat cards.
    return (
        <div className='bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 flex flex-col gap-1'>
            <div className='text-[#ff4d2d] text-sm'>{icon}</div>
            <div className='text-lg font-bold text-gray-800 truncate'>{value}</div>
            <div className='text-xs text-gray-500'>{label}</div>
        </div>
    )
}

export default OwnerAnalytics