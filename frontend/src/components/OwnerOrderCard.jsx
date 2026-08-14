import axios from 'axios';
import React, { useState } from 'react'
import { MdPhone } from "react-icons/md";
import { FaBan } from "react-icons/fa";
import toast from 'react-hot-toast'
import { serverUrl } from '../App';
import { useDispatch } from 'react-redux';
import { updateOrderStatus } from '../redux/userSlice';
import { getErrorMessage } from '../utils/getErrorMessage';

// data.shopOrders is a SINGLE object here — confirmed via order.controllers.js
// getMyOrders, which flattens shopOrders to just this owner's shop-order for the "owner"
// role.
function OwnerOrderCard({ data }) {
    const [availableBoys, setAvailableBoys] = useState([])
    const dispatch = useDispatch()

    const handleUpdateStatus = async (orderId, shopId, status) => {
        try {
            const result = await axios.post(`${serverUrl}/api/order/update-status/${orderId}/${shopId}`, { status }, { withCredentials: true })
            dispatch(updateOrderStatus({ orderId, shopId, status }))
            setAvailableBoys(result.data.availableBoys)
            toast.success(`Status updated to "${status}"`)
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    const isCancelled = data.shopOrders.status == "cancelled"

    // NEW: color-code status text so cancelled/delivered stand out from in-progress
    const statusColor = isCancelled
        ? "text-red-500"
        : data.shopOrders.status == "delivered"
            ? "text-green-600"
            : "text-[#ff4d2d]"

    return (
        <div className={`bg-white rounded-lg shadow p-4 space-y-4 ${isCancelled ? "opacity-75" : ""}`}>
            <div>
                <h2 className='text-lg font-semibold text-gray-800'>{data.user.fullName}</h2>
                <p className='text-sm text-gray-500'>{data.user.email}</p>
                <p className='flex items-center gap-2 text-sm text-gray-600 mt-1'><MdPhone /><span>{data.user.mobile}</span></p>
                {data.paymentMethod == "online" ? <p className='gap-2 text-sm text-gray-600'>payment: {data.payment ? "true" : "false"}</p> : <p className='gap-2 text-sm text-gray-600'>Payment Method: {data.paymentMethod}</p>}
            </div>

            <div className='flex items-start flex-col gap-2 text-gray-600 text-sm'>
                <p>{data?.deliveryAddress?.text}</p>
                <p className='text-xs text-gray-500'>Lat: {data?.deliveryAddress.latitude} , Lon {data?.deliveryAddress.longitude}</p>
            </div>

            {/* NEW: cancellation banner — only shown once the customer has cancelled */}
            {isCancelled && (
                <div className='flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600'>
                    <FaBan className='mt-0.5 flex-shrink-0' size={14} />
                    <div>
                        <p className='font-semibold'>Cancelled by customer</p>
                        {data.shopOrders.cancelReason && <p className='text-red-500'>Reason: {data.shopOrders.cancelReason}</p>}
                    </div>
                </div>
            )}

            <div className='flex space-x-4 overflow-x-auto pb-2'>
                {data.shopOrders.shopOrderItems.map((item, index) => (
                    <div key={index} className='flex-shrink-0 w-40 border rounded-lg p-2 bg-white'>
                        <img src={item.item.image} alt="" className='w-full h-24 object-cover rounded' />
                        <p className='text-sm font-semibold mt-1'>{item.name}</p>
                        <p className='text-xs text-gray-500'>Qty: {item.quantity} x ₹{item.price}</p>
                    </div>
                ))}
            </div>

            <div className='flex justify-between items-center mt-auto pt-3 border-t border-gray-100'>
                <span className='text-sm'>status: <span className={`font-semibold capitalize ${statusColor}`}>{data.shopOrders.status}</span>
                </span>

                {/* NEW: once cancelled, there's nothing left to change — hide the dropdown
                    instead of letting an owner try to move a cancelled order to "preparing" */}
                {!isCancelled && (
                    <select className='rounded-md border px-3 py-1 text-sm focus:outline-none focus:ring-2 border-[#ff4d2d] text-[#ff4d2d]' onChange={(e) => handleUpdateStatus(data._id, data.shopOrders.shop._id, e.target.value)}>
                        <option value="">Change</option>
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="out of delivery">Out Of Delivery</option>
                    </select>
                )}
            </div>

            {data.shopOrders.status == "out of delivery" &&
                <div className="mt-3 p-2 border rounded-lg text-sm bg-orange-50 gap-4">
                    {data.shopOrders.assignedDeliveryBoy ? <p>Assigned Delivery Boy:</p> : <p>Available Delivery Boys:</p>}
                    {availableBoys?.length > 0 ? (
                        availableBoys.map((b, index) => (
                            <div className='text-gray-800' key={index}>{b.fullName}-{b.mobile}</div>
                        ))
                    ) : data.shopOrders.assignedDeliveryBoy ? <div>{data.shopOrders.assignedDeliveryBoy.fullName}-{data.shopOrders.assignedDeliveryBoy.mobile}</div> : <div>Waiting for delivery boy to accept</div>}
                </div>}

            <div className='text-right font-bold text-gray-800 text-sm'>
                Total: ₹{data.shopOrders.subtotal}
            </div>
        </div>
    )
}

export default OwnerOrderCard