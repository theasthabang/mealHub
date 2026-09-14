import React from 'react'

// Reusable stat card for the delivery-partner dashboard -- small icon, title,
// large value, optional "vs yesterday" comparison. Comparison is only shown
// when a real number is passed in (no fabricated "+12%" placeholders).
function StatCard({ icon, iconBg, title, value, comparisonText }) {
    return (
        <div className='rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm'>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3`} style={{ backgroundColor: iconBg }}>
                {icon}
            </div>
            <p className='text-2xl font-bold text-[#18181B]'>{value}</p>
            <p className='text-sm text-[#71717A] mt-0.5'>{title}</p>
            {comparisonText && (
                <p className='text-xs text-[#16A34A] mt-2 font-medium'>{comparisonText}</p>
            )}
        </div>
    )
}

export default StatCard