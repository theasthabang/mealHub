import React from 'react'
import { MapPin } from 'lucide-react'

// REDESIGN: the "accept this broadcasted order" card. Same acceptOrder logic
// as before (passed down as onAccept), only the visual layer changed.
function AvailableOrderCard({ assignment, onAccept }) {
    return (
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-zinc-200 bg-white p-4'>
            <div className='flex-1 min-w-0'>
                <p className='font-semibold text-sm text-[#18181B]'>{assignment?.shopName}</p>
                <div className='flex items-center gap-1 mt-1'>
                    <MapPin size={12} className='text-[#A1A1AA] shrink-0' />
                    <span className='text-xs text-[#71717A] truncate'>{assignment?.deliveryAddress?.text}</span>
                </div>
                <p className='text-xs text-[#A1A1AA] mt-1'>{assignment.items.length} item{assignment.items.length !== 1 ? "s" : ""} &middot; &#8377;{assignment.subtotal}</p>
            </div>
            <button
                className='bg-[#FF4B2B] hover:bg-[#E94426] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 active:scale-[0.98]'
                onClick={() => onAccept(assignment.assignmentId)}
            >
                Accept
            </button>
        </div>
    )
}

export default AvailableOrderCard