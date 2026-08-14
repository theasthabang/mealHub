import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { IoClose } from "react-icons/io5"
import { FaMobileScreenButton } from "react-icons/fa6"
import { ClipLoader } from 'react-spinners'
import { serverUrl } from '../App'
import { getErrorMessage } from '../utils/getErrorMessage'

const MOBILE_REGEX = /^[6-9]\d{9}$/

// NEW: VITE_SKIP_MOBILE_OTP is the frontend half of the temporary bypass — matches
// the backend's SKIP_MOBILE_OTP env var. This only controls which UI renders; the
// backend independently re-checks its own env var regardless of what this sends, so
// flipping this frontend flag alone can't bypass anything on its own.
const SKIP_OTP = import.meta.env.VITE_SKIP_MOBILE_OTP === "true"

function MobileVerificationModal({ defaultMobile, onVerified, onClose }) {
    const [step, setStep] = useState('mobile')
    const [mobile, setMobile] = useState(defaultMobile || "")
    const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""])
    const [sending, setSending] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [otpError, setOtpError] = useState("")
    const [resendTimer, setResendTimer] = useState(0)

    const otpRefs = useRef([])

    useEffect(() => {
        if (resendTimer <= 0) return
        const timer = setTimeout(() => setResendTimer(r => r - 1), 1000)
        return () => clearTimeout(timer)
    }, [resendTimer])

    const isMobileValid = MOBILE_REGEX.test(mobile)

    // NEW: bypass path — takes the mobile number straight to the backend's
    // set-mobile-no-otp endpoint, no OTP step at all. Only reachable when
    // SKIP_OTP is true, matching the simplified UI below.
    const handleContinueWithoutOtp = async () => {
        if (!isMobileValid) {
            return toast.error("Please enter a valid 10-digit mobile number")
        }
        setSending(true)
        try {
            const result = await axios.post(`${serverUrl}/api/auth/set-mobile-no-otp`, { mobileNumber: mobile }, { withCredentials: true })
            toast.success("Mobile number saved")
            onVerified(result.data.verifiedMobile)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSending(false)
        }
    }

    const handleSendOtp = async () => {
        if (!isMobileValid) {
            return toast.error("Please enter a valid 10-digit mobile number")
        }
        setSending(true)
        try {
            await axios.post(`${serverUrl}/api/auth/send-checkout-otp`, { mobileNumber: mobile }, { withCredentials: true })
            setStep('otp')
            setResendTimer(60)
            setOtpDigits(["", "", "", "", "", ""])
            setOtpError("")
            toast.success(`OTP sent to +91 ${mobile}`)
            setTimeout(() => otpRefs.current[0]?.focus(), 100)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSending(false)
        }
    }

    const handleOtpChange = (index, value) => {
        if (!/^\d?$/.test(value)) return
        const next = [...otpDigits]
        next[index] = value
        setOtpDigits(next)
        setOtpError("")
        if (value && index < 5) otpRefs.current[index + 1]?.focus()
    }

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    const handleVerifyOtp = async () => {
        const otp = otpDigits.join("")
        if (otp.length !== 6) {
            return setOtpError("Please enter the full 6-digit OTP")
        }
        setVerifying(true)
        setOtpError("")
        try {
            const result = await axios.post(`${serverUrl}/api/auth/verify-checkout-otp`, { mobileNumber: mobile, otp }, { withCredentials: true })
            toast.success("Mobile number verified")
            onVerified(result.data.verifiedMobile)
        } catch (error) {
            setOtpError(getErrorMessage(error))
        } finally {
            setVerifying(false)
        }
    }

    return (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4'>
            <div className='bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative'>
                <button onClick={onClose} className='absolute top-4 right-4 text-gray-400 hover:text-gray-600'>
                    <IoClose size={22} />
                </button>

                <div className='flex flex-col items-center text-center mb-5'>
                    <div className='bg-orange-100 p-3 rounded-full mb-3'>
                        <FaMobileScreenButton className='text-[#ff4d2d]' size={22} />
                    </div>
                    <h2 className='text-lg font-bold text-gray-900'>
                        {SKIP_OTP ? "Confirm your mobile number" : "Verify your mobile number"}
                    </h2>
                    <p className='text-sm text-gray-500 mt-1'>
                        {SKIP_OTP
                            ? "We need your mobile number to confirm your food delivery."
                            : step === 'mobile'
                                ? "We need your mobile number to confirm your food delivery."
                                : `OTP sent to +91 ${mobile}`}
                    </p>
                </div>

                {/* NEW: dev-only banner, so it's never ambiguous why this modal
                    doesn't ask for an OTP right now — this should be unmissable to
                    whoever's looking at the screen, not a silent behavior change */}
                {SKIP_OTP && (
                    <div className='bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs rounded-lg px-3 py-2 mb-4 text-center'>
                        ⚠️ Dev mode: OTP verification is temporarily skipped
                    </div>
                )}

                {SKIP_OTP ? (
                    <>
                        <div className='flex items-center border rounded-lg overflow-hidden mb-4'>
                            <span className='px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r'>+91</span>
                            <input
                                type="tel"
                                maxLength={10}
                                autoFocus
                                className='flex-1 px-3 py-2 outline-none'
                                placeholder='Enter mobile number'
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                            />
                        </div>
                        <button
                            className='w-full bg-[#ff4d2d] hover:bg-[#e64526] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60'
                            onClick={handleContinueWithoutOtp}
                            disabled={sending}
                        >
                            {sending ? <ClipLoader size={18} color='white' /> : "Continue"}
                        </button>
                    </>
                ) : step === 'mobile' ? (
                    <>
                        <div className='flex items-center border rounded-lg overflow-hidden mb-4'>
                            <span className='px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r'>+91</span>
                            <input
                                type="tel"
                                maxLength={10}
                                autoFocus
                                className='flex-1 px-3 py-2 outline-none'
                                placeholder='Enter mobile number'
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                            />
                        </div>
                        <button
                            className='w-full bg-[#ff4d2d] hover:bg-[#e64526] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60'
                            onClick={handleSendOtp}
                            disabled={sending}
                        >
                            {sending ? <ClipLoader size={18} color='white' /> : "Send OTP"}
                        </button>
                    </>
                ) : (
                    <>
                        <div className='flex justify-center gap-2 mb-4'>
                            {otpDigits.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => (otpRefs.current[i] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    className='w-10 h-12 text-center text-lg font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff4d2d]/40 focus:border-[#ff4d2d]'
                                    value={digit}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                />
                            ))}
                        </div>

                        {otpError && <p className='text-red-500 text-sm text-center mb-3'>{otpError}</p>}

                        <button
                            className='w-full bg-[#ff4d2d] hover:bg-[#e64526] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 mb-3'
                            onClick={handleVerifyOtp}
                            disabled={verifying}
                        >
                            {verifying ? <ClipLoader size={18} color='white' /> : "Verify OTP"}
                        </button>

                        <div className='text-center text-sm'>
                            {resendTimer > 0 ? (
                                <span className='text-gray-400'>
                                    Resend OTP in {String(Math.floor(resendTimer / 60)).padStart(2, '0')}:{String(resendTimer % 60).padStart(2, '0')}
                                </span>
                            ) : (
                                <button className='text-[#ff4d2d] font-medium hover:underline' onClick={handleSendOtp} disabled={sending}>
                                    {sending ? "Sending..." : "Resend OTP"}
                                </button>
                            )}
                        </div>

                        <button
                            className='w-full text-xs text-gray-400 hover:text-gray-600 mt-4'
                            onClick={() => { setStep('mobile'); setOtpDigits(["", "", "", "", "", ""]); setOtpError("") }}
                        >
                            Change mobile number
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default MobileVerificationModal