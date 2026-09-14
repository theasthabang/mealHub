import React from 'react'
import { Leaf, Drumstick } from 'lucide-react'
import Rating from './Rating'
import AddToCartButton from './AddToCartButton'

// REDESIGN: rebuilt around the reusable Rating and AddToCartButton
// components. Same isSoldOut / shopClosed logic as before, preserved exactly
// -- only the visual layer and the add-to-cart interaction pattern changed
// (now a single + that becomes a live stepper, instead of a separate
// select-quantity-then-confirm flow).
function FoodCard({ data, shopClosed = false }) {
    const isSoldOut = data.isAvailable === false || shopClosed

    return (
        <div className={`bg-white rounded-2xl border border-zinc-100 overflow-hidden transition-shadow duration-300 flex flex-col ${isSoldOut ? "opacity-60" : "hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"}`}>
            <div className='relative w-full h-[150px] bg-zinc-50'>
                <div className='absolute top-2.5 right-2.5 bg-white rounded-full p-1.5 shadow-sm'>
                    {data.foodType == "veg"
                        ? <Leaf size={13} className='text-emerald-600' />
                        : <Drumstick size={13} className='text-[#B5482A]' />}
                </div>

                <img src={data.image} alt={data.name} className={`w-full h-full object-cover ${isSoldOut ? "grayscale" : ""}`} />

                {isSoldOut && (
                    <div className='absolute inset-0 bg-black/45 flex items-center justify-center'>
                        <span className='bg-white text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-full'>
                            {shopClosed ? "Shop Closed" : "Sold Out"}
                        </span>
                    </div>
                )}
            </div>

            <div className='flex-1 flex flex-col p-3.5 gap-1.5'>
                <h3 className='font-semibold text-zinc-900 text-sm truncate'>{data.name}</h3>
                <Rating average={data.rating?.average || 0} count={data.rating?.count || 0} />

                <div className='flex items-center justify-between mt-1.5'>
                    <span className='font-bold text-zinc-900'>&#8377;{data.price}</span>
                    {!isSoldOut && <AddToCartButton item={data} />}
                </div>
            </div>
        </div>
    )
}

export default FoodCard