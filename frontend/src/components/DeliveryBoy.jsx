import React from 'react'
import Nav from './Nav'
import { useSelector } from 'react-redux'
import axios from 'axios'
import { serverUrl } from '../App'
import { useEffect } from 'react'
import { useState } from 'react'
import { useRef } from 'react'
import DeliveryBoyTracking from './DeliveryBoyTracking'
import { ClipLoader } from 'react-spinners'
import toast from 'react-hot-toast'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Wallet, Package, TrendingUp, Phone, MapPin, User as UserIcon, CheckCircle2 } from "lucide-react"
import { getErrorMessage } from '../utils/getErrorMessage'
import StatCard from './StatCard'
import AvailableOrderCard from './AvailableOrderCard'
import DeliveryHistoryCard from './DeliveryHistoryCard'

// REDESIGN: every function, state variable, and effect below is UNCHANGED
// from the original -- same API calls, same socket listeners, same location
// tracking, same OTP flow. Only the JSX layout/styling changed, plus:
//   - todayDeliveries now holds { hourlyStats, deliveries } (matching the
//     backend's new response shape) instead of a bare array -- the bar chart
//     below reads .hourlyStats, which is the exact same data it always was.
//   - A real "Completed Today" history section now renders from
//     todayDeliveries.deliveries (real shop photo/name/address/time, from
//     the backend enrichment).
// No fake concurrent-deliveries list, no invented distance/ETA numbers --
// this app can only have one active delivery at a time (see acceptOrder's
// busyElsewhere check), so the UI honestly reflects that: one current
// delivery, a list of ones you can accept, and real completed history.
function DeliveryBoy() {
  const { userData, socket } = useSelector(state => state.user)
  const [currentOrder, setCurrentOrder] = useState()
  const [showOtpBox, setShowOtpBox] = useState(false)
  const [availableAssignments, setAvailableAssignments] = useState(null)
  const [otp, setOtp] = useState("")
  const [todayDeliveries, setTodayDeliveries] = useState({ hourlyStats: [], deliveries: [] })
  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState(null)
  const [loading, setLoading] = useState(false)

  const currentOrderIdRef = useRef(null)

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
            userId: userData._id,
            orderId: currentOrderIdRef.current
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
      currentOrderIdRef.current = result.data?._id || null
    } catch (error) {
      console.log(error)
    }
  }

  const acceptOrder = async (assignmentId) => {
    try {
      await axios.post(`${serverUrl}/api/order/accept-order/${assignmentId}`, {}, { withCredentials: true })
      toast.success("Order accepted!")
      await getCurrentOrder()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  useEffect(() => {
    socket?.on('newAssignment', (data) => {
      setAvailableAssignments(prev => ([...prev, data]))
      toast.success(`New order available: ${data.shopName}`)
    })
    return () => {
      socket?.off('newAssignment')
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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className='w-full min-h-screen bg-[#FAFAF9] pt-[8px]'>
      <Nav />

      <div className='max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2'>

        <h1 className='text-2xl font-bold text-[#18181B]'>{greeting}, {userData.fullName}! &#128075;</h1>
        <p className='text-sm text-[#71717A] mt-1'>Here's your delivery overview for today.</p>

        {/* STAT CARDS -- real numbers only: today's delivery count (from the
            hourly stats total), completed count, and real earnings analytics. */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4'>
          <StatCard
            icon={<Package size={18} className='text-[#FF4B2B]' />}
            iconBg="#FFF1ED"
            title="Today's Deliveries"
            value={todayDeliveries.hourlyStats.reduce((sum, s) => sum + s.count, 0)}
          />
          <StatCard
            icon={<CheckCircle2 size={18} className='text-[#16A34A]' />}
            iconBg="#F0FDF4"
            title="Completed"
            value={analytics?.summary.completedDeliveries ?? 0}
          />
          <StatCard
            icon={<Wallet size={18} className='text-[#3B82F6]' />}
            iconBg="#EFF6FF"
            title="Today's Earnings"
            value={`\u20B9${analytics?.summary.todayEarnings ?? 0}`}
          />
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mt-8'>

          {/* LEFT: current delivery (map + actions) OR available orders to accept */}
          <div className='flex flex-col gap-6'>
            {currentOrder ? (
              <div className='rounded-2xl border border-zinc-200 bg-white p-5'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='font-semibold text-[#18181B]'>Active Delivery</h2>
                  <span className='text-xs font-medium px-2.5 py-1 rounded-full bg-[#FFF1ED] text-[#FF4B2B]'>Out for delivery</span>
                </div>
                <p className='text-sm font-semibold text-[#18181B]'>{currentOrder?.shopOrder.shop.name}</p>
                <p className='text-xs text-[#71717A] mt-0.5'>{currentOrder.shopOrder.shopOrderItems.length} items &middot; &#8377;{currentOrder.shopOrder.subtotal}</p>

                <div className='mt-4'>
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
                </div>

                {!showOtpBox ? (
                  <button
                    className='mt-5 w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold h-12 rounded-xl transition-colors active:scale-[0.98]'
                    onClick={sendOtp}
                    disabled={loading}
                  >
                    {loading ? <ClipLoader size={20} color='white' /> : "Mark as Delivered"}
                  </button>
                ) : (
                  <div className='mt-5 p-4 border border-zinc-200 rounded-xl bg-[#FAFAF9]'>
                    <p className='text-sm font-medium mb-2 text-[#18181B]'>Enter OTP sent to <span className='text-[#FF4B2B]'>{currentOrder.user.fullName}</span></p>
                    <input type="text" className='w-full border border-zinc-200 px-3 py-2 rounded-xl mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4B2B]/30 focus:border-[#FF4B2B]' placeholder='Enter OTP' onChange={(e) => setOtp(e.target.value)} value={otp} />
                    <button className="w-full bg-[#FF4B2B] hover:bg-[#E94426] text-white h-11 rounded-xl font-semibold transition-colors active:scale-[0.98]" onClick={verifyOtp}>Submit OTP</button>
                  </div>
                )}
              </div>
            ) : (
              <div className='rounded-2xl border border-zinc-200 bg-white p-5'>
                <h2 className='font-semibold text-[#18181B] mb-4'>Available Orders</h2>
                <div className='flex flex-col gap-3'>
                  {availableAssignments?.length > 0 ? (
                    availableAssignments.map((a, index) => (
                      <AvailableOrderCard key={index} assignment={a} onAccept={acceptOrder} />
                    ))
                  ) : (
                    <p className='text-sm text-[#A1A1AA] py-6 text-center'>No available orders right now</p>
                  )}
                </div>
              </div>
            )}

            {/* COMPLETED TODAY -- real history, real shop photo, real time/date */}
            <div className='rounded-2xl border border-zinc-200 bg-white p-5'>
              <h2 className='font-semibold text-[#18181B] mb-4'>Completed Today</h2>
              <div className='flex flex-col gap-3'>
                {todayDeliveries.deliveries?.length > 0 ? (
                  todayDeliveries.deliveries.map((d, index) => (
                    <DeliveryHistoryCard key={index} delivery={d} />
                  ))
                ) : (
                  <p className='text-sm text-[#A1A1AA] py-6 text-center'>No deliveries completed yet today</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: customer card (when there's an active delivery) + earnings */}
          <div className='flex flex-col gap-6'>
            {currentOrder && (
              <div className='rounded-2xl border border-zinc-200 bg-white p-5'>
                <h2 className='font-semibold text-[#18181B] mb-3'>Customer</h2>
                <div className='flex items-center gap-3'>
                  <div className='w-9 h-9 rounded-full bg-[#FFF1ED] flex items-center justify-center shrink-0'>
                    <UserIcon size={16} className='text-[#FF4B2B]' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-semibold text-[#18181B] truncate'>{currentOrder.user.fullName}</p>
                    <p className='text-xs text-[#71717A]'>{currentOrder.user.mobile}</p>
                  </div>
                </div>
                <div className='flex items-start gap-2 mt-3 pt-3 border-t border-zinc-100'>
                  <MapPin size={14} className='text-[#A1A1AA] shrink-0 mt-0.5' />
                  <p className='text-xs text-[#71717A]'>{currentOrder.deliveryAddress.text}</p>
                </div>
                {currentOrder.user.mobile && (
                  <a href={`tel:${currentOrder.user.mobile}`} className='mt-4 w-full flex items-center justify-center gap-2 bg-[#FFF1ED] text-[#FF4B2B] h-10 rounded-xl text-sm font-semibold hover:bg-[#FFE4DC] transition-colors'>
                    <Phone size={14} /> Call Customer
                  </a>
                )}
              </div>
            )}

            <div className='rounded-2xl border border-zinc-200 bg-white p-5'>
              <h2 className='font-semibold text-[#18181B] mb-4'>Earnings</h2>
              {analyticsLoading ? (
                <div className='flex flex-col items-center justify-center py-8'>
                  <div className='w-6 h-6 border-[3px] border-[#FF4B2B] border-t-transparent rounded-full animate-spin mb-3' />
                  <p className='text-[#A1A1AA] text-xs'>Loading earnings...</p>
                </div>
              ) : !analytics || analytics.summary.completedDeliveries === 0 ? (
                <p className='text-sm text-[#A1A1AA] py-6 text-center'>No deliveries completed today yet.</p>
              ) : (
                <>
                  <div className='flex items-center gap-2 mb-4'>
                    <TrendingUp size={14} className='text-[#3B82F6]' />
                    <span className='text-xs text-[#71717A]'>Avg &#8377;{analytics.summary.averageEarningPerDelivery} per delivery</span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={analytics.earningsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                      <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} fontSize={11} stroke="#A1A1AA" />
                      <YAxis fontSize={11} stroke="#A1A1AA" />
                      <Tooltip formatter={(value) => [`\u20B9${value}`, "Earnings"]} labelFormatter={(d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} />
                      <Line type="monotone" dataKey="earnings" stroke="#FF4B2B" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>

            <div className='rounded-2xl border border-zinc-200 bg-white p-5'>
              <h2 className='font-semibold text-[#18181B] mb-4'>Deliveries by Hour</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={todayDeliveries.hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} fontSize={11} stroke="#A1A1AA" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="#A1A1AA" />
                  <Tooltip formatter={(value) => [value, "orders"]} labelFormatter={label => `${label}:00`} />
                  <Bar dataKey="count" fill='#FF4B2B' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeliveryBoy