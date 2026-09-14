import React from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'

// NEW: the one genuinely real, live piece of "restaurant info" this app has --
// shop.isOpen. The original Shop.jsx already handled the closed-state banner
// thoughtfully (high-contrast, full-width, impossible to miss before
// browsing a menu you can't order from) -- that exact behavior is preserved
// here, just extracted into its own component. When open, shows a quieter
// confirmation instead of nothing, so the open/closed state is always
// visible either way, not just when there's bad news.
function RestaurantMeta({ isOpen }) {
    if (isOpen) {
        return (
            <div className='flex items-center gap-2 mt-4'>
                <CircleCheck size={16} className='text-[#16A34A]' />
                <span className='text-sm font-medium text-[#16A34A]'>Open now</span>
            </div>
        )
    }

    return (
        <div className='bg-red-50 border border-red-100 rounded-xl mt-4 px-4 py-3 flex items-center gap-3'>
            <CircleAlert className='text-red-500 shrink-0' size={20} />
            <div>
                <p className='text-red-700 font-semibold text-sm'>This shop is currently closed</p>
                <p className='text-red-500 text-xs mt-0.5'>You can browse the menu, but ordering is disabled until it reopens.</p>
            </div>
        </div>
    )
}

export default RestaurantMeta