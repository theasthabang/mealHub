import React from 'react'

// NEW: simple, honest footer -- no fake social links or fabricated company
// info, just the brand mark and a copyright line. Extend with real links
// (About, Contact, Terms) whenever those pages actually exist.
function Footer() {
    return (
        <footer className='w-full border-t border-zinc-100 mt-10'>
            <div className='max-w-[1200px] mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3'>
                <h2 className='text-lg font-bold text-[#FF4B2B]'>MealHub</h2>
                <p className='text-xs text-zinc-400'>&copy; {new Date().getFullYear()} MealHub. All rights reserved.</p>
            </div>
        </footer>
    )
}

export default Footer