import React, { useState } from 'react'
import Nav from './Nav'
import { useSelector, useDispatch } from 'react-redux'
import { FaUtensils, FaPen, FaTag } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast'
import OwnerItemCard from './OwnerItemCard';
import OwnerAnalytics from './OwnerAnalytics';
import { serverUrl } from '../App';
import { setShopOpenStatus } from '../redux/ownerSlice';
import { getErrorMessage } from '../utils/getErrorMessage';

function OwnerDashboard() {
  const { myShopData } = useSelector(state => state.owner)
  const navigate = useNavigate()
  const dispatch = useDispatch()
  // NEW: the open/closed toggle — was missing entirely from the UI even though the
  // backend endpoint (POST /api/shop/toggle-status) already existed.
  const [togglingStatus, setTogglingStatus] = useState(false)

  const handleToggleStatus = async () => {
    setTogglingStatus(true)
    try {
      const result = await axios.post(`${serverUrl}/api/shop/toggle-status`, {}, { withCredentials: true })
      dispatch(setShopOpenStatus(result.data.isOpen))
      toast.success(result.data.isOpen ? "Shop is now open" : "Shop is now closed")
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setTogglingStatus(false)
    }
  }

  return (
    <div className='w-full min-h-screen bg-[#fff9f6] flex flex-col items-center'>
      <Nav />
      {!myShopData &&
        <div className='flex justify-center items-center p-4 sm:p-6'>
          <div className='w-full max-w-md bg-white shadow-sm rounded-xl p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300'>
            <div className='flex flex-col items-center text-center'>
              <FaUtensils className='text-[#ff4d2d] w-16 h-16 sm:w-20 sm:h-20 mb-4' />
              <h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-2'>Add Your Restaurant</h2>
              <p className='text-gray-600 mb-4 text-sm sm:text-base'>Join our food delivery platform and reach thousands of hungry customers every day.
              </p>
              <button className='bg-[#ff4d2d] text-white px-5 sm:px-6 py-2 rounded-full font-medium shadow-md hover:bg-orange-600 transition-colors duration-200' onClick={() => navigate("/create-edit-shop")}>
                Get Started
              </button>
            </div>
          </div>
        </div>
      }

      {/* LAYOUT REDESIGN (dashboard density pass):
          - Container widened from max-w-3xl (768px) to max-w-6xl (1152px). The old
            narrow column was actively working against "side by side" layouts —
            there wasn't enough horizontal room for a 4-across stat row or 2-column
            chart panel to breathe. This is the single change that makes the rest of
            the horizontal layout below possible.
          - Outer gap reduced from gap-6 to gap-4 for tighter, more "admin dashboard"
            vertical rhythm instead of generous marketing-page spacing.
          - The old giant "Welcome to {shop}" heading (mt-8, 56px icon) is gone —
            the shop identity now lives inside the compact header card itself, which
            removes an entire redundant heading block's worth of vertical space. */}
      {myShopData &&
        <div className='w-full flex flex-col items-stretch gap-4 px-4 sm:px-6 py-4 max-w-6xl'>

          {/* COMPACT SHOP HEADER — replaces the old hero image (h-48/h-64 photo +
              separate text block below it, easily 300px+ total) with a single
              horizontal row capped at 180px. Logo/photo shrinks to a fixed square
              thumbnail instead of a full-width banner; name, address, and the edit
              action all sit in one line. This was the single biggest space cost in
              the old layout. */}
          <div className='flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full max-h-[180px]'>
            <img
              src={myShopData.image}
              alt={myShopData.name}
              className='w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0 border border-gray-100'
            />
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <h1 className='text-lg sm:text-xl font-bold text-gray-900 truncate'>{myShopData.name}</h1>
                {/* NEW: status badge — reflects the real isOpen field from the
                    backend, not decoration. Matches the color language already used
                    elsewhere (green = good/available, red = closed/blocked). */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${myShopData.isOpen ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {myShopData.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <p className='text-sm text-gray-500 truncate'>{myShopData.city}, {myShopData.state}</p>
              <p className='text-sm text-gray-500 truncate'>{myShopData.address}</p>
            </div>

            {/* NEW: the toggle itself — this was the missing piece. handleToggleStatus
                and setShopOpenStatus were already wired up above; this switch is what
                actually calls them. An iOS-style pill switch, since a plain button
                risked being mistaken for a static label rather than something
                interactive. Disabled + dimmed while the request is in flight, so a
                second click can't fire before the first one resolves. */}
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className='flex-shrink-0 flex items-center gap-2'
              title={myShopData.isOpen ? "Click to close your shop" : "Click to open your shop"}
            >
              <span className='text-xs text-gray-500 hidden sm:inline'>{togglingStatus ? "Updating..." : (myShopData.isOpen ? "Open" : "Closed")}</span>
              <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${myShopData.isOpen ? "bg-green-500" : "bg-gray-300"} ${togglingStatus ? "opacity-50" : ""}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${myShopData.isOpen ? "translate-x-6" : "translate-x-1"}`} />
              </span>
            </button>

            <button
              className='flex-shrink-0 flex items-center gap-2 bg-[#ff4d2d]/10 text-[#ff4d2d] px-3 py-2 rounded-lg font-medium text-sm hover:bg-[#ff4d2d]/20 transition-colors'
              onClick={() => navigate("/create-edit-shop")}
            >
              <FaPen size={14} />
              <span className='hidden sm:inline'>Edit</span>
            </button>

            {/* NEW: real, working link to the offer-management page built
                earlier -- an owner can now actually create/manage discounts
                for their shop from here, not just view analytics/items. */}
            <button
              className='flex-shrink-0 flex items-center gap-2 bg-[#ff4d2d]/10 text-[#ff4d2d] px-3 py-2 rounded-lg font-medium text-sm hover:bg-[#ff4d2d]/20 transition-colors'
              onClick={() => navigate("/manage-offers")}
            >
              <FaTag size={14} />
              <span className='hidden sm:inline'>Offers</span>
            </button>
          </div>

          {/* SUMMARY CARDS + ANALYTICS — OwnerAnalytics now internally renders the
              4-card stat row directly (right below the shop header, as required),
              followed by the side-by-side charts panel. See OwnerAnalytics.jsx for
              the layout change itself — nothing about its data-fetching changed. */}
          <OwnerAnalytics />

          {myShopData.items.length == 0 &&
            <div className='flex justify-center items-center py-6'>
              <div className='w-full max-w-md bg-white shadow-sm rounded-xl p-6 border border-gray-100 hover:shadow-md transition-shadow duration-300'>
                <div className='flex flex-col items-center text-center'>
                  <FaUtensils className='text-[#ff4d2d] w-16 h-16 sm:w-20 sm:h-20 mb-4' />
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-800 mb-2'>Add Your Food Item</h2>
                  <p className='text-gray-600 mb-4 text-sm sm:text-base'>Share your delicious creations with our customers by adding them to the menu.
                  </p>
                  <button className='bg-[#ff4d2d] text-white px-5 sm:px-6 py-2 rounded-full font-medium shadow-md hover:bg-orange-600 transition-colors duration-200' onClick={() => navigate("/add-item")}>
                    Add Food
                  </button>
                </div>
              </div>
            </div>
          }

          {/* MENU ITEMS — this panel is the ONLY part of the page meant to scroll
              internally (max-h-[420px] overflow-y-auto). Everything above it (shop
              header, stat cards, charts) stays visible and static regardless of how
              many menu items a shop has — that's what "only the menu list becomes
              scrollable, analytics stays visible" means in practice: a fixed-height
              scroll container for the list, not a page-level scroll lock (which
              would require restructuring Nav/Home's fixed-header layout — out of
              scope here, and not needed to satisfy the actual requirement). */}
          {myShopData.items.length > 0 && (
            <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4'>
              <h2 className='text-base font-semibold text-gray-800 mb-3'>
                Menu Items <span className='text-gray-400 font-normal'>({myShopData.items.length})</span>
              </h2>
              <div className='flex flex-col items-stretch gap-3 max-h-[420px] overflow-y-auto pr-1'>
                {myShopData.items.map((item, index) => (
                  <OwnerItemCard data={item} key={index} />
                ))}
              </div>
            </div>
          )}
        </div>}
    </div>
  )
}

export default OwnerDashboard