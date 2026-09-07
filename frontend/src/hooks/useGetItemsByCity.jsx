import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setItemsInMyCity, setItemsInMyCityLoading } from '../redux/userSlice'

function useGetItemsByCity() {
    const dispatch = useDispatch()
    const { currentCity, userData } = useSelector(state => state.user)

    useEffect(() => {
        if (!currentCity) return

        // NEW (Phase 4 — gate data-fetching hooks by role): same reasoning as
        // useGetShopByCity — only the customer view needs this.
        //
        // FIX (loading-state fix, mirrors useGetMyOrders.jsx): see useGetShopByCity.jsx
        // for the full reasoning — same fix applied here for itemsInMyCity.
        if (userData?.role !== "user") {
            dispatch(setItemsInMyCityLoading(false))
            return
        }

        const fetchItems = async () => {
            dispatch(setItemsInMyCityLoading(true))
            try {
                const result = await axios.get(`${serverUrl}/api/item/get-by-city/${currentCity}`, { withCredentials: true })
                dispatch(setItemsInMyCity(result.data))
            } catch (error) {
                console.log(error)
            } finally {
                dispatch(setItemsInMyCityLoading(false))
            }
        }
        fetchItems()
    }, [currentCity, userData?.role])
}

export default useGetItemsByCity