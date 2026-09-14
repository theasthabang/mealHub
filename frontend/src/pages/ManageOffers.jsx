import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Tag } from 'lucide-react'
import { serverUrl } from '../App'
import Nav from '../components/Nav'
import OfferForm from '../components/OfferForm'
import OfferListItem from '../components/OfferListItem'
import { getErrorMessage } from '../utils/getErrorMessage'

// NEW: owner-side offer management page. All three actions (create, toggle,
// delete) call the real backend endpoints built in the offer.controllers.js
// chunk -- ownership/validation is enforced server-side; this page just
// reflects whatever the server actually accepted.
function ManageOffers() {
    const { myShopData } = useSelector(state => state.owner)
    const navigate = useNavigate()
    const [offers, setOffers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const shopId = myShopData?._id
    const items = myShopData?.items || []

    const fetchOffers = async () => {
        if (!shopId) return
        try {
            const result = await axios.get(`${serverUrl}/api/offer/my-offers/${shopId}`, { withCredentials: true })
            setOffers(result.data)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOffers()
    }, [shopId])

    const handleCreate = async (payload) => {
        setSubmitting(true)
        try {
            await axios.post(`${serverUrl}/api/offer/create`, { shopId, ...payload }, { withCredentials: true })
            toast.success("Offer created!")
            setShowForm(false)
            fetchOffers()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    const handleToggle = async (offerId) => {
        try {
            await axios.patch(`${serverUrl}/api/offer/toggle/${offerId}`, {}, { withCredentials: true })
            fetchOffers()
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    const handleDelete = async (offerId) => {
        try {
            await axios.delete(`${serverUrl}/api/offer/${offerId}`, { withCredentials: true })
            toast.success("Offer deleted")
            fetchOffers()
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }

    return (
        <div className='w-full min-h-screen bg-[#FAFAF9] pt-[68px]'>
            <Nav />
            <div className='max-w-2xl mx-auto px-4 sm:px-6 py-6'>
                <button onClick={() => navigate(-1)} className='flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 mb-4 text-sm'>
                    <ArrowLeft size={16} /> Back
                </button>

                <div className='flex items-center justify-between mb-5'>
                    <h1 className='text-xl font-bold text-zinc-900'>Manage Offers</h1>
                    <button
                        onClick={() => setShowForm(true)}
                        className='flex items-center gap-1.5 bg-[#FF4B2B] hover:bg-[#E94426] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors'
                    >
                        <Plus size={16} /> New Offer
                    </button>
                </div>

                {loading ? (
                    <div className='flex justify-center py-16'>
                        <div className='w-6 h-6 border-[3px] border-[#FF4B2B] border-t-transparent rounded-full animate-spin' />
                    </div>
                ) : offers.length === 0 ? (
                    <div className='flex flex-col items-center text-center py-16 bg-white rounded-2xl border border-zinc-100'>
                        <div className='w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center mb-3'>
                            <Tag size={20} className='text-zinc-300' />
                        </div>
                        <p className='text-sm font-medium text-zinc-700'>No offers yet</p>
                        <p className='text-xs text-zinc-400 mt-1'>Create one to start attracting more customers.</p>
                    </div>
                ) : (
                    <div className='flex flex-col gap-3'>
                        {offers.map(offer => (
                            <OfferListItem key={offer._id} offer={offer} onToggle={handleToggle} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>

            {showForm && (
                <OfferForm
                    items={items}
                    submitting={submitting}
                    onSubmit={handleCreate}
                    onClose={() => setShowForm(false)}
                />
            )}
        </div>
    )
}

export default ManageOffers