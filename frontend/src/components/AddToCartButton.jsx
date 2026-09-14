import React from 'react'
import { Plus, Minus } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { addToCart, updateQuantity, removeCartItem } from '../redux/userSlice'
import toast from 'react-hot-toast'

// REDESIGN: previously every FoodCard always showed a "− 0 +" stepper even for
// items with nothing in the cart yet, plus a separate cart-icon button to
// actually commit the quantity. Now: a plain "+" button when the item isn't in
// the cart, which — the moment it's clicked — adds exactly 1 unit AND the
// control itself transforms into a stepper reflecting the REAL quantity
// already in Redux state. No separate "confirm" step; each +/- directly
// updates the cart, matching how the reference design's controls behave.
function AddToCartButton({ item }) {
    const dispatch = useDispatch()
    const { cartItems } = useSelector(state => state.user)
    const existing = cartItems.find(i => i.id == item._id)

    const handleAdd = () => {
        dispatch(addToCart({
            id: item._id,
            name: item.name,
            price: item.price,
            image: item.image,
            shop: item.shop,
            quantity: 1,
            foodType: item.foodType
        }))
        toast.success(`${item.name} added to cart`)
    }

    const handleIncrease = () => {
        dispatch(updateQuantity({ id: item._id, quantity: existing.quantity + 1 }))
    }

    const handleDecrease = () => {
        if (existing.quantity <= 1) {
            dispatch(removeCartItem(item._id))
        } else {
            dispatch(updateQuantity({ id: item._id, quantity: existing.quantity - 1 }))
        }
    }

    if (!existing) {
        return (
            <button
                onClick={handleAdd}
                className='flex items-center justify-center w-8 h-8 rounded-full bg-[#FF4B2B] text-white shadow-sm hover:bg-[#e8401f] active:scale-95 transition-all'
                aria-label={`Add ${item.name} to cart`}
            >
                <Plus size={16} />
            </button>
        )
    }

    return (
        <div className='flex items-center gap-2 bg-[#FF4B2B] text-white rounded-full px-1 py-1'>
            <button onClick={handleDecrease} className='w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 active:scale-95 transition-all'>
                <Minus size={13} />
            </button>
            <span className='text-sm font-semibold w-4 text-center'>{existing.quantity}</span>
            <button onClick={handleIncrease} className='w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 active:scale-95 transition-all'>
                <Plus size={13} />
            </button>
        </div>
    )
}

export default AddToCartButton