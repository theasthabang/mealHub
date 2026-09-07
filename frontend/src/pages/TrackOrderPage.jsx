import axios from 'axios'
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { serverUrl } from '../App'
import { useEffect } from 'react'
import { useState } from 'react'
import { IoIosArrowRoundBack } from "react-icons/io";
import { FaBoxOpen } from "react-icons/fa";
import toast from 'react-hot-toast'
import DeliveryBoyTracking from '../components/DeliveryBoyTracking'
import { useSelector } from 'react-redux'

function TrackOrderPage() {
    const { orderId } = useParams()
    const [currentOrder, setCurrentOrder] = useState()
    // NEW (Phase 4 — loading/empty states): distinguishes "still fetching" from
    // "fetched, but there's genuinely nothing to show" — previously both cases just
    // rendered a blank page below the header, which looks broken rather than loading.
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { socket } = useSelector(state => state.user)
    const [liveLocations, setLiveLocations] = useState({})

    const handleGetOrder = async () => {
        setLoading(true)
        try {
            const result = await axios.get(`${serverUrl}/api/order/get-order-by-id/${orderId}`, { withCredentials: true })
            setCurrentOrder(result.data)
        } catch (error) {
            toast.error("Could not load this order")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        socket?.on('updateDeliveryLocation', ({ deliveryBoyId, latitude, longitude }) => {
            setLiveLocations(prev => ({
                ...prev,
                [deliveryBoyId]: { lat: latitude, lon: longitude }
            }))
        })

        return () => {
            socket?.off('updateDeliveryLocation')
        }
    }, [socket])

    // NEW (privacy leak fix): location updates for this order only reach clients
    // who've explicitly joined its room — see socket.js's 'trackOrder' handler,
    // which independently re-checks (via the database) that this user is actually
    // allowed to see this order before letting the join succeed. Leaving the room
    // on unmount means navigating away stops this tab from receiving further
    // updates for an order it's no longer displaying.
    useEffect(() => {
        if (!socket || !orderId) return
        socket.emit('trackOrder', { orderId })
        return () => {
            socket.emit('stopTrackingOrder', { orderId })
        }
    }, [socket, orderId])

    useEffect(() => {
        handleGetOrder()
    }, [orderId])

    return (
        <div className='max-w-4xl mx-auto p-4 flex flex-col gap-6'>
            <div className='relative flex items-center gap-4 top-[20px] left-[20px] z-[10] mb-[10px]' onClick={() => navigate("/")}>
                <IoIosArrowRoundBack size={35} className='text-[#ff4d2d]' />
                <h1 className='text-2xl font-bold md:text-center'>Track Order</h1>
            </div>

            {loading ? (
                <div className='flex flex-col items-center justify-center py-16'>
                    <div className='w-10 h-10 border-4 border-[#ff4d2d] border-t-transparent rounded-full animate-spin mb-4' />
                    <p className='text-gray-500 text-sm'>Loading order details...</p>
                </div>
            ) : !currentOrder?.shopOrders?.length ? (
                <div className='flex flex-col items-center justify-center py-16 text-center'>
                    <div className='bg-orange-100 p-5 rounded-full mb-4'>
                        <FaBoxOpen className='text-[#ff4d2d] w-10 h-10' />
                    </div>
                    <p className='text-gray-700 font-semibold mb-1'>Order not found</p>
                    <p className='text-gray-400 text-sm mb-5'>We couldn't find details for this order.</p>
                    <button className='bg-[#ff4d2d] hover:bg-[#e64526] text-white px-5 py-2 rounded-lg text-sm font-medium' onClick={() => navigate("/my-orders")}>
                        Back to My Orders
                    </button>
                </div>
            ) : (
                currentOrder.shopOrders.map((shopOrder, index) => (
                    <div className='bg-white p-4 rounded-2xl shadow-md border border-orange-100 space-y-4' key={index}>
                        <div>
                            <p className='text-lg font-bold mb-2 text-[#ff4d2d]'>{shopOrder.shop.name}</p>
                            <p className='font-semibold'><span>Items:</span> {shopOrder.shopOrderItems?.map(i => i.name).join(",")}</p>
                            <p><span className='font-semibold'>Subtotal:</span> {shopOrder.subtotal}</p>
                            <p className='mt-6'><span className='font-semibold'>Delivery address:</span> {currentOrder.deliveryAddress?.text}</p>
                        </div>
                        {shopOrder.status != "delivered" ? <>
                            {shopOrder.assignedDeliveryBoy ?
                                <div className='text-sm text-gray-700'>
                                    <p className='font-semibold'><span>Delivery Boy Name:</span> {shopOrder.assignedDeliveryBoy.fullName}</p>
                                    <p className='font-semibold'><span>Delivery Boy contact No.:</span> {shopOrder.assignedDeliveryBoy.mobile}</p>
                                </div> : <p className='font-semibold'>Delivery Boy is not assigned yet.</p>}
                        </> : <p className='text-green-600 font-semibold text-lg'>Delivered</p>}

                        {(shopOrder.assignedDeliveryBoy && shopOrder.status !== "delivered") && (() => {
                            // FIX: User.location.coordinates defaults to [0, 0] in the
                            // schema until the delivery boy's app sends its first real
                            // GPS fix. Rendering the map with that default previously
                            // showed the delivery boy sitting off the coast of West
                            // Africa instead of communicating "location not available
                            // yet" — this checks for the real default explicitly.
                            const fallback = shopOrder.assignedDeliveryBoy.location?.coordinates
                            const hasRealFallback = fallback && (fallback[0] !== 0 || fallback[1] !== 0)
                            const liveLocation = liveLocations[shopOrder.assignedDeliveryBoy._id]
                            const resolvedLocation = liveLocation || (hasRealFallback ? { lat: fallback[1], lon: fallback[0] } : null)

                            if (!resolvedLocation) {
                                return (
                                    <div className="h-[200px] w-full rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                                        <p className='text-gray-400 text-sm'>Waiting for delivery partner's location...</p>
                                    </div>
                                )
                            }

                            return (
                                <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-md">
                                    <DeliveryBoyTracking data={{
                                        deliveryBoyLocation: resolvedLocation,
                                        customerLocation: {
                                            lat: currentOrder.deliveryAddress.latitude,
                                            lon: currentOrder.deliveryAddress.longitude
                                        }
                                    }} />
                                </div>
                            )
                        })()}
                    </div>
                ))
            )}
        </div>
    )
}

export default TrackOrderPage