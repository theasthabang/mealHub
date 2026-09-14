import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import SignUp from './pages/SignUp'
import SignIn from './pages/SignIn'
import ForgotPassword from './pages/ForgotPassword'
import useGetCurrentUser from './hooks/useGetCurrentUser'
import { useDispatch, useSelector } from 'react-redux'
import Home from './pages/Home'
import useGetCity from './hooks/useGetCity'
import useGetMyshop from './hooks/useGetMyShop'
import CreateEditShop from './pages/CreateEditShop'
import AddItem from './pages/AddItem'
import EditItem from './pages/EditItem'
import ManageOffers from './pages/ManageOffers'
import useGetShopByCity from './hooks/useGetShopByCity'
import useGetItemsByCity from './hooks/useGetItemsByCity'
import CartPage from './pages/CartPage'
import CheckOut from './pages/CheckOut'
import OrderPlaced from './pages/OrderPlaced'
import MyOrders from './pages/MyOrders'
import useGetMyOrders from './hooks/useGetMyOrders'
import useUpdateLocation from './hooks/useUpdateLocation'
import TrackOrderPage from './pages/TrackOrderPage'
import Shop from './pages/Shop'
import NotFound from './pages/NotFound'
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { setSocket } from './redux/userSlice'
import { Toaster } from 'react-hot-toast'
// NEW (Phase 4): side-effect import — registers the global axios 401 interceptor.
// Must run before any request fires; doesn't export anything itself.
import './utils/axiosInterceptor'

// FIX (deployment readiness): this was hardcoded to localhost:8000 — every single
// axios call across the entire frontend, and the socket.io connection below, import
// this constant. Left as-is, the deployed app would try to reach localhost from
// every visitor's own browser and fail completely. VITE_SERVER_URL needs to be set
// in your frontend's production environment to your actual deployed backend URL
// (e.g. https://your-api.onrender.com) — the localhost value only applies when that
// variable isn't set, i.e. local development.
export const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:8000"

// NEW (Phase 4 — role-based route guards): previously every protected route only
// checked `userData ? <Page/> : <Navigate to="/signin"/>` — i.e. "is anyone logged in,"
// not "is this the right role for this page." A `role: "user"` account could navigate
// straight to /add-item or /create-edit-shop in the URL bar and the page would render
// (the actual data operations happened to fail server-side, but the page itself had no
// guard). This wraps a route in both checks: not logged in -> /signin; logged in but
// wrong role -> redirected to / instead of seeing a page that isn't meant for them.
function RoleRoute({ allowedRoles, children }) {
    const { userData } = useSelector(state => state.user)
    if (!userData) return <Navigate to="/signin" />
    if (!allowedRoles.includes(userData.role)) return <Navigate to="/" />
    return children
}

function App() {
    const { userData } = useSelector(state => state.user)
    const dispatch = useDispatch()
    useGetCurrentUser()
    useUpdateLocation()
    useGetCity()
    useGetMyshop()
    useGetShopByCity()
    useGetItemsByCity()
    useGetMyOrders()

    useEffect(() => {
        // FIX (wasted, continuously-retrying failed connections on public
        // pages): this used to connect a socket unconditionally on every
        // mount — including on /signin, /signup, and before
        // useGetCurrentUser() has resolved whether anyone is even logged in.
        // Since socket.js's handshake requires a valid JWT cookie, every one
        // of those connection attempts before login gets rejected — and
        // Socket.IO's client automatically retries reconnecting by default,
        // meaning a visitor simply sitting on the sign-in page generated a
        // continuous loop of failed connection attempts in the background
        // for no reason at all. Only connect once there's an actual
        // logged-in user.
        if (!userData) return

        const socketInstance = io(serverUrl, { withCredentials: true })
        dispatch(setSocket(socketInstance))
        socketInstance.on('connect', () => {
            socketInstance.emit('identity', { userId: userData._id })
        })
        return () => {
            socketInstance.disconnect()
        }
    }, [userData?._id])

    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        borderRadius: '12px',
                        background: '#fff',
                        color: '#1f2937',
                        fontSize: '14px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    },
                    success: {
                        iconTheme: { primary: '#ff4d2d', secondary: '#fff' },
                    },
                    error: {
                        iconTheme: { primary: '#ef4444', secondary: '#fff' },
                    },
                }}
            />
            <Routes>
                <Route path='/signup' element={!userData ? <SignUp /> : <Navigate to={"/"} />} />
                <Route path='/signin' element={!userData ? <SignIn /> : <Navigate to={"/"} />} />
                <Route path='/forgot-password' element={!userData ? <ForgotPassword /> : <Navigate to={"/"} />} />
                <Route path='/' element={userData ? <Home /> : <Navigate to={"/signin"} />} />

                {/* Owner-only routes */}
                <Route path='/create-edit-shop' element={<RoleRoute allowedRoles={["owner"]}><CreateEditShop /></RoleRoute>} />
                <Route path='/add-item' element={<RoleRoute allowedRoles={["owner"]}><AddItem /></RoleRoute>} />
                <Route path='/edit-item/:itemId' element={<RoleRoute allowedRoles={["owner"]}><EditItem /></RoleRoute>} />
                <Route path='/manage-offers' element={<RoleRoute allowedRoles={["owner"]}><ManageOffers /></RoleRoute>} />

                {/* Customer-only routes */}
                <Route path='/cart' element={<RoleRoute allowedRoles={["user"]}><CartPage /></RoleRoute>} />
                <Route path='/checkout' element={<RoleRoute allowedRoles={["user"]}><CheckOut /></RoleRoute>} />
                <Route path='/order-placed' element={<RoleRoute allowedRoles={["user"]}><OrderPlaced /></RoleRoute>} />
                <Route path='/track-order/:orderId' element={<RoleRoute allowedRoles={["user"]}><TrackOrderPage /></RoleRoute>} />
                <Route path='/shop/:shopId' element={<RoleRoute allowedRoles={["user"]}><Shop /></RoleRoute>} />

                {/* Shared between customer and owner (MyOrders.jsx branches internally) */}
                <Route path='/my-orders' element={<RoleRoute allowedRoles={["user", "owner"]}><MyOrders /></RoleRoute>} />

                {/* NEW (Phase 4 — 404 route): catch-all for any unmatched URL */}
                <Route path='*' element={<NotFound />} />
            </Routes>
        </>
    )
}

export default App