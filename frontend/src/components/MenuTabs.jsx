import React from 'react'

// NEW: category navigation, built entirely from REAL category names --
// passed in as `categories`, computed by the parent from the actual distinct
// values in this shop's items (plus "Popular" prepended, which is a real,
// derived view -- top-rated items using the genuine Item.rating field, not
// an invented category). Sticky below the main Nav (which is a fixed 68px
// bar -- see Nav.jsx), horizontal-scrolling on mobile, full row on desktop.
function MenuTabs({ categories, activeCategory, onSelect }) {
    return (
        <div className='sticky top-[68px] z-30 bg-[#FAFAF9]/95 backdrop-blur-sm border-b border-zinc-100 -mx-4 px-4 sm:mx-0 sm:px-0'>
            <div className='flex gap-6 overflow-x-auto py-3' style={{ scrollbarWidth: 'none' }}>
                {categories.map((cat) => {
                    const isActive = activeCategory === cat
                    return (
                        <button
                            key={cat}
                            onClick={() => onSelect(cat)}
                            className={`shrink-0 text-sm pb-2 border-b-2 transition-colors ${isActive
                                    ? 'text-[#FF4B2B] font-semibold border-[#FF4B2B]'
                                    : 'text-zinc-500 border-transparent hover:text-zinc-800'
                                }`}
                        >
                            {cat}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default MenuTabs