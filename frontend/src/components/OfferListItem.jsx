import React from 'react'
import { Trash2, Tag } from 'lucide-react'

// NEW: single offer row in the owner's management list. Shows exactly what
// was actually saved (title, type/value, scope) -- no separate "preview"
// logic that could drift from the real stored offer.
function OfferListItem({ offer, onToggle, onDelete }) {
    const isExpired = offer.validUntil && new Date(offer.validUntil) < new Date()

    return (
        <div className='flex items-center gap-3 rounded-xl border border-zinc-100 p-3'>
            <div className='w-9 h-9 rounded-full bg-[#FFF1ED] flex items-center justify-center shrink-0'>
                <Tag size={15} className='text-[#FF4B2B]' />
            </div>
            <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium text-zinc-900 truncate'>{offer.title}</p>
                <p className='text-xs text-zinc-400 mt-0.5'>
                    {offer.item ? `Item: ${offer.item.name}` : "Whole shop"}
                    {offer.minOrderValue > 0 && ` \u00b7 Min \u20B9${offer.minOrderValue}`}
                    {offer.validUntil && ` \u00b7 ${isExpired ? "Expired" : "Until " + new Date(offer.validUntil).toLocaleDateString('en-IN')}`}
                </p>
            </div>
            <button
                onClick={() => onToggle(offer._id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${offer.isActive ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-zinc-100 text-zinc-400"}`}
            >
                {offer.isActive ? "Active" : "Inactive"}
            </button>
            <button onClick={() => onDelete(offer._id)} className='text-zinc-300 hover:text-red-500 shrink-0'>
                <Trash2 size={15} />
            </button>
        </div>
    )
}

export default OfferListItem