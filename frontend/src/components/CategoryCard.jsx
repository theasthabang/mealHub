import React from 'react'

// REDESIGN: sized down to the 64-72px compact circular treatment from the
// reference (previously 76-92px). Deliberately kept as a horizontal-scroll
// carousel at every screen size, not a wrapping grid -- this is an
// intentional pattern (same as Netflix/Amazon/Swiggy's own category rows),
// not a mobile-only fallback.
function CategoryCard({ name, image, onClick, active = false }) {
    return (
        <button
            onClick={onClick}
            className='flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none'
        >
            <div
                className={`w-16 h-16 md:w-[72px] md:h-[72px] rounded-full overflow-hidden bg-white transition-all duration-200
          ${active ? 'ring-2 ring-[#FF4B2B] ring-offset-2' : 'ring-1 ring-zinc-100 group-hover:ring-[#FF4B2B]/40'}`}
            >
                <img
                    src={image}
                    alt={name}
                    className='w-full h-full object-cover transition-transform duration-300 group-hover:scale-110'
                />
            </div>
            <span className={`text-xs font-medium transition-colors ${active ? 'text-[#FF4B2B]' : 'text-zinc-600 group-hover:text-zinc-900'}`}>
                {name}
            </span>
        </button>
    )
}

export default CategoryCard