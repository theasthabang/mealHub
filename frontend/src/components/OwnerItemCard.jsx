import axios from 'axios';
import React, { useState } from 'react'
import { FaPen, FaTrashAlt, FaLeaf, FaDrumstickBite } from "react-icons/fa";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'
import { serverUrl } from '../App';
import { useDispatch } from 'react-redux';
import { setMyShopData } from '../redux/ownerSlice';
import { getErrorMessage } from '../utils/getErrorMessage';

function OwnerItemCard({ data }) {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const result = await axios.get(`${serverUrl}/api/item/delete/${data._id}`, { withCredentials: true })
            dispatch(setMyShopData(result.data))
            toast.success("Item deleted")
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setDeleting(false)
            setConfirmingDelete(false)
        }
    }

    const isVeg = data.foodType === "veg"

    return (
        // LAYOUT REDESIGN (dashboard density pass): fixed height reduced from h-40
        // (160px) to h-32 (128px) and image/padding scaled down to match — "reduce
        // the card height, smaller padding" from the compact-menu-list requirement.
        // Delete-confirmation is still the one state allowed to grow taller
        // (min-h-[128px] instead of the fixed h-32), same reasoning as before: fitting
        // the confirm message + two buttons into a fixed 128px row would clip them.
        <div className={`flex bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 w-full max-w-2xl flex-shrink-0 ${confirmingDelete ? 'min-h-[128px]' : 'h-32'}`}>
            {/* Image: fixed width, fills the full height of the card — shrunk from
                w-40 to w-32 to match the new card height */}
            <div className='w-32 flex-shrink-0 bg-gray-50'>
                <img src={data.image} alt="" className='w-full h-full object-cover' />
            </div>

            {/* Text section: padding reduced from p-4 to p-3 to fit the tighter card */}
            <div className='flex flex-col flex-1 min-w-0 p-3'>
                <div>
                    <h2 className='text-sm font-semibold text-gray-900 truncate'>{data.name || "Untitled item"}</h2>
                    {/* FIX: "Category: Snacks" / "Food Type: veg" as two full text
                        lines replaced with compact badges — reuses the same
                        veg/non-veg icon convention already used in FoodCard.jsx
                        (the customer-facing item card), so the two views are visually
                        consistent instead of the owner view using plain text where
                        the customer view already used icons. */}
                    <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                        {data.category && (
                            <span className='text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-[#ff4d2d] font-medium truncate max-w-[110px]'>
                                {data.category}
                            </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${isVeg ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {isVeg ? <FaLeaf size={9} /> : <FaDrumstickBite size={9} />}
                            {data.foodType || "—"}
                        </span>
                    </div>
                </div>

                {!confirmingDelete ? (
                    <div className='flex items-center justify-between mt-auto pt-2'>
                        <div className='text-[#ff4d2d] font-bold text-sm truncate'>₹{data.price ?? "—"}</div>
                        <div className='flex items-center gap-1 flex-shrink-0'>
                            <div className='p-1.5 cursor-pointer rounded-full hover:bg-[#ff4d2d]/10 text-[#ff4d2d]' onClick={() => navigate(`/edit-item/${data._id}`)}>
                                <FaPen size={14} />
                            </div>
                            <div className='p-1.5 cursor-pointer rounded-full hover:bg-red-50 text-red-500' onClick={() => setConfirmingDelete(true)}>
                                <FaTrashAlt size={14} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className='flex items-center justify-between gap-2 bg-red-50 border border-red-100 rounded-lg p-2 mt-auto'>
                        <span className='text-xs text-red-600 font-medium'>Delete this item?</span>
                        <div className='flex gap-2'>
                            <button
                                className='text-xs bg-red-500 text-white px-3 py-1.5 rounded-md hover:bg-red-600 disabled:opacity-50'
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting..." : "Yes, delete"}
                            </button>
                            <button
                                className='text-xs border px-3 py-1.5 rounded-md hover:bg-gray-50'
                                onClick={() => setConfirmingDelete(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default OwnerItemCard