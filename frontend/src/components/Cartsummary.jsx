import React from 'react'
import { useNavigate } from 'react-router-dom'

// NEW: real totals only. The reference design includes a "Taxes" line --
// there is no tax calculation anywhere in this app's actual pricing logic
// (checked placeOrder and CheckOut.jsx: it's subtotal + delivery fee, full
// stop), so no invented tax number is shown here. Delivery-fee rule mirrors
// the exact real logic already used at checkout: free above Rs.500, flat
// Rs.40 otherwise.
function CartSummary({ totalAmount }) {
    const navigate = useNavigate()
    const deliveryFee = totalAmount > 500 ? 0 : 40
    const total = totalAmount + deliveryFee

    return (
        <div className='pt-3 mt-1 border-t border-zinc-100'>
            <div className='flex justify-between text-sm text-zinc-600 mb-1.5'>
                <span>Item Total</span>
                <span>&#8377;{totalAmount}</span>
            </div>
            <div className='flex justify-between text-sm text-zinc-600 mb-3'>
                <span>Delivery Fee</span>
                <span>{deliveryFee === 0 ? "Free" : `\u20B9${deliveryFee}`}</span>
            </div>
            <div className='flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100 mb-4'>
                <span>Total</span>
                <span>&#8377;{total}</span>
            </div>
            <button
                onClick={() => navigate('/checkout')}
                className='w-full bg-[#FF4B2B] hover:bg-[#E94426] text-white font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]'
            >
                Proceed to Checkout
            </button>
        </div>
    )
}

export default CartSummary