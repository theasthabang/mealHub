import React from 'react'
import { useState } from 'react';
import { FaRegEye } from "react-icons/fa";
import { FaRegEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from 'react-router-dom';
import axios from "axios"
import toast from 'react-hot-toast'
import { serverUrl } from '../App';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase';
import { ClipLoader } from "react-spinners"
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import { getErrorMessage } from '../utils/getErrorMessage';

function SignUp() {
    const primaryColor = "#ff4d2d";
    const hoverColor = "#e64323";
    const bgColor = "#fff9f6";
    const borderColor = "#ddd";
    const [showPassword, setShowPassword] = useState(false)
    const [role, setRole] = useState("user")
    const navigate = useNavigate()
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [mobile, setMobile] = useState("")
    const [loading, setLoading] = useState(false)
    const dispatch = useDispatch()

    // FIX (toast notifications): replaced inline `err` state + <p> block with toasts
    const handleSignUp = async () => {
        setLoading(true)
        try {
            const result = await axios.post(`${serverUrl}/api/auth/signup`, {
                fullName, email, password, mobile, role
            }, { withCredentials: true })
            dispatch(setUserData(result.data))
            setLoading(false)
        } catch (error) {
            toast.error(getErrorMessage(error))
            setLoading(false)
        }
    }

    const [pendingGoogleUser, setPendingGoogleUser] = useState(null) // { email, fullName } once Google succeeds but mobile is still needed
    const [googleMobile, setGoogleMobile] = useState("")
    const [googleLoading, setGoogleLoading] = useState(false)

    // FIX (rebuilt flow): this used to block on `if (!mobile) return toast.error(...)`
    // BEFORE the Google popup ever opened — meaning "Sign up with Google" wasn't
    // actually a one-click flow at all, it required manually filling in a form field
    // first, which defeats a lot of the point of Google sign-up existing. Now the
    // popup opens immediately. The backend tells us afterward if it actually needs
    // a mobile number (`needsMobile: true`) — only THEN do we show a quick follow-up
    // step, using the name/email Google already gave us, instead of gating the
    // button itself.
    const handleGoogleAuth = async () => {
        setGoogleLoading(true)
        try {
            const provider = new GoogleAuthProvider()
            const result = await signInWithPopup(auth, provider)
            const { data } = await axios.post(`${serverUrl}/api/auth/google-auth`, {
                fullName: result.user.displayName,
                email: result.user.email,
                role
            }, { withCredentials: true })

            if (data.needsMobile) {
                setPendingGoogleUser({ email: data.email, fullName: data.fullName })
            } else {
                dispatch(setUserData(data))
            }
        } catch (error) {
            console.error("Google auth error:", error)
            toast.error(getErrorMessage(error))
        } finally {
            setGoogleLoading(false)
        }
    }

    // NEW: the follow-up step — completes account creation using the name/email
    // already obtained from Google, plus the mobile number just typed in. No second
    // Google popup needed.
    const handleCompleteGoogleSignup = async () => {
        if (!googleMobile || googleMobile.length < 10) {
            return toast.error("Please enter a valid mobile number")
        }
        setGoogleLoading(true)
        try {
            const { data } = await axios.post(`${serverUrl}/api/auth/google-auth`, {
                fullName: pendingGoogleUser.fullName,
                email: pendingGoogleUser.email,
                mobile: googleMobile,
                role
            }, { withCredentials: true })
            dispatch(setUserData(data))
        } catch (error) {
            console.error("Google auth error:", error)
            toast.error(getErrorMessage(error))
        } finally {
            setGoogleLoading(false)
        }
    }

    return (
        <div className='min-h-screen w-full flex items-center justify-center p-4' style={{ backgroundColor: bgColor }}>
            <div className={`bg-white rounded-xl shadow-lg w-full max-w-md p-8 border-[1px] `} style={{
                border: `1px solid ${borderColor}`
            }}>
                <h1 className={`text-3xl font-bold mb-2 `} style={{ color: primaryColor }}>Vingo</h1>
                <p className='text-gray-600 mb-8'> Create your account to get started with delicious food deliveries
                </p>

                <div className='mb-4'>
                    <label htmlFor="fullName" className='block text-gray-700 font-medium mb-1'>Full Name</label>
                    <input type="text" className='w-full border rounded-lg px-3 py-2 focus:outline-none ' placeholder='Enter your Full Name' style={{ border: `1px solid ${borderColor}` }} onChange={(e) => setFullName(e.target.value)} value={fullName} required />
                </div>

                <div className='mb-4'>
                    <label htmlFor="email" className='block text-gray-700 font-medium mb-1'>Email</label>
                    <input type="email" className='w-full border rounded-lg px-3 py-2 focus:outline-none ' placeholder='Enter your Email' style={{ border: `1px solid ${borderColor}` }} onChange={(e) => setEmail(e.target.value)} value={email} required />
                </div>

                <div className='mb-4'>
                    <label htmlFor="mobile" className='block text-gray-700 font-medium mb-1'>Mobile</label>
                    <input type="tel" className='w-full border rounded-lg px-3 py-2 focus:outline-none ' placeholder='Enter your Mobile Number' style={{ border: `1px solid ${borderColor}` }} onChange={(e) => setMobile(e.target.value)} value={mobile} required />
                </div>

                <div className='mb-4'>
                    <label htmlFor="password" className='block text-gray-700 font-medium mb-1'>Password</label>
                    <div className='relative'>
                        <input type={`${showPassword ? "text" : "password"}`} className='w-full border rounded-lg px-3 py-2 focus:outline-none pr-10' placeholder='Enter your password' style={{ border: `1px solid ${borderColor}` }} onChange={(e) => setPassword(e.target.value)} value={password} required />
                        <button className='absolute right-3 cursor-pointer top-[14px] text-gray-500' onClick={() => setShowPassword(prev => !prev)}>{!showPassword ? <FaRegEye /> : <FaRegEyeSlash />}</button>
                    </div>
                </div>

                <div className='mb-4'>
                    <label htmlFor="role" className='block text-gray-700 font-medium mb-1'>Role</label>
                    <div className='flex gap-2'>
                        {["user", "owner", "deliveryBoy"].map((r) => (
                            <button
                                key={r}
                                className='flex-1 border rounded-lg px-3 py-2 text-center font-medium transition-colors cursor-pointer'
                                onClick={() => setRole(r)}
                                style={
                                    role == r ?
                                        { backgroundColor: primaryColor, color: "white" }
                                        : { border: `1px solid ${primaryColor}`, color: primaryColor }
                                }>
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer`} onClick={handleSignUp} disabled={loading}>
                    {loading ? <ClipLoader size={20} color='white' /> : "Sign Up"}
                </button>

                <div className='relative flex items-center gap-3 my-4'>
                    <div className='flex-1 h-px bg-gray-200' />
                    <span className='text-xs text-gray-400'>OR</span>
                    <div className='flex-1 h-px bg-gray-200' />
                </div>

                {/* NEW: pendingGoogleUser is only set once Google itself has already
                    succeeded and the backend has confirmed a mobile number is the
                    one missing piece — this is a quick follow-up, not a form the
                    user has to fill in before Google even runs. */}
                {pendingGoogleUser ? (
                    <div className='border border-orange-100 bg-orange-50 rounded-lg p-4'>
                        <p className='text-sm text-gray-700 mb-3'>
                            Signed in as <span className='font-semibold'>{pendingGoogleUser.fullName}</span> ({pendingGoogleUser.email}). Just need your mobile number to finish.
                        </p>
                        <input
                            type="tel"
                            autoFocus
                            className='w-full border rounded-lg px-3 py-2 focus:outline-none mb-3'
                            style={{ border: `1px solid ${borderColor}` }}
                            placeholder='Enter your Mobile Number'
                            value={googleMobile}
                            onChange={(e) => setGoogleMobile(e.target.value)}
                        />
                        <div className='flex gap-2'>
                            <button
                                className='flex-1 font-semibold py-2 rounded-lg bg-[#ff4d2d] text-white hover:bg-[#e64323] transition disabled:opacity-60'
                                onClick={handleCompleteGoogleSignup}
                                disabled={googleLoading}
                            >
                                {googleLoading ? <ClipLoader size={18} color='white' /> : "Complete Sign Up"}
                            </button>
                            <button
                                className='px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-100 transition'
                                onClick={() => { setPendingGoogleUser(null); setGoogleMobile("") }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button className='w-full flex items-center justify-center gap-2 border rounded-lg px-4 py-2 transition cursor-pointer duration-200 border-gray-400 hover:bg-gray-100 disabled:opacity-60' onClick={handleGoogleAuth} disabled={googleLoading}>
                        {googleLoading ? <ClipLoader size={18} color='#ff4d2d' /> : <><FcGoogle size={20} /><span>Sign up with Google</span></>}
                    </button>
                )}
                <p className='text-center mt-6 cursor-pointer' onClick={() => navigate("/signin")}>Already have an account ?  <span className='text-[#ff4d2d]'>Sign In</span></p>
            </div>
        </div>
    )
}

export default SignUp