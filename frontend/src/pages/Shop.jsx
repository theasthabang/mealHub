import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { serverUrl } from '../App'
import { useNavigate, useParams } from 'react-router-dom'
import { FaStore } from "react-icons/fa6";
import { FaLocationDot } from "react-icons/fa6";
import { FaUtensils } from "react-icons/fa";
import { FaCircleExclamation } from "react-icons/fa6";
import FoodCard from '../components/FoodCard';
import { FaArrowLeft } from "react-icons/fa";
import toast from 'react-hot-toast'

function Shop() {
    const { shopId } = useParams()
    const [items, setItems] = useState([])
    const [shop, setShop] = useState(null)
    const navigate = useNavigate()

    const handleShop = async () => {
        try {
            const result = await axios.get(`${serverUrl}/api/item/get-by-shop/${shopId}`, { withCredentials: true })
            setShop(result.data.shop)
            setItems(result.data.items)
        } catch (error) {
            toast.error("Could not load this shop. Please try again.")
        }
    }

    useEffect(() => {
        handleShop()
    }, [shopId])

    // NEW: shop.isOpen was already present in the API response before this change —
    // getItemsByShop returns the full Shop document with no field projection, so
    // isOpen was never actually missing from the payload, it just wasn't being read
    // on the frontend. This is the only thing that needed to change here.
    const isClosed = shop && !shop.isOpen

    return (
        <div className='min-h-screen bg-gray-50'>
            <button className='absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded-full shadow-md transition' onClick={() => navigate("/")}>
                <FaArrowLeft />
                <span>Back</span>
            </button>
            {shop && <div className='relative w-full h-64 md:h-80 lg:h-96'>
                <img src={shop.image} alt="" className='w-full h-full object-cover' />
                <div className='absolute inset-0 bg-gradient-to-b from-black/70 to-black/30 flex flex-col justify-center items-center text-center px-4'>
                    <FaStore className='text-white text-4xl mb-3 drop-shadow-md' />
                    <h1 className='text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg'>{shop.name}</h1>
                    <div className='flex items-center  gap-[10px]'>
                        <FaLocationDot size={22} color='#ff4d2d' />
                        <p className='text-lg font-medium text-gray-200 mt-[10px]'>{shop.address}</p>
                    </div>
                </div>
            </div>}

            {/* NEW: prominent "Currently Closed" banner — this is the actual fix for
                the reported problem. Placed right below the hero image, above the
                menu, so it's the first thing seen after the shop's identity, not
                buried lower on the page. Full-width and high-contrast red rather than
                a small badge, since this needs to be impossible to miss before a
                customer starts browsing a menu they can't actually order from. */}
            {isClosed && (
                <div className='bg-red-50 border-y border-red-100'>
                    <div className='max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-3 text-center'>
                        <FaCircleExclamation className='text-red-500 flex-shrink-0' size={22} />
                        <div>
                            <p className='text-red-700 font-bold'>This shop is currently closed</p>
                            <p className='text-red-500 text-sm'>You can browse the menu, but ordering is disabled until it reopens.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className='max-w-7xl mx-auto px-6 py-10'>
                <h2 className='flex items-center justify-center gap-3 text-3xl font-bold mb-10 text-gray-800'><FaUtensils color='#ff4d2d' /> Our Menu</h2>

                {items.length > 0 ? (
                    <div className='flex flex-wrap justify-center gap-8'>
                        {items.map((item) => (
                            // NEW: shopClosed passed down so every item on this page
                            // disables ordering when the shop is closed, regardless of
                            // that specific item's own availability
                            <FoodCard data={item} key={item._id} shopClosed={isClosed} />
                        ))}
                    </div>
                ) : <p className='text-center text-gray-500 text-lg'>No Items Available</p>}
            </div>
        </div>
    )
}

export default Shop