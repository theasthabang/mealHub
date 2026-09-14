import React from 'react'
import { Leaf, Drumstick } from 'lucide-react'
import Rating from './Rating'
import AddToCartButton from './AddToCartButton'

// NEW: smaller horizontal card for menu sections below "Popular" -- same
// real data and same reused Rating/AddToCartButton components as the full
// FoodCard, just laid out image-left/details-right instead of stacked.
// `data.description` is rendered ONLY if it actually exists on the item --
// this field wasn't seen anywhere in the real Item schema this session, so
// no placeholder or invented text is ever shown in its place.
function CompactFoodCard({ data, shopClosed = false, offer = null }) {
    const isSoldOut = data.isAvailable === false || shopClosed

    return (
        <div className={`flex gap-3 bg-white rounded-2xl border border-zinc-100 p-3 transition-shadow duration-200 ${isSoldOut ? "opacity-60" : "hover:shadow-md"}`}>
            <div className='relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-50 shrink-0'>
                <img src={data.image} alt={data.name} className={`w-full h-full object-cover ${isSoldOut ? "grayscale" : ""}`} />
                {isSoldOut && (
                    <div className='absolute inset-0 bg-black/45 flex items-center justify-center'>
                        <span className='text-white text-[9px] font-semibold text-center leading-tight px-1'>
                            {shopClosed ? "Closed" : "Sold Out"}
                        </span>
                    </div>
                )}
            </div>

            <div className='flex-1 min-w-0 flex flex-col justify-between py-0.5'>
                <div>
                    <div className='flex items-center gap-1.5'>
                        {data.foodType == "veg"
                            ? <Leaf size={11} className='text-emerald-600 shrink-0' />
                            : <Drumstick size={11} className='text-[#B5482A] shrink-0' />}
                        <h4 className='font-semibold text-sm text-zinc-900 truncate'>{data.name}</h4>
                        {/* NEW: real offer tag, same honesty rule as FoodCard —
                            informational only, price display untouched. */}
                        {offer && (
                            <span className='shrink-0 bg-[#FFF1ED] text-[#FF4B2B] text-[9px] font-semibold px-1.5 py-0.5 rounded-full max-w-[90px] truncate'>
                                {offer.title}
                            </span>
                        )}
                    </div>
                    {data.description && (
                        <p className='text-xs text-zinc-400 mt-0.5 line-clamp-1'>{data.description}</p>
                    )}
                    <div className='mt-1'>
                        <Rating average={data.rating?.average || 0} count={data.rating?.count || 0} size={12} />
                    </div>
                </div>

                <div className='flex items-center justify-between mt-1.5'>
                    <span className='font-bold text-sm text-zinc-900'>&#8377;{data.price}</span>
                    {!isSoldOut && <AddToCartButton item={data} />}
                </div>
            </div>
        </div>
    )
}

export default CompactFoodCard