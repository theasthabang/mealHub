import React from 'react'

// NEW: previously shops were rendered with CategoryCard — the same small,
// bordered, icon-style tile used for category filters. A shop deserves more
// presence than a filter chip: it's the actual thing being chosen, so this
// gives it a larger image-forward card of its own, distinct from the
// category treatment above.
function ShopCard({ name, image, city, onClick }) {
  return (
    <button
      onClick={onClick}
      className='w-[200px] md:w-[240px] shrink-0 text-left rounded-2xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(43,33,28,0.08)] hover:shadow-[0_8px_24px_rgba(43,33,28,0.14)] transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D64933]'
    >
      <div className='w-full h-[130px] md:h-[150px] overflow-hidden bg-[#f4ede6]'>
        <img
          src={image}
          alt={name}
          className='w-full h-full object-cover transition-transform duration-500 hover:scale-105'
        />
      </div>
      <div className='p-3'>
        <h3 className='font-semibold text-[#2B211C] truncate'>{name}</h3>
        {city && <p className='text-xs text-[#2B211C]/55 mt-0.5'>{city}</p>}
      </div>
    </button>
  )
}

export default ShopCard