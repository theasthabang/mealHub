import React from 'react'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

// NEW: sticky bottom cart bar, mobile only (hidden entirely on desktop via
// md:hidden, where CartSidebar handles this instead). Only renders when the
// cart actually has items -- real cartItems.length and totalAmount from
// Redux, same delivery-fee rule as everywhere else in the app (free above
// Rs.500, flat Rs.40 otherwise). No fake "Taxes" line here either, same
// reasoning as CartSummary.
function MobileCartBar() {
    const { cartItems, totalAmount } = useSelector(state => state.user)
    const navigate = useNavigate()

    if (cartItems.length === 0) return null

    const deliveryFee = totalAmount > 500 ? 0 : 40
    const total = totalAmount + deliveryFee

    return (
        <button
            onClick={() => navigate('/checkout')}
            className='md:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#FF4B2B] hover:bg-[#E94426] text-white rounded-2xl shadow-lg px-5 py-4 flex items-center justify-between transition-colors active:scale-[0.98]'
        >
            <div className='flex items-center gap-2'>
                <ShoppingCart size={18} />
                <span className='text-sm font-medium'>{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</span>
            </div>
            <div className='flex items-center gap-2'>
                <span className='font-bold'>&#8377;{total}</span>
                <ArrowRight size={16} />
            </div>
        </button>
    )
}

export default MobileCartBar