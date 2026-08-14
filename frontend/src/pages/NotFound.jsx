import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FaUtensils } from "react-icons/fa"

// NEW (Phase 4 — 404 route): previously any unmatched URL rendered a blank page with
// no explanation and no way back. This gives the user a clear message and a way home,
// styled consistently with the rest of the app (cream background, brand orange accent).
function NotFound() {
    const navigate = useNavigate()
    return (
        <div className='min-h-screen w-full flex flex-col items-center justify-center bg-[#fff9f6] px-4 text-center'>
            <div className='bg-orange-100 p-5 rounded-full mb-5'>
                <FaUtensils className='text-[#ff4d2d] w-12 h-12' />
            </div>
            <h1 className='text-5xl font-extrabold text-gray-800 mb-2'>404</h1>
            <p className='text-lg font-semibold text-gray-700 mb-1'>Page not found</p>
            <p className='text-gray-500 mb-6 max-w-sm'>The page you're looking for doesn't exist or may have been moved.</p>
            <button
                className='bg-[#ff4d2d] hover:bg-[#e64526] text-white px-6 py-3 rounded-lg font-medium transition'
                onClick={() => navigate("/")}
            >
                Back to Home
            </button>
        </div>
    )
}

export default NotFound