import React, { useEffect, useRef, useState } from 'react'
import Nav from './Nav'
import { categories } from '../category'
import CategoryCard from './CategoryCard'
import RestaurantCard from './RestaurantCard'
import Footer from './Footer'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useSelector } from 'react-redux';
import FoodCard from './FoodCard';
import { useNavigate } from 'react-router-dom';

// REDESIGN: rebuilt around the SaaS/premium-food-delivery direction --
// compact Hero, categories as a permanent horizontal carousel (intentional,
// not a mobile fallback), restaurants as a real 4-column grid (no more
// horizontal-scroll-only pattern there, since a browsable grid fits a
// listing of restaurants better than a carousel), Footer at the bottom.
// All existing data (shopInMyCity, itemsInMyCity, searchItems, loading
// states) and filtering logic (handleFilterByCategory) is unchanged --
// only the visual layer and the restaurant section's layout changed.
function UserDashboard() {
  const { currentCity, shopInMyCity, shopInMyCityLoading, itemsInMyCity, itemsInMyCityLoading, searchItems } = useSelector(state => state.user)
  const cateScrollRef = useRef()
  const navigate = useNavigate()
  const [showLeftCateButton, setShowLeftCateButton] = useState(false)
  const [showRightCateButton, setShowRightCateButton] = useState(false)
  const [updatedItemsList, setUpdatedItemsList] = useState([])
  const [activeCategory, setActiveCategory] = useState("")

  const handleFilterByCategory = (category) => {
    if (activeCategory === category) {
      setActiveCategory("")
      setUpdatedItemsList(itemsInMyCity)
      return
    }
    setActiveCategory(category)
    const filteredList = itemsInMyCity?.filter(i => i.category === category)
    setUpdatedItemsList(filteredList)
  }

  useEffect(() => {
    setUpdatedItemsList(itemsInMyCity)
  }, [itemsInMyCity])

  const updateButton = (ref, setLeftButton, setRightButton) => {
    const element = ref.current
    if (element) {
      setLeftButton(element.scrollLeft > 0)
      setRightButton(element.scrollLeft + element.clientWidth < element.scrollWidth)
    }
  }
  const scrollHandler = (ref, direction) => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction == "left" ? -200 : 200,
        behavior: "smooth"
      })
    }
  }

  useEffect(() => {
    if (cateScrollRef.current) {
      updateButton(cateScrollRef, setShowLeftCateButton, setShowRightCateButton)
      cateScrollRef.current.addEventListener('scroll', () => {
        updateButton(cateScrollRef, setShowLeftCateButton, setShowRightCateButton)
      })
    }
    return () => {
      cateScrollRef?.current?.removeEventListener("scroll", () => {
        updateButton(cateScrollRef, setShowLeftCateButton, setShowRightCateButton)
      })
    }
  }, [categories])

  const LoadingRow = ({ label }) => (
    <div className='w-full flex flex-col items-center justify-center py-10'>
      <div className='w-6 h-6 border-[3px] border-[#FF4B2B] border-t-transparent rounded-full animate-spin mb-3' />
      <p className='text-zinc-400 text-sm'>{label}</p>
    </div>
  )

  return (
    <div className='w-full min-h-screen bg-[#FAFAF9] pt-[8px]'>
      <Nav />

      <div className='max-w-[1200px] mx-auto px-2'>

        {/* NEW: compact Hero. Text side is purely presentational (no data
            dependency). Image side deliberately uses a REAL photo from your
            own itemsInMyCity data -- an actual dish already uploaded through
            your app -- rather than a stock photo, which would need real
            licensing rights this project doesn't have. Falls back to a quiet
            gradient pattern if items haven't loaded yet, instead of a broken
            image tag. */}
        <section className=' rounded-2xl bg-gradient-to-br from-[#FFF1EC] to-[#fed6ba] p-5 md:p-10 flex flex-col md:flex-row items-center gap-8 overflow-hidden'>
          <div className='flex-1'>
            <span className='inline-block text-xs font-medium text-[#FF4B2B] bg-white px-3 py-1 rounded-full mb-3'>Good food</span>
            <h1 className='text-3xl md:text-4xl font-bold text-zinc-900 leading-tight'>
              Good food, <span className='text-[#FF4B2B]'>delivered simply.</span>
            </h1>
            <p className='text-zinc-500 mt-2 text-sm md:text-base'>Discover your next favourite meal from restaurants near {currentCity}.</p>
            <div className='mt-5 flex items-center gap-2 bg-white rounded-full px-4 py-3 max-w-md shadow-sm border border-zinc-100'>
              <Search size={18} className='text-zinc-400 shrink-0' />
              <span className='text-sm text-zinc-400'>Search for food or restaurants...</span>
            </div>
          </div>

          <div className='w-full md:w-[320px] shrink-0'>
            {itemsInMyCity && itemsInMyCity.length > 0 ? (
              <div className='rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(255,75,43,0.15)] aspect-square'>
                <img
                  src={itemsInMyCity[0].image}
                  alt={itemsInMyCity[0].name}
                  className='w-full h-full object-cover'
                />
              </div>
            ) : (
              <div className='rounded-2xl aspect-square bg-gradient-to-br from-[#FF4B2B]/10 to-[#FF4B2B]/5 flex items-center justify-center'>
                <span className='text-4xl'>&#127860;</span>
              </div>
            )}
          </div>
        </section>

        {searchItems && searchItems.length > 0 && (
          <section className='mt-10'>
            <h2 className='text-lg font-semibold text-zinc-900 mb-4'>Search Results</h2>
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4'>
              {searchItems.map((item) => (
                <FoodCard data={item} key={item._id} />
              ))}
            </div>
          </section>
        )}

        <section className='mt-10'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-semibold text-zinc-900'>What are you craving?</h2>
          </div>
          <div className='relative'>
            {showLeftCateButton && (
              <button className='absolute -left-3 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-1.5 z-10 hover:bg-zinc-50' onClick={() => scrollHandler(cateScrollRef, "left")}>
                <ChevronLeft size={18} className='text-zinc-700' />
              </button>
            )}
            <div className='flex overflow-x-auto justify-between pb-2' ref={cateScrollRef} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categories.map((cate, index) => (
                <CategoryCard name={cate.category} image={cate.image} key={index} onClick={() => handleFilterByCategory(cate.category)} active={activeCategory === cate.category} />
              ))}
            </div>
            {showRightCateButton && (
              <button className='absolute -right-3 top-1/2 -translate-y-1/2 bg-white shadow-md rounded-full p-1.5 z-10 hover:bg-zinc-50' onClick={() => scrollHandler(cateScrollRef, "right")}>
                <ChevronRight size={18} className='text-zinc-700' />
              </button>
            )}
          </div>
        </section>

        <section className='mt-12'>
          <h2 className='text-lg font-semibold text-zinc-900 mb-4'>Popular restaurants in {currentCity}</h2>
          {shopInMyCityLoading ? (
            <LoadingRow label="Loading restaurants near you..." />
          ) : (
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5'>
              {shopInMyCity?.map((shop, index) => (
                <RestaurantCard name={shop.name} image={shop.image} city={shop.city} key={index} onClick={() => navigate(`/shop/${shop._id}`)} />
              ))}
            </div>
          )}
        </section>

        <section className='mt-12 pb-6'>
          <h2 className='text-lg font-semibold text-zinc-900 mb-4'>Suggested for you</h2>
          {itemsInMyCityLoading ? (
            <LoadingRow label="Loading food items..." />
          ) : (
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5'>
              {updatedItemsList?.map((item, index) => (
                <FoodCard key={index} data={item} />
              ))}
            </div>
          )}
        </section>

      </div>

      <Footer />
    </div>
  )
}

export default UserDashboard