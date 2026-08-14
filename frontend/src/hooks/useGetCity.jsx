import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setCurrentAddress, setCurrentCity, setCurrentState } from '../redux/userSlice'
import { setAddress, setLocation } from '../redux/mapSlice'

function useGetCity() {
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)
    const apiKey = import.meta.env.VITE_GEOAPIKEY

    useEffect(() => {
        // FIX (missing error handling): this was the only geolocation/fetch hook in the app
        // with no try/catch and no error callback on getCurrentPosition. If the reverse-geocode
        // call failed (bad/rate-limited key, network blip) or the user denied location
        // permission, currentCity/currentState/currentAddress silently never got set —
        // which cascades into empty "Best Shop"/"Suggested Items" sections downstream,
        // since those depend on currentCity.
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const latitude = position.coords.latitude
                    const longitude = position.coords.longitude
                    dispatch(setLocation({ lat: latitude, lon: longitude }))
                    const result = await axios.get(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&format=json&apiKey=${apiKey}`)
                    dispatch(setCurrentCity(result?.data?.results[0].city || result?.data?.results[0].county))
                    dispatch(setCurrentState(result?.data?.results[0].state))
                    dispatch(setCurrentAddress(result?.data?.results[0].address_line2 || result?.data?.results[0].address_line1))
                    dispatch(setAddress(result?.data?.results[0].address_line2))
                } catch (error) {
                    console.log(error)
                }
            },
            (error) => {
                console.log(error)
            },
            {
                enableHighAccuracy: true
            }
        )
    }, [userData])
}

export default useGetCity