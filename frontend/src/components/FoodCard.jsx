import React, { useState } from 'react'
import { FaLeaf } from "react-icons/fa";
import { FaDrumstickBite } from "react-icons/fa";
import { FaStar } from "react-icons/fa";
import { FaRegStar } from "react-icons/fa6";
import { FaMinus } from "react-icons/fa";
import { FaPlus } from "react-icons/fa";
import { FaShoppingCart } from "react-icons/fa";
import toast from 'react-hot-toast'
import { useDispatch, useSelector } from 'react-redux';
import { addToCart } from '../redux/userSlice';

function FoodCard({ data, shopClosed = false }) {
    const [quantity, setQuantity] = useState(0)
    const dispatch = useDispatch()
    const { cartItems } = useSelector(state => state.user)

    // NEW: explicit `=== false` check (not `!data.isAvailable`) so items that predate
    // this field (undefined) default to available, matching the backend schema's
    // own default of true — a missing field should never silently read as sold out.
    // isSoldOut now also accounts for the shop itself being closed (new `shopClosed`
    // prop, defaults to false so every existing call site — UserDashboard, search
    // results — is unaffected unless it explicitly passes it). An item can be
    // individually available but still unorderable because its shop is closed; the
    // badge text below reflects which of the two is actually true, since "Sold Out"
    // would be a misleading label for a perfectly available item in a closed shop.
    const isSoldOut = data.isAvailable === false || shopClosed

    // FIX (missing key prop): each star was pushed into the array with no `key`, so React
    // warned on every render of every FoodCard. Using a stable, position-based key here.
    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                (i <= rating) ? (
                    <FaStar key={i} className='text-yellow-500 text-lg' />
                ) : (
                    <FaRegStar key={i} className='text-yellow-500 text-lg' />
                )
            )
        }
        return stars
    }

    const handleIncrease = () => {
        if (isSoldOut) return
        const newQty = quantity + 1
        setQuantity(newQty)
    }
    const handleDecrease = () => {
        if (isSoldOut) return
        if (quantity > 0) {
            const newQty = quantity - 1
            setQuantity(newQty)
        }
    }

    return (
        // NEW: card dims slightly and image grayscales when sold out, so it reads as
        // "unavailable" at a glance in a scrolling grid, without hiding the item
        // entirely — customers should still be able to see the shop's full menu.
        <div className={`w-[250px] rounded-2xl border-2 bg-white shadow-md overflow-hidden transition-all duration-300 flex flex-col ${isSoldOut ? "border-gray-200 opacity-75" : "border-[#ff4d2d] hover:shadow-xl"}`}>
            <div className='relative w-full h-[170px] flex justify-center items-center bg-white'>
                <div className='absolute top-3 right-3 bg-white rounded-full p-1 shadow'>{data.foodType == "veg" ? <FaLeaf className='text-green-600 text-lg' /> : <FaDrumstickBite className='text-red-600 text-lg' />}</div>

                <img src={data.image} alt="" className={`w-full h-full object-cover transition-transform duration-300 ${isSoldOut ? "grayscale" : "hover:scale-105"}`} />

                {/* NEW: Sold Out badge — sits over the image so it's unmissable in a
                    grid of cards, same overlay position pattern already used for the
                    veg/non-veg icon above */}
                {isSoldOut && (
                    <div className='absolute inset-0 bg-black/40 flex items-center justify-center'>
                        <span className='bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow'>
                            {shopClosed ? "Shop Closed" : "Sold Out"}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col p-4">
                <h1 className='font-semibold text-gray-900 text-base truncate'>{data.name}</h1>

                <div className='flex items-center gap-1 mt-1'>
                    {renderStars(data.rating?.average || 0)}
                    <span className='text-xs text-gray-500'>
                        {data.rating?.count || 0}
                    </span>
                </div>
            </div>

            <div className='flex items-center justify-between mt-auto p-3'>
                <span className='font-bold text-gray-900 text-lg'>
                    ₹{data.price}
                </span>

                {/* NEW: quantity stepper and add-to-cart button all disabled together
                    when sold out — `disabled` attribute is the real enforcement (a
                    disabled button can't be clicked), the dimmed styling is just the
                    visual match for that */}
                <div className={`flex items-center border rounded-full overflow-hidden shadow-sm ${isSoldOut ? "opacity-50" : ""}`}>
                    <button className='px-2 py-1 hover:bg-gray-100 transition disabled:hover:bg-transparent disabled:cursor-not-allowed' onClick={handleDecrease} disabled={isSoldOut}>
                        <FaMinus size={12} />
                    </button>
                    <span>{quantity}</span>
                    <button className='px-2 py-1 hover:bg-gray-100 transition disabled:hover:bg-transparent disabled:cursor-not-allowed' onClick={handleIncrease} disabled={isSoldOut}>
                        <FaPlus size={12} />
                    </button>
                    <button
                        className={`${cartItems.some(i => i.id == data._id) ? "bg-gray-800" : "bg-[#ff4d2d]"} text-white px-3 py-2 transition-colors disabled:cursor-not-allowed`}
                        disabled={isSoldOut}
                        onClick={() => {
                            if (isSoldOut) return
                            if (quantity > 0) {
                                dispatch(addToCart({
                                    id: data._id,
                                    name: data.name,
                                    price: data.price,
                                    image: data.image,
                                    shop: data.shop,
                                    quantity,
                                    foodType: data.foodType
                                }))
                                toast.success(`${data.name} added to cart`)
                                setQuantity(0)
                            } else {
                                toast.error("Select a quantity first")
                            }
                        }}>
                        <FaShoppingCart size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FoodCard