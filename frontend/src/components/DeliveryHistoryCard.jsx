import React from 'react'
import { MapPin, Clock, Phone } from 'lucide-react'

// REDESIGN: split into two clear sides as requested -- LEFT is shop info
// (where it was picked up from: photo, name, item count, subtotal), RIGHT is
// customer info (who it was delivered to: name, phone, address, and when).
// All real data -- shopName/shopImage from the populated shop, customerName/
// customerMobile from the newly-populated order.user, nothing invented.
function DeliveryHistoryCard({ delivery }) {
    const deliveredDate = new Date(delivery.deliveredAt)

    return (
        <div className='rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-shadow duration-200'>
            <div className='flex items-start justify-between gap-4'>

                {/* LEFT: shop info */}
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                    <img
                        src={delivery.shopImage}
                        alt={delivery.shopName}
                        className='h-12 w-12 rounded-xl object-cover shrink-0 bg-zinc-50'
                    />
                    <div className='min-w-0'>
                        <p className='font-semibold text-sm text-[#18181B] truncate'>{delivery.shopName}</p>
                        <p className='text-xs text-[#71717A] mt-0.5'>{delivery.itemCount} item{delivery.itemCount !== 1 ? "s" : ""} &middot; &#8377;{delivery.subtotal}</p>
                        <span className='inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]'>Delivered</span>
                    </div>
                </div>

                {/* RIGHT: customer info */}
                <div className='text-right min-w-0 flex-1'>
                    <p className='font-semibold text-sm text-[#18181B] truncate'>{delivery.customerName}</p>
                    {delivery.customerMobile && (
                        <div className='flex items-center gap-1 justify-end mt-0.5'>
                            <Phone size={11} className='text-[#A1A1AA] shrink-0' />
                            <span className='text-xs text-[#71717A]'>{delivery.customerMobile}</span>
                        </div>
                    )}
                    {delivery.deliveryAddress && (
                        <div className='flex items-center gap-1 justify-end mt-1'>
                            <MapPin size={11} className='text-[#A1A1AA] shrink-0' />
                            <span className='text-xs text-[#71717A] truncate max-w-[200px]'>{delivery.deliveryAddress}</span>
                        </div>
                    )}
                    <div className='flex items-center gap-1 justify-end mt-1'>
                        <Clock size={11} className='text-[#A1A1AA] shrink-0' />
                        <span className='text-xs text-[#A1A1AA]'>
                            {deliveredDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            {" \u00b7 "}
                            {deliveredDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default DeliveryHistoryCard