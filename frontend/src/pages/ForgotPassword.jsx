import axios from 'axios';
import React, { useState } from 'react'
import { IoIosArrowRoundBack } from "react-icons/io";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'
import { serverUrl } from '../App';
import { ClipLoader } from 'react-spinners';
import { getErrorMessage } from '../utils/getErrorMessage';

function ForgotPassword() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // FIX (toast notifications): replaced inline `err` state + <p> block with toasts,
  // and added success toasts so each step's completion is confirmed
  const handleSendOtp = async () => {
    setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/auth/send-otp`, { email }, { withCredentials: true })
      toast.success("OTP sent to your email")
      setStep(2)
      setLoading(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
      setLoading(false)
    }
  }
  const handleVerifyOtp = async () => {
    setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/auth/verify-otp`, { email, otp }, { withCredentials: true })
      toast.success("OTP verified")
      setStep(3)
      setLoading(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
      setLoading(false)
    }
  }
  const handleResetPassword = async () => {
    if (newPassword != confirmPassword) {
      return toast.error("Passwords do not match")
    }
    setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/auth/reset-password`, { email, newPassword }, { withCredentials: true })
      toast.success("Password reset successfully")
      setLoading(false)
      navigate("/signin")
    } catch (error) {
      toast.error(getErrorMessage(error))
      setLoading(false)
    }
  }

  return (
    <div className='flex w-full items-center justify-center min-h-screen p-4 bg-[#fff9f6]'>
      <div className='bg-white rounded-xl shadow-lg w-full max-w-md p-8'>
        <div className='flex items-center  gap-4 mb-4'>
          <IoIosArrowRoundBack size={30} className='text-[#ff4d2d] cursor-pointer' onClick={() => navigate("/signin")} />
          <h1 className='text-2xl font-bold text-center text-[#ff4d2d]'>Forgot Password</h1>
        </div>
        {step == 1
          &&
          <div>
            <div className='mb-6'>
              <label htmlFor="email" className='block text-gray-700 font-medium mb-1'>Email</label>
              <input type="email" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Enter your Email' onChange={(e) => setEmail(e.target.value)} value={email} required />
            </div>
            <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer`} onClick={handleSendOtp} disabled={loading}>
              {loading ? <ClipLoader size={20} color='white' /> : "Send Otp"}
            </button>
          </div>}

        {step == 2
          &&
          <div>
            <div className='mb-6'>
              <label htmlFor="otp" className='block text-gray-700 font-medium mb-1'>OTP</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Enter OTP' onChange={(e) => setOtp(e.target.value)} value={otp} required />
            </div>
            <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer`} onClick={handleVerifyOtp} disabled={loading}>
              {loading ? <ClipLoader size={20} color='white' /> : "Verify"}
            </button>
          </div>}
        {step == 3
          &&
          <div>
            <div className='mb-6'>
              <label htmlFor="newPassword" className='block text-gray-700 font-medium mb-1'>New Password</label>
              <input type="password" autoComplete="new-password" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Enter New Password' onChange={(e) => setNewPassword(e.target.value)} value={newPassword} />
            </div>
            <div className='mb-6'>
              <label htmlFor="confirmPassword" className='block text-gray-700 font-medium mb-1'>Confirm Password</label>
              <input type="password" autoComplete="new-password" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Confirm Password' onChange={(e) => setConfirmPassword(e.target.value)} value={confirmPassword} required />
            </div>
            <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer`} onClick={handleResetPassword} disabled={loading}>
              {loading ? <ClipLoader size={20} color='white' /> : "Reset Password"}
            </button>
          </div>}
      </div>
    </div>
  )
}

export default ForgotPassword