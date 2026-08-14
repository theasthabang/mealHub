import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch, useSelector } from 'react-redux'
import { setMyOrders, setMyOrdersLoading } from '../redux/userSlice'

function useGetMyOrders() {
    const dispatch = useDispatch()
    const { userData } = useSelector(state => state.user)

    useEffect(() => {
        if (userData?.role !== "user" && userData?.role !== "owner") {
            // NEW (loading-state fix): if this role never fetches orders (e.g.
            // deliveryBoy, or not logged in yet), there's nothing to wait for — make
            // sure loading doesn't get stuck true forever for those cases.
            dispatch(setMyOrdersLoading(false))
            return
        }

        const fetchOrders = async () => {
            dispatch(setMyOrdersLoading(true))
            try {
                const result = await axios.get(`${serverUrl}/api/order/my-orders`, { withCredentials: true })
                dispatch(setMyOrders(result.data))
            } catch (error) {
                console.log(error)
            } finally {
                // NEW (loading-state fix): this is the actual fix — loading only flips
                // to false once the request has genuinely finished (success OR failure),
                // so MyOrders.jsx can now tell "still loading" apart from "loaded, and
                // there are zero orders."
                dispatch(setMyOrdersLoading(false))
            }
        }
        fetchOrders()
    }, [userData])
}

export default useGetMyOrders