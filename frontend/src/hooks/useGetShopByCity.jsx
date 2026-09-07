import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setShopsInMyCity, setShopInMyCityLoading } from '../redux/userSlice'

function useGetShopByCity() {
    const dispatch = useDispatch()
    const { currentCity, userData } = useSelector(state => state.user)

    useEffect(() => {
        // FIX (missing guard before fetch fires, already applied): skip if city not
        // resolved yet. Loading intentionally stays `true` here — this is still a
        // genuinely-in-progress state (geolocation resolving), not a "never
        // happening" one.
        if (!currentCity) return

        // NEW (Phase 4 — gate data-fetching hooks by role): this hook powers the
        // customer's shop-browsing list. It has no reason to fire for an "owner" or
        // "deliveryBoy" account — App.jsx calls every data hook unconditionally (hooks
        // can't be called conditionally per the Rules of Hooks), so the role check has
        // to live inside the hook's effect instead.
        //
        // FIX (loading-state fix, mirrors useGetMyOrders.jsx): previously there was
        // no loading flag at all here, so UserDashboard.jsx couldn't tell "still
        // fetching" apart from "genuinely no shops in this city" — briefly flashing
        // an empty state before real data arrived. For a role this hook never
        // fetches for, loading is resolved to false immediately so it doesn't get
        // stuck true forever.
        if (userData?.role !== "user") {
            dispatch(setShopInMyCityLoading(false))
            return
        }

        const fetchShops = async () => {
            dispatch(setShopInMyCityLoading(true))
            try {
                const result = await axios.get(`${serverUrl}/api/shop/get-by-city/${currentCity}`, { withCredentials: true })
                dispatch(setShopsInMyCity(result.data))
            } catch (error) {
                console.log(error)
            } finally {
                dispatch(setShopInMyCityLoading(false))
            }
        }
        fetchShops()
    }, [currentCity, userData?.role])
}

export default useGetShopByCity