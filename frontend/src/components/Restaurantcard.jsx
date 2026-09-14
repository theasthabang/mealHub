import React from 'react'
import { MapPin } from 'lucide-react'

// REDESIGN (replaces ShopCard.jsx): matches the "Popular restaurants" grid
// from the reference design. Deliberately does NOT show star ratings, cuisine
// tags, delivery-time estimates, or price tier (₹₹) the way the reference
// image does — Shop's actual data model has no fields for any of that. Adding
// fake numbers would show real users false information about a real
// business. If you want these to actually work, they'd need real fields and
// real logic (e.g. an aggregate rating computed from delivered orders,
// similar to how Item ratings already work) — happy to build that properly
// as a separate, honest feature rather than faking it here.
function RestaurantCard({ name, image, city, onClick }) {
    return (
        <button
            onClick={onClick}
            className='text-left bg-white rounded-2xl border border-zinc-100 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FF4B2B]'
        >
            <div className='w-full h-[140px] bg-zinc-50 overflow-hidden'>
                <img src={image} alt={name} className='w-full h-full object-cover' />
            </div>
            <div className='p-4'>
                <h3 className='font-semibold text-zinc-900 truncate'>{name}</h3>
                {city && (
                    <div className='flex items-center gap-1 mt-1'>
                        <MapPin size={12} className='text-zinc-400' />
                        <span className='text-xs text-zinc-500'>{city}</span>
                    </div>
                )}
            </div>
        </button>
    )
}

export default RestaurantCard