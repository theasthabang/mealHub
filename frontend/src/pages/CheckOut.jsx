import React, { useEffect, useState } from 'react'
import { ArrowLeft, MapPin, Search, LocateFixed, Truck, Smartphone, CreditCard } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { useDispatch, useSelector } from 'react-redux';
import "leaflet/dist/leaflet.css"
import { setAddress, setLocation } from '../redux/mapSlice';
import axios from 'axios';
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom';
import { serverUrl } from '../App';
import { addMyOrder, clearCart, setTotalAmount, setUserData } from '../redux/userSlice';
import { getErrorMessage } from '../utils/getErrorMessage';
import MobileVerificationModal from '../components/MobileVerificationModal';

// FIX (Hooks violation, unchanged from before): useMap() must be called
// unconditionally on every render.
function RecenterMap({ location }) {
  const map = useMap()
  useEffect(() => {
    if (location.lat && location.lon) {
      map.setView([location.lat, location.lon], 16, { animate: true })
    }
  }, [location.lat, location.lon])
  return null
}

// REDESIGN: switched to a two-column SaaS-style checkout layout -- form
// content (location, payment method) on the left, order summary sticky on
// the right. Every function below (getCurrentLocation, getAddressByLatLng,
// getLatLngByAddress, handlePlaceOrder, openRazorpayWindow, the mobile
// verification flow) is byte-for-byte the same logic as before -- only the
// JSX layout and visual styling changed.
function CheckOut() {
  const { location, address } = useSelector(state => state.map)
  const { cartItems, totalAmount, userData } = useSelector(state => state.user)
  const [addressInput, setAddressInput] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cod")
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const apiKey = import.meta.env.VITE_GEOAPIKEY
  const deliveryFee = totalAmount > 500 ? 0 : 40
  const AmountWithDeliveryFee = totalAmount + deliveryFee

  const [showVerificationModal, setShowVerificationModal] = useState(!userData?.isMobileVerified)

  const handleVerified = (verifiedMobile) => {
    dispatch(setUserData({ ...userData, isMobileVerified: true, verifiedMobile }))
    setShowVerificationModal(false)
  }

  const onDragEnd = (e) => {
    const { lat, lng } = e.target._latlng
    dispatch(setLocation({ lat, lon: lng }))
    getAddressByLatLng(lat, lng)
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      return toast.error("Geolocation is not supported by your browser")
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        dispatch(setLocation({ lat: latitude, lon: longitude }))
        getAddressByLatLng(latitude, longitude)
      },
      () => {
        toast.error("Could not get your current location. Please check location permissions.")
      },
      { enableHighAccuracy: true }
    )
  }

  const getAddressByLatLng = async (lat, lng) => {
    try {
      const result = await axios.get(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=json&apiKey=${apiKey}`)
      dispatch(setAddress(result?.data?.results[0].address_line2))
    } catch (error) {
      toast.error("Could not fetch address for this location" , error)
    }
  }

  const getLatLngByAddress = async () => {
    try {
      const result = await axios.get(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressInput)}&apiKey=${apiKey}`)
      const { lat, lon } = result.data.features[0].properties
      dispatch(setLocation({ lat, lon }))
    } catch (error) {
      toast.error("Could not find that address. Try a different search." , error)
    }
  }

  const handlePlaceOrder = async () => {
    if (!userData?.isMobileVerified) {
      setShowVerificationModal(true)
      return
    }
    try {
      const result = await axios.post(`${serverUrl}/api/order/place-order`, {
        paymentMethod,
        deliveryAddress: {
          text: addressInput,
          latitude: location.lat,
          longitude: location.lon
        },
        totalAmount: AmountWithDeliveryFee,
        deliveryFee,
        cartItems
      }, { withCredentials: true })

      if (paymentMethod == "cod") {
        dispatch(addMyOrder(result.data))
        dispatch(clearCart())
        toast.success("Order placed successfully!")
        navigate("/order-placed")
      } else {
        const orderId = result.data.orderId
        const razorOrder = result.data.razorOrder
        openRazorpayWindow(orderId, razorOrder)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const openRazorpayWindow = (orderId, razorOrder) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: razorOrder.amount,
      currency: 'INR',
      name: "MealHub",
      description: "Food Delivery Website",
      order_id: razorOrder.id,
      handler: async function (response) {
        try {
          const result = await axios.post(`${serverUrl}/api/order/verify-payment`, {
            razorpay_payment_id: response.razorpay_payment_id,
            orderId
          }, { withCredentials: true })
          dispatch(addMyOrder(result.data))
          dispatch(clearCart())
          toast.success("Payment successful! Order placed.")
          navigate("/order-placed")
        } catch (error) {
          toast.error(getErrorMessage(error))
        }
      }
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  useEffect(() => {
    setAddressInput(address)
  }, [address])

  return (
    <div className='min-h-screen bg-[#FAFAF9] pb-10'>
      <div className='max-w-[1200px] mx-auto px-5 pt-6'>
        <button className='flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 transition-colors mb-6' onClick={() => navigate("/")}>
          <ArrowLeft size={18} />
          <span className='text-sm font-medium'>Back</span>
        </button>

        <h1 className='text-2xl font-bold text-zinc-900 mb-6'>Checkout</h1>

        <div className='grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start'>

          {/* LEFT COLUMN */}
          <div className='flex flex-col gap-6'>
            <section className='bg-white rounded-2xl border border-zinc-100 p-5'>
              <h2 className='text-sm font-semibold mb-3 flex items-center gap-2 text-zinc-900'>
                <MapPin size={16} className='text-[#FF4B2B]' /> Delivery Location
              </h2>
              <div className='flex gap-2 mb-3'>
                <input type="text" className='flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF4B2B]/30 focus:border-[#FF4B2B]' placeholder='Enter your delivery address' value={addressInput} onChange={(e) => setAddressInput(e.target.value)} />
                <button className='bg-[#FF4B2B] hover:bg-[#e8401f] text-white px-3 rounded-xl flex items-center justify-center transition-colors' onClick={getLatLngByAddress}><Search size={16} /></button>
                <button className='bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 rounded-xl flex items-center justify-center transition-colors' onClick={getCurrentLocation}><LocateFixed size={16} /></button>
              </div>
              <div className='rounded-xl overflow-hidden border border-zinc-100'>
                <div className='h-56 w-full flex items-center justify-center'>
                  <MapContainer
                    className={"w-full h-full"}
                    center={[location?.lat, location?.lon]}
                    zoom={16}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <RecenterMap location={location} />
                    <Marker position={[location?.lat, location?.lon]} draggable eventHandlers={{ dragend: onDragEnd }} />
                  </MapContainer>
                </div>
              </div>
            </section>

            <section className='bg-white rounded-2xl border border-zinc-100 p-5'>
              <h2 className='text-sm font-semibold mb-3 text-zinc-900'>Payment Method</h2>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <button className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${paymentMethod === "cod" ? "border-[#FF4B2B] bg-[#FFF1EC]" : "border-zinc-200 hover:border-zinc-300"}`} onClick={() => setPaymentMethod("cod")}>
                  <span className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50'>
                    <Truck size={16} className='text-emerald-600' />
                  </span>
                  <div>
                    <p className='text-sm font-medium text-zinc-900'>Cash On Delivery</p>
                    <p className='text-xs text-zinc-500'>Pay when your food arrives</p>
                  </div>
                </button>
                <button className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${paymentMethod === "online" ? "border-[#FF4B2B] bg-[#FFF1EC]" : "border-zinc-200 hover:border-zinc-300"}`} onClick={() => setPaymentMethod("online")}>
                  <span className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50'>
                    <CreditCard size={16} className='text-indigo-600' />
                  </span>
                  <div>
                    <p className='text-sm font-medium text-zinc-900'>UPI / Card</p>
                    <p className='text-xs text-zinc-500'>Pay securely online</p>
                  </div>
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN -- sticky order summary */}
          <div className='lg:sticky lg:top-6'>
            <section className='bg-white rounded-2xl border border-zinc-100 p-5'>
              <h2 className='text-sm font-semibold mb-3 text-zinc-900'>Order Summary</h2>
              <div className='flex flex-col gap-2 pb-3 mb-3 border-b border-zinc-100'>
                {cartItems.map((item, index) => (
                  <div key={index} className='flex justify-between text-sm text-zinc-600'>
                    <span>{item.name} &times; {item.quantity}</span>
                    <span>&#8377;{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className='flex justify-between text-sm text-zinc-600 mb-1.5'>
                <span>Subtotal</span>
                <span>&#8377;{totalAmount}</span>
              </div>
              <div className='flex justify-between text-sm text-zinc-600 mb-3'>
                <span>Delivery Fee</span>
                <span>{deliveryFee == 0 ? "Free" : `\u20B9${deliveryFee}`}</span>
              </div>
              <div className='flex justify-between text-base font-bold text-zinc-900 pt-3 border-t border-zinc-100 mb-4'>
                <span>Total</span>
                <span>&#8377;{AmountWithDeliveryFee}</span>
              </div>
              <button className='w-full bg-[#FF4B2B] hover:bg-[#e8401f] text-white py-3 rounded-xl font-semibold transition-colors' onClick={handlePlaceOrder}>
                {paymentMethod == "cod" ? "Place Order" : "Pay & Place Order"}
              </button>
            </section>
          </div>

        </div>
      </div>

      {showVerificationModal && (
        <MobileVerificationModal
          defaultMobile={userData?.mobile}
          onVerified={handleVerified}
          onClose={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  )
}

export default CheckOut