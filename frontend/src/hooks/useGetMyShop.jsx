import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setMyShopData } from '../redux/ownerSlice'

function useGetMyshop() {
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)

    useEffect(() => {
        // NEW (Phase 4 — gate data-fetching hooks by role): this endpoint only makes
        // sense for an "owner" account — a "user" or "deliveryBoy" doesn't have a shop.
        if (userData?.role !== "owner") return

        const fetchShop = async () => {
            try {
                const result = await axios.get(`${serverUrl}/api/shop/get-my`, { withCredentials: true })
                dispatch(setMyShopData(result.data))
            } catch (error) {
                console.log(error)
            }
        }
        fetchShop()
    }, [userData])
}

export default useGetMyshop