import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { clearCart } from '../redux/userSlice'
import CartItem from './Cartitem'
import CartSummary from './Cartsummary'

// NEW: sticky desktop cart. Shows the REAL, whole cart (see the note on why
// this isn't filtered to just this shop's items -- a customer's cart can
// genuinely span multiple shops, and filtering the display here would create
// a mismatch with what checkout actually charges). "Clear" uses the same
// real clearCart action CheckOut.jsx already dispatches on a successful
// order.
function CartSidebar() {
    const dispatch = useDispatch()
    const { cartItems, totalAmount } = useSelector(state => state.user)

    return (
        <div className='sticky top-[140px] bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm'>
            <div className='flex items-center justify-between mb-1'>
                <h2 className='font-semibold text-zinc-900'>Your Cart</h2>
                {cartItems.length > 0 && (
                    <button onClick={() => dispatch(clearCart())} className='text-xs text-zinc-400 hover:text-red-500 font-medium'>
                        Clear
                    </button>
                )}
            </div>

            {cartItems.length === 0 ? (
                <div className='flex flex-col items-center text-center py-10'>
                    <div className='w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center mb-3'>
                        <ShoppingCart size={20} className='text-zinc-300' />
                    </div>
                    <p className='text-sm font-medium text-zinc-700'>Your cart is empty</p>
                    <p className='text-xs text-zinc-400 mt-1'>Add something delicious from this restaurant.</p>
                </div>
            ) : (
                <>
                    <div className='divide-y divide-zinc-50'>
                        {cartItems.map(item => (
                            <CartItem key={item.id} item={item} />
                        ))}
                    </div>
                    <CartSummary totalAmount={totalAmount} />
                </>
            )}
        </div>
    )
}

export default CartSidebar