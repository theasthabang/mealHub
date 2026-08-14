import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IoIosArrowRoundBack } from "react-icons/io";
import { FaBoxOpen } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'
import UserOrderCard from '../components/UserOrderCard';
import OwnerOrderCard from '../components/OwnerOrderCard';
import { setMyOrders, updateOrderStatus, updateRealtimeOrderStatus } from '../redux/userSlice';

function MyOrders() {
  const { userData, myOrders, myOrdersLoading, socket } = useSelector(state => state.user)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  useEffect(() => {
    // NEW (real-time toast): owner sees this the instant a new order comes in for
    // their shop, even before they've looked at the list
    socket?.on('newOrder', (data) => {
      if (data.shopOrders?.owner._id == userData._id) {
        dispatch(setMyOrders([data, ...myOrders]))
        toast.success("New order received!")
      }
    })

    // NEW (real-time toast): customer sees their order's status change live
    socket?.on('update-status', ({ orderId, shopId, status, userId }) => {
      if (userId == userData._id) {
        dispatch(updateRealtimeOrderStatus({ orderId, shopId, status }))
        toast.success(`Order status updated: ${status}`)
      }
    })

    // NEW: fires on the OWNER's socket when a customer cancels a pending order for
    // this shop, so the dashboard reflects it immediately instead of the owner only
    // finding out on next status-change attempt (which the backend would now reject).
    socket?.on('order-cancelled', ({ orderId, shopId, status, cancelReason }) => {
      dispatch(updateOrderStatus({ orderId, shopId, status, cancelReason }))
      toast.error("An order was cancelled by the customer")
    })

    return () => {
      socket?.off('newOrder')
      socket?.off('update-status')
      socket?.off('order-cancelled')
    }
  }, [socket])

  return (
    // FIX (stray leading quote): className was '"w-full min-h-screen bg-[#fff9f6] flex
    // justify-center px-4' — a literal " created a bogus, non-existent class with no
    // visual effect, but it's sloppy and worth cleaning up.
    <div className='w-full min-h-screen bg-[#fff9f6] flex justify-center px-4'>
      <div className='w-full max-w-[800px] p-4'>
        <div className='flex items-center gap-[20px] mb-6 '>
          <div className=' z-[10] ' onClick={() => navigate("/")}>
            <IoIosArrowRoundBack size={35} className='text-[#ff4d2d]' />
          </div>
          <h1 className='text-2xl font-bold  text-start'>My Orders</h1>
        </div>
        <div className='space-y-6'>
          {/* NEW (loading-state fix): loading is now checked FIRST, before deciding
              whether to show the empty-state message — this is what stops the false
              "no orders yet" flash while the real data is still on its way. */}
          {myOrdersLoading ? (
            <div className='flex flex-col items-center justify-center py-16'>
              <div className='w-10 h-10 border-4 border-[#ff4d2d] border-t-transparent rounded-full animate-spin mb-4' />
              <p className='text-gray-500 text-sm'>Loading your orders...</p>
            </div>
          ) : myOrders?.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <div className='bg-orange-100 p-5 rounded-full mb-4'>
                <FaBoxOpen className='text-[#ff4d2d] w-10 h-10' />
              </div>
              <p className='text-gray-700 font-semibold mb-1'>
                {userData.role == "owner" ? "No orders yet" : "You haven't placed any orders yet"}
              </p>
              <p className='text-gray-400 text-sm mb-5'>
                {userData.role == "owner" ? "Orders for your shop will show up here." : "Once you order something, it'll show up here."}
              </p>
              {userData.role == "user" && (
                <button className='bg-[#ff4d2d] hover:bg-[#e64526] text-white px-5 py-2 rounded-lg text-sm font-medium' onClick={() => navigate("/")}>
                  Browse restaurants
                </button>
              )}
            </div>
          ) : (
            myOrders?.map((order, index) => (
              userData.role == "user" ?
                (
                  <UserOrderCard data={order} key={index} />
                )
                :
                userData.role == "owner" ? (
                  <OwnerOrderCard data={order} key={index} />
                )
                  :
                  null
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default MyOrders