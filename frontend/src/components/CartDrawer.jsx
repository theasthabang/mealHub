import React from 'react'
import { X, Minus, Plus, Trash2 } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { updateQuantity, removeCartItem } from '../redux/userSlice'
import { useNavigate } from 'react-router-dom'

// NEW: slide-out cart preview. Reads and writes the SAME Redux cartItems
// state your existing CartPage.jsx uses -- this is an additional, faster way
// to see/adjust the cart without leaving the current page, not a replacement
// for CartPage.jsx (which still exists at /cart for anyone who navigates
// there directly). "Proceed to Checkout" closes the drawer and navigates to
// the same /checkout route your existing CheckOut.jsx already handles --
// zero change to checkout logic itself.
function CartDrawer({ open, onClose }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { cartItems, totalAmount } = useSelector(state => state.user)

    return (
        <>
            {open && (
                <div className='fixed inset-0 bg-black/40 z-[9998]' onClick={onClose} />
            )}
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white z-[9999] shadow-2xl transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className='flex items-center justify-between px-5 py-4 border-b border-zinc-100'>
                    <h2 className='font-semibold text-zinc-900'>Your Cart</h2>
                    <button onClick={onClose} className='p-1.5 rounded-full hover:bg-zinc-100'>
                        <X size={18} />
                    </button>
                </div>

                <div className='flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4'>
                    {cartItems.length === 0 ? (
                        <p className='text-sm text-zinc-400 text-center mt-10'>Your cart is empty</p>
                    ) : cartItems.map(item => (
                        <div key={item.id} className='flex gap-3'>
                            <img src={item.image} alt={item.name} className='w-16 h-16 rounded-xl object-cover bg-zinc-50 shrink-0' />
                            <div className='flex-1 min-w-0'>
                                <p className='text-sm font-medium text-zinc-900 truncate'>{item.name}</p>
                                <p className='text-sm text-zinc-500 mt-0.5'>&#8377;{item.price}</p>
                                <div className='flex items-center gap-2 mt-1.5'>
                                    <button
                                        onClick={() => item.quantity <= 1 ? dispatch(removeCartItem(item.id)) : dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                                        className='w-6 h-6 flex items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50'
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <span className='text-sm font-medium w-4 text-center'>{item.quantity}</span>
                                    <button
                                        onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                                        className='w-6 h-6 flex items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50'
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => dispatch(removeCartItem(item.id))} className='text-zinc-300 hover:text-red-500 self-start'>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>

                {cartItems.length > 0 && (
                    <div className='border-t border-zinc-100 p-5'>
                        <div className='flex items-center justify-between mb-3'>
                            <span className='text-sm text-zinc-500'>Subtotal</span>
                            <span className='font-semibold text-zinc-900'>&#8377;{totalAmount}</span>
                        </div>
                        <button
                            onClick={() => { onClose(); navigate('/checkout') }}
                            className='w-full bg-[#FF4B2B] text-white font-semibold py-3 rounded-xl hover:bg-[#e8401f] transition-colors'
                        >
                            Proceed to Checkout
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}

export default CartDrawer