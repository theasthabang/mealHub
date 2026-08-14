import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setShopsInMyCity } from '../redux/userSlice'

function useGetShopByCity() {
    const dispatch = useDispatch()
    const { currentCity, userData } = useSelector(state => state.user)

    useEffect(() => {
        // FIX (missing guard before fetch fires, already applied): skip if city not
        // resolved yet.
        if (!currentCity) return

        // NEW (Phase 4 — gate data-fetching hooks by role): this hook powers the
        // customer's shop-browsing list. It has no reason to fire for an "owner" or
        // "deliveryBoy" account — App.jsx calls every data hook unconditionally (hooks
        // can't be called conditionally per the Rules of Hooks), so the role check has
        // to live inside the hook's effect instead.
        if (userData?.role !== "user") return

        const fetchShops = async () => {
            try {
                const result = await axios.get(`${serverUrl}/api/shop/get-by-city/${currentCity}`, { withCredentials: true })
                dispatch(setShopsInMyCity(result.data))
            } catch (error) {
                console.log(error)
            }
        }
        fetchShops()
    }, [currentCity, userData?.role])
}

export default useGetShopByCity