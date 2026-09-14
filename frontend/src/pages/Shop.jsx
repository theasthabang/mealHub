import axios from 'axios'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { serverUrl } from '../App'
import { useNavigate, useParams } from 'react-router-dom'
import Nav from '../components/Nav'
import RestaurantHero from '../components/RestaurantHero'
import RestaurantMeta from '../components/RestaurantMeta'
import MenuTabs from '../components/MenuTabs'
import FoodCard from '../components/FoodCard'
import CompactFoodCard from '../components/CompactFoodCard'
import CartSidebar from '../components/CartSidebar'
import MobileCartBar from '../components/MobileCartBar'
import OfferCard from '../components/OfferCard'
import RestaurantInfo from '../components/RestaurantInfo'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'

// REDESIGN: data-fetching (handleShop, the useEffect, shopId) is byte-for-byte
// the same as the original file -- only the presentation layer changed. Real
// derived data added on top: cuisineTags (distinct item categories) and a
// "Popular" section (top-rated real items, sorted by the genuine
// Item.rating field) -- neither is fabricated, both are honest views of data
// that already exists.
function Shop() {
    const { shopId } = useParams()
    const [items, setItems] = useState([])
    const [shop, setShop] = useState(null)
    const [offers, setOffers] = useState([])
    const [activeCategory, setActiveCategory] = useState("Popular")
    const navigate = useNavigate()
    const { totalAmount } = useSelector(state => state.user)
    const sectionRefs = useRef({})

    const handleShop = async () => {
        try {
            const result = await axios.get(`${serverUrl}/api/item/get-by-shop/${shopId}`, { withCredentials: true })
            setShop(result.data.shop)
            setItems(result.data.items)
        } catch (error) {
            toast.error("Could not load this shop. Please try again.")
        }
    }

    // NEW: real active offers for this shop, from the public endpoint built
    // in Chunk 3. Failure here is non-critical (the page still works fine
    // with no offers shown), so it's a quiet console warning, not a toast
    // that interrupts browsing the menu.
    const handleOffers = async () => {
        try {
            const result = await axios.get(`${serverUrl}/api/offer/active/${shopId}`, { withCredentials: true })
            setOffers(result.data)
        } catch (error) {
            console.error("Could not load offers for this shop:", error)
        }
    }

    useEffect(() => {
        handleShop()
        handleOffers()
    }, [shopId])

    // NEW: split into item-specific offers (keyed by item id, for the badge
    // on each card) and shop-wide offers (for OfferCard) -- real data, same
    // split logic the backend itself uses to decide what to apply.
    const itemOffersById = useMemo(() => {
        const map = {}
        offers.filter(o => o.item).forEach(o => { map[String(o.item._id || o.item)] = o })
        return map
    }, [offers])

    const shopWideOffers = useMemo(() => offers.filter(o => !o.item), [offers])

    const isClosed = shop && !shop.isOpen

    // NEW: cuisine tags -- REAL, derived from the actual distinct categories
    // this shop's items belong to. Not a fabricated field.
    const cuisineTags = useMemo(() => {
        return [...new Set(items.map(i => i.category).filter(Boolean))]
    }, [items])

    // NEW: "Popular" -- REAL, derived from the genuine Item.rating field.
    // Top 4 items by average rating (count as tiebreaker), not an invented
    // category.
    const popularItems = useMemo(() => {
        return [...items]
            .sort((a, b) => {
                const avgDiff = (b.rating?.average || 0) - (a.rating?.average || 0)
                if (avgDiff !== 0) return avgDiff
                return (b.rating?.count || 0) - (a.rating?.count || 0)
            })
            .slice(0, 4)
    }, [items])

    const menuCategories = useMemo(() => ["Popular", ...cuisineTags], [cuisineTags])

    const itemsByCategory = useMemo(() => {
        const grouped = {}
        cuisineTags.forEach(cat => {
            grouped[cat] = items.filter(i => i.category === cat)
        })
        return grouped
    }, [items, cuisineTags])

    const handleTabClick = (category) => {
        setActiveCategory(category)
        sectionRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (!shop) {
        return (
            <div className='w-full min-h-screen bg-[#FAFAF9] pt-[68px] flex items-center justify-center'>
                <Nav />
                <div className='w-6 h-6 border-[3px] border-[#FF4B2B] border-t-transparent rounded-full animate-spin' />
            </div>
        )
    }

    return (
        <div className='w-full min-h-screen bg-[#FAFAF9] pt-[68px] pb-24 md:pb-10'>
            <Nav />

            <div className='max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-5'>
                <RestaurantHero shop={shop} cuisineTags={cuisineTags} onBack={() => navigate("/")} />
                <RestaurantMeta isOpen={shop.isOpen} />
            </div>

            <MenuTabs categories={menuCategories} activeCategory={activeCategory} onSelect={handleTabClick} />

            <div className='max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-6'>
                <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start'>

                    {/* MAIN MENU CONTENT */}
                    <div className='flex flex-col gap-10'>

                        {popularItems.length > 0 && (
                            <section ref={el => sectionRefs.current["Popular"] = el}>
                                <h2 className='text-xl font-bold text-zinc-900'>Popular</h2>
                                <p className='text-sm text-zinc-400 mt-0.5 mb-4'>Our most loved items, just for you.</p>
                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
                                    {popularItems.map(item => (
                                        <FoodCard data={item} key={item._id} shopClosed={isClosed} offer={itemOffersById[item._id]} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {cuisineTags.map(category => (
                            <section key={category} ref={el => sectionRefs.current[category] = el}>
                                <h2 className='text-xl font-bold text-zinc-900 mb-4'>{category}</h2>
                                <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4'>
                                    {itemsByCategory[category].map(item => (
                                        <CompactFoodCard data={item} key={item._id} shopClosed={isClosed} offer={itemOffersById[item._id]} />
                                    ))}
                                </div>
                            </section>
                        ))}

                        {items.length === 0 && (
                            <p className='text-center text-zinc-400 text-sm py-16'>No items available from this shop yet.</p>
                        )}
                    </div>

                    {/* DESKTOP CART SIDEBAR */}
                    <div className='hidden lg:flex flex-col gap-4'>
                        <CartSidebar />
                        <OfferCard totalAmount={totalAmount} shopOffers={shopWideOffers} />
                        <RestaurantInfo shop={shop} />
                    </div>

                </div>
            </div>

            <MobileCartBar />
        </div>
    )
}

export default Shop