import React, { useEffect, useRef, useState } from 'react'
import { FaLocationDot } from "react-icons/fa6";
import { FiShoppingCart } from "react-icons/fi";
import { useDispatch, useSelector } from 'react-redux';
import { IoIosSearch } from "react-icons/io";
import { RxCross2 } from "react-icons/rx";
import axios from 'axios';
import { serverUrl } from '../App';
import { setUserData } from '../redux/userSlice';
import { FaPlus } from "react-icons/fa6";
import { TbReceipt2 } from "react-icons/tb";
import { useNavigate } from 'react-router-dom';
import SearchDropdown from './SearchDropdown';
import toast from 'react-hot-toast'
import { incrementNewOrderCount, resetNewOrderCount } from '../redux/ownerSlice';

function Nav() {
    const { userData, currentCity, cartItems, socket } = useSelector(state => state.user)
    const { myShopData, newOrderCount } = useSelector(state => state.owner)
    const [showInfo, setShowInfo] = useState(false)
    const [showSearch, setShowSearch] = useState(false)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    // Click-outside-to-close for the account dropdown. dropdownRef wraps both the
    // avatar trigger AND the dropdown panel, so clicking the avatar (which opens it)
    // isn't itself treated as an "outside" click that immediately closes it again.
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

    // NEW: real-time "new order" notification for the owner, wherever they happen
    // to be in the app — not just the My Orders page. Previously this listener
    // only existed inside MyOrders.jsx, so an owner sitting on the dashboard (or
    // add-item, or anywhere else) got no notification at all until they happened
    // to navigate to My Orders. Nav is the one component rendered on every owner
    // dashboard page, so the listener lives here instead. Ownership check mirrors
    // the one already used in MyOrders.jsx — this event is broadcast to the shop's
    // own socket only (see placeOrder in order.controllers.js), so the check here
    // is a defensive match rather than the real security boundary, same as there.
    useEffect(() => {
        if (!socket || userData.role !== "owner") return

        const handleNewOrder = (data) => {
            if (data.shopOrders?.owner._id == userData._id) {
                dispatch(incrementNewOrderCount())
                toast.success(
                    `New order from ${data.deliveryAddress?.text || "a customer"}!`,
                    { icon: '📦', duration: 6000 }
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
        // NEW (broader glass restyle): the Nav bar itself is now a translucent,
        // blurred surface instead of a flat solid color — scoped deliberately to just
        // the Nav/search experience, not a restyle of every page in the app.
        <div className='w-full h-[80px] flex items-center justify-between md:justify-center gap-[30px] px-[20px] fixed top-0 z-[9999] bg-[#fff9f6]/70 backdrop-blur-md border-b border-white/40 overflow-visible'>

            {showSearch && userData.role == "user" && (
                <div className='w-[90%] fixed top-[80px] left-[5%] md:hidden flex items-center gap-2'>
                    {/* FIX (layout): location now sits inline beside search instead of
                        stacked above it — same fix as the desktop bar below */}
                    <div className='flex items-center gap-1.5 h-[52px] px-3 rounded-full bg-white/60 backdrop-blur-md border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.06)] flex-shrink-0 max-w-[100px]'>
                        <FaLocationDot size={14} className='text-[#ff4d2d] flex-shrink-0' />
                        <span className='text-xs text-gray-600 truncate'>{currentCity}</span>
                    </div>
                    <div className='flex-1'>
                        <SearchDropdown variant="mobile" />
                    </div>
                </div>
            )}

            <h1 className='text-3xl font-bold mb-2 text-[#ff4d2d]'>MealHub</h1>

            {/* FIX (navbar layout): location was previously stacked in its own line
                ABOVE the search bar (flex-col), inside a fixed-height 80px navbar.
                That two-line block couldn't vertically center the same way the
                single-height logo/cart/avatar items do, which is what made the
                location text visually "float above" the navbar row instead of
                sitting inside it. Now location and search sit side by side in one
                row, both the same 52px height, so the whole navbar is genuinely one
                aligned row — logo, location, search, cart, orders, avatar all on the
                same line. SearchDropdown itself is untouched; only this wrapper
                changed. */}
            {userData.role == "user" && (
                <div className='md:w-[60%] lg:w-[42%] hidden md:flex items-center gap-2'>
                    <div className='flex items-center gap-1.5 h-[52px] px-3 rounded-full bg-white/60 backdrop-blur-md border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.06)] flex-shrink-0 max-w-[130px]'>
                        <FaLocationDot size={14} className='text-[#ff4d2d] flex-shrink-0' />
                        <span className='text-xs text-gray-600 truncate'>{currentCity}</span>
                    </div>
                    <div className='flex-1'>
                        <SearchDropdown variant="desktop" />
                    </div>
                </div>
            )}

            <div className='flex items-center gap-4'>
                {userData.role == "user" && (showSearch ? <RxCross2 size={25} className='text-[#ff4d2d] md:hidden' onClick={() => setShowSearch(false)} /> : <IoIosSearch size={25} className='text-[#ff4d2d] md:hidden' onClick={() => setShowSearch(true)} />)
                }
                {userData.role == "owner" ? <>
                    {myShopData && <> <button className='hidden md:flex items-center gap-1 p-2 cursor-pointer rounded-full bg-[#ff4d2d]/10 text-[#ff4d2d]' onClick={() => navigate("/add-item")}>
                        <FaPlus size={20} />
                        <span>Add Food Item</span>
                    </button>
                        <button className='md:hidden flex items-center  p-2 cursor-pointer rounded-full bg-[#ff4d2d]/10 text-[#ff4d2d]' onClick={() => navigate("/add-item")}>
                            <FaPlus size={20} />
                        </button></>}

                    {/* NEW: badge shows how many new orders have come in since the
                        owner last opened My Orders — same visual pattern as the
                        customer's cart-count badge below, for consistency. Clicking
                        through clears it, since "unseen" only matters until they've
                        actually looked at the list. */}
                    <div className='hidden md:flex items-center gap-2 cursor-pointer relative px-3 py-1 rounded-lg bg-[#ff4d2d]/10 text-[#ff4d2d] font-medium' onClick={() => { dispatch(resetNewOrderCount()); navigate("/my-orders") }}>
                        <TbReceipt2 size={20} />
                        <span>My Orders</span>
                        {newOrderCount > 0 && (
                            <span className='absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ff4d2d] text-white text-[11px] font-semibold leading-none'>
                                {newOrderCount}
                            </span>
                        )}
                    </div>
                    <div className='md:hidden flex items-center gap-2 cursor-pointer relative px-3 py-1 rounded-lg bg-[#ff4d2d]/10 text-[#ff4d2d] font-medium' onClick={() => { dispatch(resetNewOrderCount()); navigate("/my-orders") }}>
                        <TbReceipt2 size={20} />
                        {newOrderCount > 0 && (
                            <span className='absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ff4d2d] text-white text-[11px] font-semibold leading-none'>
                                {newOrderCount}
                            </span>
                        )}
                    </div>
                </> : (
                    <>
                        {userData.role == "user" && <div className='relative cursor-pointer' onClick={() => navigate("/cart")}>
                            <FiShoppingCart size={25} className='text-[#ff4d2d]' />
                            {cartItems.length > 0 && (
                                <span className='absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ff4d2d] text-white text-[11px] font-semibold leading-none'>
                                    {cartItems.length}
                                </span>
                            )}
                        </div>}

                        <button className='hidden md:block px-3 py-1 rounded-lg bg-[#ff4d2d]/10 text-[#ff4d2d] text-sm font-medium' onClick={() => navigate("/my-orders")}>
                            My Orders
                        </button>
                    </>
                )}

                <div ref={dropdownRef} className='relative'>
                    <div className='w-[40px] h-[40px] rounded-full flex items-center justify-center bg-[#ff4d2d] text-white text-[18px] shadow-xl font-semibold cursor-pointer' onClick={() => setShowInfo(prev => !prev)}>
                        {userData?.fullName.slice(0, 1)}
                    </div>
                    {/* FIX (dropdown placement): was `fixed top-[80px] right-[10px]` with
                        extra `md:right-[10%] lg:right-[25%]` (or `20%`/`40%` for delivery
                        boys) percentage offsets guessed per breakpoint. Those percentages
                        are relative to the VIEWPORT width, not to the avatar's actual x
                        position, so at any window width between breakpoints the panel
                        drifted away from the avatar that opened it — the misaligned,
                        floating-off-to-the-side placement seen in testing. Switched to
                        `absolute top-full right-0`, positioned relative to THIS wrapper
                        (which already wraps the avatar too, per the click-outside ref
                        above) — the dropdown is now always anchored directly under the
                        avatar, at any width, with no magic numbers to maintain per role.
                        Styling pass alongside it: an avatar+name header row (ties the
                        panel visually back to who's logged in), a divider, and real
                        hover states instead of bare colored text. */}
                    {showInfo && (
                        <div className='absolute top-full right-0 mt-3 w-[220px] bg-white/95 backdrop-blur-md shadow-2xl rounded-xl overflow-hidden z-[9999] border border-white/60'>
                            <div className='flex items-center gap-3 px-4 py-3'>
                                <div className='w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-[#ff4d2d] text-white text-sm font-semibold'>
                                    {userData?.fullName.slice(0, 1)}
                                </div>
                                <div className='min-w-0'>
                                    <div className='text-sm font-semibold text-gray-900 truncate'>{userData.fullName}</div>
                                    <div className='text-xs text-gray-400 capitalize'>{userData.role === "deliveryBoy" ? "Delivery Partner" : userData.role}</div>
                                </div>
                            </div>
                            <div className='h-px bg-gray-100' />
                            <div className='py-1'>
                                {userData.role == "user" && (
                                    <button
                                        className='w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-[#ff4d2d] transition-colors md:hidden'
                                        onClick={() => { setShowInfo(false); navigate("/my-orders") }}
                                    >
                                        My Orders
                                    </button>
                                )}
                                <button
                                    className='w-full text-left px-4 py-2.5 text-sm font-medium text-[#ff4d2d] hover:bg-orange-50 transition-colors'
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
    )
}

export default Nav