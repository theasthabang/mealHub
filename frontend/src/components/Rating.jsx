import React from 'react'
import { Star } from 'lucide-react'

// Reusable rating display — used by FoodCard (real data: data.rating.average/count
// from the Item schema). NOT used on restaurant cards, since Shop has no rating
// field in the actual data model — adding a fake number there would be showing
// real users false information about a real business.
function Rating({ average = 0, count = 0, size = 14 }) {
    return (
        <div className='flex items-center gap-1'>
            <Star size={size} className='fill-[#FF4B2B] text-[#FF4B2B]' />
            <span className='text-xs font-medium text-zinc-700'>{average.toFixed(1)}</span>
            {count > 0 && <span className='text-xs text-zinc-400'>({count})</span>}
        </div>
    )
}

export default Rating