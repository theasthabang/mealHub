import React from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { updateQuantity, removeCartItem } from '../redux/userSlice'

// NEW: single cart row, reused by CartSidebar. Same Redux actions
// (updateQuantity/removeCartItem) CartDrawer already uses -- one real cart
// state, no second copy of cart logic anywhere.
function CartItem({ item }) {
    const dispatch = useDispatch()

    return (
        <div className='flex gap-3 py-3'>
            <img src={item.image} alt={item.name} className='w-14 h-14 rounded-xl object-cover bg-zinc-50 shrink-0' />
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
                <Trash2 size={15} />
            </button>
        </div>
    )
}

export default CartItem