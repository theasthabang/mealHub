import React from 'react'
import { MapPin, ArrowLeft } from 'lucide-react'

// NEW: replaces the old hero block inline in Shop.jsx. Real data only --
// shop.name, shop.image, shop.address, shop.isOpen. Cuisine tags are honestly
// DERIVED from the actual distinct categories of items this shop sells
// (passed in as `cuisineTags`, computed by the parent from real item data) --
// not a fabricated field. No star rating, review count, delivery-time
// estimate, or price tier (₹₹) -- none of that exists in the real Shop model,
// and inventing it would show customers false information about a real
// business.
function RestaurantHero({ shop, cuisineTags, isClosed, onBack }) {
    return (
        <div className='relative w-full h-[280px] md:h-[340px] rounded-2xl overflow-hidden'>
            <img src={shop.image} alt={shop.name} className='w-full h-full object-cover' />
            {/* Subtle dark overlay -- just enough for white text to stay
                readable, not a heavy blur over the actual photo. */}
            <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent' />

            <button
                onClick={onBack}
                className='absolute top-4 left-4 flex items-center gap-1.5 bg-white/90 hover:bg-white text-zinc-900 px-3 py-2 rounded-full text-sm font-medium shadow-sm transition-colors'
            >
                <ArrowLeft size={15} />
                Back
            </button>

            <div className='absolute bottom-0 left-0 right-0 p-5 md:p-7'>
                <div className='flex items-end gap-4'>
                    <div className='w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white shadow-sm shrink-0 overflow-hidden'>
                        <img src={shop.image} alt="" className='w-full h-full object-contain p-1.5' />
                    </div>
                    <div className='min-w-0 pb-1'>
                        <h1 className='text-2xl md:text-3xl font-bold text-white truncate'>{shop.name}</h1>
                        {cuisineTags.length > 0 && (
                            <p className='text-sm text-white/80 mt-0.5 truncate'>{cuisineTags.join(' \u00b7 ')}</p>
                        )}
                        <div className='flex items-center gap-1.5 mt-1.5'>
                            <MapPin size={13} className='text-white/70 shrink-0' />
                            <span className='text-xs text-white/70 truncate'>{shop.address}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RestaurantHero