import React from 'react'
import Nav from './Nav'
import { useSelector } from 'react-redux'
import axios from 'axios'
import { serverUrl } from '../App'
import { useEffect } from 'react'
import { useState } from 'react'
import DeliveryBoyTracking from './DeliveryBoyTracking'
import { ClipLoader } from 'react-spinners'
import toast from 'react-hot-toast'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FaWallet, FaBoxOpen, FaChartLine } from "react-icons/fa"
import { getErrorMessage } from '../utils/getErrorMessage'

function DeliveryBoy() {
  const { userData, socket } = useSelector(state => state.user)
  const [currentOrder, setCurrentOrder] = useState()
  const [showOtpBox, setShowOtpBox] = useState(false)
  const [availableAssignments, setAvailableAssignments] = useState(null)
  const [otp, setOtp] = useState("")
  const [todayDeliveries, setTodayDeliveries] = useState([])
  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState(null)
  const [loading, setLoading] = useState(false)

  // FIX (broken/incomplete function call): the original watchPosition call had its
  // success callback, error callback, and options object separated by commas OUTSIDE
  // the function call — `watchPosition((pos)=>{...}), (error)=>{...}, {enableHighAccuracy:true}`.
  // Only the first argument was ever actually passed to watchPosition; the error callback
  // and enableHighAccuracy option were dead, unreachable expressions. Also fixed a missing
  // closing brace on the `if (navigator.geolocation)` block.
  useEffect(() => {
    if (!socket || userData.role !== "deliveryBoy") return
    let watchId
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const latitude = position.coords.latitude
          const longitude = position.coords.longitude
          setDeliveryBoyLocation({ lat: latitude, lon: longitude })
          socket.emit('updateLocation', {
            latitude,
            longitude,
            userId: userData._id
          })
        },
        (error) => {
          console.log(error)
        },
        {
          enableHighAccuracy: true
        }
      )
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId)
    }
  }, [socket, userData])

  // NEW: replaces the old flat "₹50 per delivery" guess with the real delivery-fee-
  // based earnings from the new analytics endpoint. `todayDeliveries` (the hourly
  // bar chart above) is left exactly as it was — it's a genuinely different view
  // (delivery COUNT by hour today), not something this duplicates.
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  const getAssignments = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/order/get-assignments`, { withCredentials: true })
      setAvailableAssignments(result.data)
    } catch (error) {
      console.log(error)
    }
  }

  const getCurrentOrder = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/order/get-current-order`, { withCredentials: true })
      setCurrentOrder(result.data)
    } catch (error) {
      console.log(error)
    }
  }

  const acceptOrder = async (assignmentId) => {
    try {
      await axios.get(`${serverUrl}/api/order/accept-order/${assignmentId}`, { withCredentials: true })
      toast.success("Order accepted!")
      await getCurrentOrder()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  // NEW (real-time toast): a fresh delivery assignment just came in over the socket —
  // surface it immediately instead of relying on the delivery boy noticing the list update
  useEffect(() => {
    socket.on('newAssignment', (data) => {
      setAvailableAssignments(prev => ([...prev, data]))
      toast.success(`New order available: ${data.shopName}`)
    })
    return () => {
      socket.off('newAssignment')
    }
  }, [socket])

  const sendOtp = async () => {
    setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/order/send-delivery-otp`, {
        orderId: currentOrder._id, shopOrderId: currentOrder.shopOrder._id
      }, { withCredentials: true })
      setLoading(false)
      setShowOtpBox(true)
      toast.success("OTP sent to customer")
    } catch (error) {
      toast.error(getErrorMessage(error))
      setLoading(false)
    }
  }
  const verifyOtp = async () => {
    try {
      const result = await axios.post(`${serverUrl}/api/order/verify-delivery-otp`, {
        orderId: currentOrder._id, shopOrderId: currentOrder.shopOrder._id, otp
      }, { withCredentials: true })
      toast.success(result.data.message || "Order delivered successfully!")
      // small delay so the toast is actually visible before the page reloads
      setTimeout(() => location.reload(), 800)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleTodayDeliveries = async () => {
    try {
      const result = await axios.get(`${serverUrl}/api/order/get-today-deliveries`, { withCredentials: true })
      setTodayDeliveries(result.data)
    } catch (error) {
      console.log(error)
    }
  }

  // NEW: fetches real earnings analytics (delivery fee only, never the food cost)
  const getDeliveryAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      const result = await axios.get(`${serverUrl}/api/order/delivery-analytics`, { withCredentials: true })
      setAnalytics(result.data)
    } catch (error) {
      console.log(error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    getAssignments()
    getCurrentOrder()
    handleTodayDeliveries()
    getDeliveryAnalytics()
  }, [userData])

  return (
    <div className='w-screen min-h-screen flex flex-col gap-5 items-center bg-[#fff9f6] overflow-y-auto'>
      <Nav />
      <div className='w-full max-w-[800px] flex flex-col gap-5 items-center'>
        <div className='bg-white rounded-2xl shadow-md p-5 flex flex-col justify-start items-center w-[90%] border border-orange-100 text-center gap-2'>
          <h1 className='text-xl font-bold text-[#ff4d2d]'>Welcome, {userData.fullName}</h1>
          <p className='text-[#ff4d2d] '><span className='font-semibold'>Latitude:</span> {deliveryBoyLocation?.lat}, <span className='font-semibold'>Longitude:</span> {deliveryBoyLocation?.lon}</p>
        </div>

        <div className='bg-white rounded-2xl shadow-md p-5 w-[90%] mb-6 border border-orange-100'>
          <h1 className='text-lg font-bold mb-3 text-[#ff4d2d] '>Today Deliveries</h1>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={todayDeliveries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [value, "orders"]} labelFormatter={label => `${label}:00`} />
              <Bar dataKey="count" fill='#ff4d2d' />
            </BarChart>
          </ResponsiveContainer>

        </div>

        {/* NEW: real earnings analytics — delivery fee only, never food cost */}
        <div className='bg-white rounded-2xl shadow-md p-5 w-[90%] mb-6 border border-orange-100'>
          <h1 className='text-lg font-bold mb-4 text-[#ff4d2d]'>Earnings</h1>

          {analyticsLoading ? (
            <div className='flex flex-col items-center justify-center py-10'>
              <div className='w-8 h-8 border-4 border-[#ff4d2d] border-t-transparent rounded-full animate-spin mb-3' />
              <p className='text-gray-500 text-sm'>Loading earnings...</p>
            </div>
          ) : !analytics || analytics.summary.completedDeliveries === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center'>
              <p className='text-gray-500 text-sm'>No deliveries completed today yet.</p>
            </div>
          ) : (
            <>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6'>
                <div className='bg-[#fff9f6] border border-orange-100 rounded-xl p-3 flex flex-col gap-1'>
                  <div className='text-[#ff4d2d] text-sm'><FaWallet /></div>
                  <div className='text-lg font-bold text-gray-800'>₹{analytics.summary.todayEarnings}</div>
                  <div className='text-xs text-gray-500'>Today's Earnings</div>
                </div>
                <div className='bg-[#fff9f6] border border-orange-100 rounded-xl p-3 flex flex-col gap-1'>
                  <div className='text-[#ff4d2d] text-sm'><FaBoxOpen /></div>
                  <div className='text-lg font-bold text-gray-800'>{analytics.summary.completedDeliveries}</div>
                  <div className='text-xs text-gray-500'>Completed Deliveries</div>
                </div>
                <div className='bg-[#fff9f6] border border-orange-100 rounded-xl p-3 flex flex-col gap-1'>
                  <div className='text-[#ff4d2d] text-sm'><FaChartLine /></div>
                  <div className='text-lg font-bold text-gray-800'>₹{analytics.summary.averageEarningPerDelivery}</div>
                  <div className='text-xs text-gray-500'>Avg. per Delivery</div>
                </div>
              </div>

              <h2 className='text-sm font-semibold text-gray-700 mb-2'>Earnings Over Time (Last 7 Days)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics.earningsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => [`₹${value}`, "Earnings"]} labelFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} />
                  <Line type="monotone" dataKey="earnings" stroke="#ff4d2d" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {!currentOrder && <div className='bg-white rounded-2xl p-5 shadow-md w-[90%] border border-orange-100'>
          <h1 className='text-lg font-bold mb-4 flex items-center gap-2'>Available Orders</h1>

          <div className='space-y-4'>
            {availableAssignments?.length > 0
              ? (
                availableAssignments.map((a, index) => (
                  <div className='border rounded-lg p-4 flex justify-between items-center' key={index}>
                    <div>
                      <p className='text-sm font-semibold'>{a?.shopName}</p>
                      <p className='text-sm text-gray-500'><span className='font-semibold'>Delivery Address:</span> {a?.deliveryAddress.text}</p>
                      <p className='text-xs text-gray-400'>{a.items.length} items | {a.subtotal}</p>
                    </div>
                    <button className='bg-orange-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-orange-600' onClick={() => acceptOrder(a.assignmentId)}>Accept</button>
                  </div>
                ))
              ) : <p className='text-gray-400 text-sm'>No Available Orders</p>}
          </div>
        </div>}

        {currentOrder && <div className='bg-white rounded-2xl p-5 shadow-md w-[90%] border border-orange-100'>
          <h2 className='text-lg font-bold mb-3'>📦Current Order</h2>
          <div className='border rounded-lg p-4 mb-3'>
            <p className='font-semibold text-sm'>{currentOrder?.shopOrder.shop.name}</p>
            <p className='text-sm text-gray-500'>{currentOrder.deliveryAddress.text}</p>
            <p className='text-xs text-gray-400'>{currentOrder.shopOrder.shopOrderItems.length} items | {currentOrder.shopOrder.subtotal}</p>
          </div>

          <DeliveryBoyTracking data={{
            deliveryBoyLocation: deliveryBoyLocation || {
              lat: userData.location.coordinates[1],
              lon: userData.location.coordinates[0]
            },
            customerLocation: {
              lat: currentOrder.deliveryAddress.latitude,
              lon: currentOrder.deliveryAddress.longitude
            }
          }} />
          {!showOtpBox ? <button className='mt-4 w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-xl shadow-md hover:bg-green-600 active:scale-95 transition-all duration-200' onClick={sendOtp} disabled={loading}>
            {loading ? <ClipLoader size={20} color='white' /> : "Mark As Delivered"}
          </button> : <div className='mt-4 p-4 border rounded-xl bg-gray-50'>
            <p className='text-sm font-semibold mb-2'>Enter Otp send to <span className='text-orange-500'>{currentOrder.user.fullName}</span></p>
            <input type="text" className='w-full border px-3 py-2 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400' placeholder='Enter OTP' onChange={(e) => setOtp(e.target.value)} value={otp} />

            <button className="w-full bg-orange-500 text-white py-2 rounded-lg font-semibold hover:bg-orange-600 transition-all" onClick={verifyOtp}>Submit OTP</button>
          </div>}
        </div>}
      </div>
    </div>
  )
}

export default DeliveryBoy