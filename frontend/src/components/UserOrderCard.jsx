import axios from 'axios'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import toast from 'react-hot-toast'
import { serverUrl } from '../App'
import { cancelOrderStatus, setItemRating } from '../redux/userSlice'
import { getErrorMessage } from '../utils/getErrorMessage'

// NEW: shown as a dropdown when the customer starts the cancel flow
const CANCEL_REASONS = [
    "Changed my mind",
    "Ordering from somewhere else",
    "Delivery is taking too long",
    "Added by mistake",
    "Other"
]

function UserOrderCard({ data }) {
    const navigate = useNavigate()
    const dispatch = useDispatch()

    // NEW: tracks which shopOrder (by _id) is currently mid-cancel-flow, and the
    // reason picked for it, so multiple shop-orders in one card don't interfere
    const [cancellingShopOrderId, setCancellingShopOrderId] = useState(null)
    const [cancelReason, setCancelReason] = useState("")
    const [cancelling, setCancelling] = useState(false)

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('en-GB', {
            day: "2-digit",
            month: "short",
            year: "numeric"
        })
    }

    // FIX (rating resets after refetch/remount): previously stored the selected
    // stars in local component state (selectedRating), keyed only by itemId — that
    // state has no idea an order was already rated once this component remounts
    // (navigating away and back, or myOrders refetching), so already-rated items
    // silently went back to unselected stars. userRating is now read directly off
    // each shopOrderItem, which persists it on the order in the database (see
    // order.model.js / item.controllers.js), so it survives exactly those cases.
    const handleRating = async (shopId, itemId, rating) => {
        try {
            const result = await axios.post(`${serverUrl}/api/item/rating`, {
                orderId: data._id, shopId, itemId, rating
            }, { withCredentials: true })
            dispatch(setItemRating({ orderId: data._id, shopId, itemId, rating: result.data.userRating }))
            toast.success("Thanks for rating!")
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    // NEW: calls the cancel endpoint, then updates Redux so the UI reflects it
    // immediately without waiting for a refetch
    const handleConfirmCancel = async (shopId) => {
        if (!cancelReason) return
        setCancelling(true)
        try {
            await axios.post(`${serverUrl}/api/order/cancel/${data._id}/${shopId}`, { reason: cancelReason }, { withCredentials: true })
            dispatch(cancelOrderStatus({ orderId: data._id, shopId, cancelReason }))
            toast.success("Order cancelled")
            setCancellingShopOrderId(null)
            setCancelReason("")
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setCancelling(false)
        }
    }

    const statusColor = (status) => {
        if (status === "cancelled") return "text-red-500"
        if (status === "delivered") return "text-green-600"
        return "text-blue-600"
    }

    return (
        <div className='bg-white rounded-lg shadow p-4 space-y-4'>
            <div className='flex justify-between border-b pb-2'>
                <div>
                    <p className='font-semibold'>
                        order #{data._id.slice(-6)}
                    </p>
                    <p className='text-sm text-gray-500'>
                        Date: {formatDate(data.createdAt)}
                    </p>
                </div>
                <div className='text-right'>
                    {data.paymentMethod == "cod" ? <p className='text-sm text-gray-500'>{data.paymentMethod?.toUpperCase()}</p> : <p className='text-sm text-gray-500 font-semibold'>Payment: {data.payment ? "true" : "false"}</p>}
                    <p className={`font-medium ${statusColor(data.shopOrders?.[0].status)}`}>{data.shopOrders?.[0].status}</p>
                </div>
            </div>

            {data.shopOrders.map((shopOrder, index) => (
                <div className='border rounded-lg p-3 bg-[#fffaf7] space-y-3' key={index}>
                    <p>{shopOrder.shop.name}</p>

                    <div className='flex space-x-4 overflow-x-auto pb-2'>
                        {shopOrder.shopOrderItems.map((item, itemIndex) => (
                            <div key={itemIndex} className='flex-shrink-0 w-40 border rounded-lg p-2 bg-white'>
                                <img src={item.item.image} alt="" className='w-full h-24 object-cover rounded' />
                                <p className='text-sm font-semibold mt-1'>{item.name}</p>
                                <p className='text-xs text-gray-500'>Qty: {item.quantity} x ₹{item.price}</p>

                                {shopOrder.status == "delivered" && <div className='flex space-x-1 mt-2'>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button key={star} className={`text-lg ${item.userRating >= star ? 'text-yellow-400' : 'text-gray-400'}`} onClick={() => handleRating(shopOrder.shop._id, item.item._id, star)}>★</button>
                                    ))}
                                </div>}
                            </div>
                        ))}
                    </div>

                    <div className='flex justify-between items-center border-t pt-2'>
                        <p className='font-semibold'>Subtotal: {shopOrder.subtotal}</p>
                        <span className={`text-sm font-medium ${statusColor(shopOrder.status)}`}>{shopOrder.status}</span>
                    </div>

                    {/* NEW: cancellation UI — only offered while status is "pending" */}
                    {shopOrder.status == "pending" && (
                        cancellingShopOrderId === (shopOrder._id || index) ? (
                            <div className='p-3 bg-red-50 border border-red-100 rounded-lg space-y-2'>
                                <label className='text-xs font-medium text-gray-700 block'>Why are you cancelling?</label>
                                <select
                                    className='w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300'
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                >
                                    <option value="">Select a reason</option>
                                    {CANCEL_REASONS.map((r, i) => (
                                        <option key={i} value={r}>{r}</option>
                                    ))}
                                </select>
                                <div className='flex gap-2'>
                                    <button
                                        className='flex-1 bg-red-500 text-white text-sm py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed'
                                        disabled={!cancelReason || cancelling}
                                        onClick={() => handleConfirmCancel(shopOrder.shop._id)}
                                    >
                                        {cancelling ? "Cancelling..." : "Confirm Cancellation"}
                                    </button>
                                    <button
                                        className='flex-1 border text-sm py-1.5 rounded-lg hover:bg-gray-50'
                                        onClick={() => { setCancellingShopOrderId(null); setCancelReason("") }}
                                    >
                                        Keep Order
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                className='text-sm text-red-500 font-medium hover:underline'
                                onClick={() => setCancellingShopOrderId(shopOrder._id || index)}
                            >
                                Cancel Order
                            </button>
                        )
                    )}

                    {shopOrder.status == "cancelled" && shopOrder.cancelReason && (
                        <p className='text-xs text-gray-500'>Reason: {shopOrder.cancelReason}</p>
                    )}
                </div>
            ))}

            {/* NEW: once every shop-order in this whole order is either delivered or
                cancelled, there's genuinely nothing left to track — the live map on
                TrackOrderPage only ever renders while a shopOrder is still in
                transit anyway (see TrackOrderPage.jsx), so clicking through was
                always a dead end once fully delivered. Same disabled+dimmed
                treatment already used for "Sold Out" items in FoodCard.jsx, for
                visual consistency. */}
            <div className='flex justify-between items-center border-t pt-2'>
                <p className='font-semibold'>Total: ₹{data.totalAmount}</p>
                {(() => {
                    const isFullyFinished = data.shopOrders.every(so => so.status === "delivered" || so.status === "cancelled")
                    return (
                        <button
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${isFullyFinished
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-[#ff4d2d] hover:bg-[#e64526] text-white"
                                }`}
                            disabled={isFullyFinished}
                            onClick={() => { if (!isFullyFinished) navigate(`/track-order/${data._id}`) }}
                        >
                            {isFullyFinished ? "Delivered" : "Track Order"}
                        </button>
                    )
                })()}
            </div>
        </div>
    )
}

export default UserOrderCard