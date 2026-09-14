import React from 'react'
import { Truck, Tag } from 'lucide-react'

// REDESIGN: now also shows REAL shop-wide offers, fetched from the backend
// (the public /api/offer/active/:shopId endpoint built in Chunk 3) --
// alongside the existing, always-real free-delivery-above-Rs.500 message.
// Deliberately does NOT show a computed rupee amount for these here (that
// would require replicating placeOrder's discount math client-side, with
// real risk of it drifting from what actually gets charged) -- just the
// offer's own real title, which is honest and can't go stale.
function OfferCard({ totalAmount, shopOffers = [] }) {
    const remaining = 500 - totalAmount

    return (
        <div className='flex flex-col gap-3'>
            {shopOffers.map(offer => (
                <div key={offer._id} className='bg-[#FFF1ED] border border-[#FFE4DC] rounded-2xl p-4 flex items-start gap-3'>
                    <div className='w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0'>
                        <Tag size={16} className='text-[#FF4B2B]' />
                    </div>
                    <div>
                        <p className='text-sm font-semibold text-zinc-900'>{offer.title}</p>
                        {offer.minOrderValue > 0 && (
                            <p className='text-xs text-zinc-500 mt-0.5'>On orders above &#8377;{offer.minOrderValue}</p>
                        )}
                    </div>
                </div>
            ))}

            <div className='bg-[#FFF1ED] border border-[#FFE4DC] rounded-2xl p-4 flex items-start gap-3'>
                <div className='w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0'>
                    <Truck size={16} className='text-[#FF4B2B]' />
                </div>
                <div>
                    <p className='text-sm font-semibold text-zinc-900'>Free delivery on orders above &#8377;500</p>
                    <p className='text-xs text-zinc-500 mt-0.5'>
                        {remaining > 0
                            ? `Add \u20B9${remaining} more to your cart to get free delivery!`
                            : "You've unlocked free delivery on this order."}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default OfferCard