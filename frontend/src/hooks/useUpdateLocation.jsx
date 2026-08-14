import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useSelector } from 'react-redux'

function useUpdateLocation() {
    const { userData } = useSelector(state => state.user)

    useEffect(() => {
        const updateLocation = async (lat, lon) => {
            try {
                const result = await axios.post(`${serverUrl}/api/user/update-location`, { lat, lon }, { withCredentials: true })
                console.log(result.data)
            } catch (error) {
                console.log(error)
            }
        }

        // NEW (Phase 4 — gate data-fetching hooks by role): this posts the user's live
        // location to the backend so the $near geospatial query in updateOrderStatus can
        // find nearby delivery boys. Only a "deliveryBoy" account's location is ever
        // queried that way — continuously watching and posting GPS for "user"/"owner"
        // accounts serves no purpose and just drains battery/data for no reason.
        let watchId
        if (userData?.role === "deliveryBoy" && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition((pos) => {
                updateLocation(pos.coords.latitude, pos.coords.longitude)
            })
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId)
        }
    }, [userData])
}

export default useUpdateLocation