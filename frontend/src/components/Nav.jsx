import React, { useEffect, useRef, useState } from 'react'
import { MapPin, ShoppingCart, Search, X, Plus, Receipt } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { serverUrl } from '../App';
import { setUserData } from '../redux/userSlice';
import { useNavigate } from 'react-router-dom';
import SearchDropdown from './SearchDropdown';
import CartDrawer from './CartDrawer';
import toast from 'react-hot-toast'
import { incrementNewOrderCount, resetNewOrderCount } from '../redux/ownerSlice';

// REDESIGN: same role-based logic and effects as before (click-outside
// dropdown, new-order socket listener, logout) -- untouched. Visual layer
// switched to lucide-react icons and a more compact, minimal bar. The cart
// icon now opens the new slide-out CartDrawer instead of navigating straight
// to /cart -- the /cart route and CartPage.jsx are unchanged and still
// reachable directly.
function Nav() {
    const { userData, currentCity, cartItems, socket } = useSelector(state => state.user)
    const { myShopData, newOrderCount } = useSelector(state => state.owner)
    const [showInfo, setShowInfo] = useState(false)
    const [showSearch, setShowSearch] = useState(false)
    const [isCartOpen, setIsCartOpen] = useState(false)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const dropdownRef = useRef(null)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowInfo(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (!socket || userData.role !== "owner") return

        const handleNewOrder = (data) => {
            if (data.shopOrders?.owner._id == userData._id) {
                dispatch(incrementNewOrderCount())
                toast.success(
                    `New order from ${data.deliveryAddress?.text || "a customer"}!`,
                    { duration: 6000 }
                )
            }
        }

        socket.on('newOrder', handleNewOrder)
        return () => socket.off('newOrder', handleNewOrder)
    }, [socket, userData])

    const handleLogOut = async () => {
        try {
            await axios.get(`${serverUrl}/api/auth/signout`, { withCredentials: true })
            dispatch(setUserData(null))
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <>
            <div className='w-full h-[68px] flex items-center justify-between md:justify-center gap-6 px-5 fixed top-0 z-[9999] bg-white/90 backdrop-blur-md border-b border-zinc-100'>

                {showSearch && userData.role == "user" && (
                    <div className='w-[90%] fixed top-[68px] left-[5%] md:hidden flex items-center gap-2'>
                        <div className='flex items-center gap-1.5 h-11 px-3 rounded-full bg-zinc-50 border border-zinc-100 shrink-0 max-w-[100px]'>
                            <MapPin size={13} className='text-[#FF4B2B] shrink-0' />
                            <span className='text-xs text-zinc-600 truncate'>{currentCity}</span>
                        </div>
                        <div className='flex-1'>
                            <SearchDropdown variant="mobile" />
                        </div>
                    </div>
                )}

                <h1 className='text-xl font-bold text-[#FF4B2B]'>MealHub</h1>

                {userData.role == "user" && (
                    <div className='md:w-[55%] lg:w-[40%] hidden md:flex items-center gap-2'>
                        <div className='flex items-center gap-1.5 h-11 px-3 rounded-full bg-zinc-50 border border-zinc-100 shrink-0 max-w-[130px]'>
                            <MapPin size={13} className='text-[#FF4B2B] shrink-0' />
                            <span className='text-xs text-zinc-600 truncate'>{currentCity}</span>
                        </div>
                        <div className='flex-1'>
                            <SearchDropdown variant="desktop" />
                        </div>
                    </div>
                )}

                <div className='flex items-center gap-4'>
                    {userData.role == "user" && (showSearch
                        ? <X size={22} className='text-zinc-700 md:hidden cursor-pointer' onClick={() => setShowSearch(false)} />
                        : <Search size={22} className='text-zinc-700 md:hidden cursor-pointer' onClick={() => setShowSearch(true)} />)
                    }
                    {userData.role == "owner" ? <>
                        {myShopData && <>
                            <button className='hidden md:flex items-center gap-1.5 px-3 py-2 cursor-pointer rounded-full text-[#FF4B2B] hover:bg-[#FF4B2B]/5 transition-colors text-sm font-medium' onClick={() => navigate("/add-item")}>
                                <Plus size={16} />
                                <span>Add Food Item</span>
                            </button>
                            <button className='md:hidden flex items-center p-2 cursor-pointer rounded-full text-[#FF4B2B]' onClick={() => navigate("/add-item")}>
                                <Plus size={20} />
                            </button>
                        </>}

                        <div className='flex items-center gap-1.5 cursor-pointer relative px-2 py-1.5 rounded-full text-zinc-700 hover:bg-zinc-100 transition-colors' onClick={() => { dispatch(resetNewOrderCount()); navigate("/my-orders") }}>
                            <Receipt size={20} />
                            <span className='hidden md:inline text-sm font-medium'>My Orders</span>
                            {newOrderCount > 0 && (
                                <span className='absolute -right-1 -top-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-[#FF4B2B] text-white text-[10px] font-semibold leading-none'>
                                    {newOrderCount}
                                </span>
                            )}
                        </div>
                    </> : (
                        <>
                            {userData.role == "user" && (
                                <button className='relative cursor-pointer p-1.5 rounded-full hover:bg-zinc-100 transition-colors' onClick={() => setIsCartOpen(true)}>
                                    <ShoppingCart size={21} className='text-zinc-700' />
                                    {cartItems.length > 0 && (
                                        <span className='absolute -right-0.5 -top-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-[#FF4B2B] text-white text-[10px] font-semibold leading-none'>
                                            {cartItems.length}
                                        </span>
                                    )}
                                </button>
                            )}

                            <button className='flex items-center gap-1.5 px-2 py-1.5 rounded-full text-zinc-700 hover:bg-zinc-100 transition-colors text-sm font-medium' onClick={() => navigate("/my-orders")}>
                                <Receipt size={18} />
                                <span className='hidden md:inline'>Orders</span>
                            </button>
                        </>
                    )}

                    <div ref={dropdownRef} className='relative'>
                        <div className='w-8 h-8 rounded-full flex items-center justify-center bg-[#FF4B2B] text-white text-sm font-semibold cursor-pointer' onClick={() => setShowInfo(prev => !prev)}>
                            {userData?.fullName.slice(0, 1)}
                        </div>
                        {showInfo && (
                            <div className='absolute top-full right-0 mt-3 w-[220px] bg-white shadow-xl rounded-xl overflow-hidden z-[9999] border border-zinc-100'>
                                <div className='flex items-center gap-3 px-4 py-3'>
                                    <div className='w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-[#FF4B2B] text-white text-sm font-semibold'>
                                        {userData?.fullName.slice(0, 1)}
                                    </div>
                                    <div className='min-w-0'>
                                        <div className='text-sm font-semibold text-zinc-900 truncate'>{userData.fullName}</div>
                                        <div className='text-xs text-zinc-400 capitalize'>{userData.role === "deliveryBoy" ? "Delivery Partner" : userData.role}</div>
                                    </div>
                                </div>
                                <div className='h-px bg-zinc-100' />
                                <div className='py-1'>
                                    {userData.role == "user" && (
                                        <button
                                            className='w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors md:hidden'
                                            onClick={() => { setShowInfo(false); navigate("/my-orders") }}
                                        >
                                            My Orders
                                        </button>
                                    )}
                                    <button
                                        className='w-full text-left px-4 py-2.5 text-sm font-medium text-[#FF4B2B] hover:bg-zinc-50 transition-colors'
                                        onClick={handleLogOut}
                                    >
                                        Log Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
            {userData.role == "user" && <CartDrawer open={isCartOpen} onClose={() => setIsCartOpen(false)} />}
        </>
    )
}

export default Nav