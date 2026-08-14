import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Fuse from 'fuse.js'
import toast from 'react-hot-toast'
import { IoIosSearch } from "react-icons/io"
import { RxCross2 } from "react-icons/rx"
import { FaPlus } from "react-icons/fa"
import { FaStore } from "react-icons/fa6"
import { addToCart } from '../redux/userSlice'

// NEW: premium search dropdown, built as a self-contained component so Nav.jsx
// doesn't have to carry all this state.
//
// Architecture note: this does NOT call the backend at all. shopInMyCity (already in
// Redux from the getShopByCity fetch that runs on app load) has each shop's name and
// its full populated item list nested inside it — everything this needs is already
// sitting in memory. Building the search index from that means zero new API calls
// and zero network latency on every keystroke, which is what makes this feel
// instant rather than "debounced but still waiting on a request."
function SearchDropdown({ variant = "desktop" }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { shopInMyCity } = useSelector(state => state.user)

    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)

    const containerRef = useRef(null)
    const inputRef = useRef(null)

    // 300ms debounce — resets on every keystroke via the cleanup function, same
    // pattern already used elsewhere in this app (Nav's old search, before this
    // component replaced it).
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 300)
        return () => clearTimeout(timer)
    }, [query])

    // Flatten shopInMyCity into one searchable corpus: every item (carrying its
    // parent shop's name/id along with it) plus every shop itself, so a restaurant
    // name match works just as well as a food name match. Rebuilt only when
    // shopInMyCity actually changes, not on every keystroke.
    const searchCorpus = useMemo(() => {
        if (!shopInMyCity) return []
        const corpus = []
        shopInMyCity.forEach(shop => {
            corpus.push({
                type: 'shop',
                id: shop._id,
                name: shop.name,
                shopName: shop.name,
                shopId: shop._id,
                image: shop.image,
                price: null
            })
            shop.items?.forEach(item => {
                corpus.push({
                    type: 'item',
                    id: item._id,
                    name: item.name,
                    shopName: shop.name,
                    shopId: shop._id,
                    image: item.image,
                    price: item.price,
                    foodType: item.foodType
                })
            })
        })
        return corpus
    }, [shopInMyCity])

    const fuse = useMemo(() => {
        return new Fuse(searchCorpus, {
            keys: [
                { name: 'name', weight: 0.7 },
                { name: 'shopName', weight: 0.3 }
            ],
            threshold: 0.35, // fuzzy tolerance — catches minor misspellings without matching too loosely
            includeMatches: true,
            minMatchCharLength: 2
        })
    }, [searchCorpus])

    const results = useMemo(() => {
        if (!debouncedQuery.trim()) return []
        return fuse.search(debouncedQuery).slice(0, 8)
    }, [fuse, debouncedQuery])

    const isDataStillLoading = !shopInMyCity && query.trim().length > 0
    const showEmptyState = debouncedQuery.trim() && !isDataStillLoading && results.length === 0

    // Click-outside-to-close — same pattern already established in Nav.jsx for the
    // account dropdown, kept consistent rather than reinventing it here.
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const goToResult = (result) => {
        navigate(`/shop/${result.shopId}`)
        setIsOpen(false)
        setQuery("")
        inputRef.current?.blur()
    }

    const handleQuickAdd = (e, item) => {
        e.stopPropagation() // don't also trigger the row's navigate-on-click
        dispatch(addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            shop: item.shopId,
            quantity: 1,
            foodType: item.foodType
        }))
        toast.success(`${item.name} added to cart`)
    }

    // Keyboard navigation: ArrowDown/ArrowUp move a highlighted index through
    // results (wrapping at both ends), Enter activates whichever is highlighted,
    // Escape closes the dropdown and blurs the input.
    const handleKeyDown = (e) => {
        if (!isOpen || results.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIndex(prev => (prev + 1) % results.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex(prev => (prev - 1 + results.length) % results.length)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (highlightedIndex >= 0) goToResult(results[highlightedIndex].item)
        } else if (e.key === 'Escape') {
            setIsOpen(false)
            inputRef.current?.blur()
        }
    }

    useEffect(() => {
        setHighlightedIndex(-1)
    }, [debouncedQuery])

    // Renders a name with the fuzzy-matched portion bolded/colored, using the index
    // ranges Fuse returns for the 'name' key specifically (not shopName matches).
    const renderHighlighted = (name, matches) => {
        const nameMatch = matches?.find(m => m.key === 'name')
        if (!nameMatch) return <>{name}</>
        const indices = nameMatch.indices
        let lastIndex = 0
        const parts = []
        indices.forEach(([start, end], i) => {
            if (start > lastIndex) parts.push(<span key={`t${i}`}>{name.slice(lastIndex, start)}</span>)
            parts.push(<span key={`h${i}`} className='font-bold text-[#ff4d2d]'>{name.slice(start, end + 1)}</span>)
            lastIndex = end + 1
        })
        if (lastIndex < name.length) parts.push(<span key="tail">{name.slice(lastIndex)}</span>)
        return <>{parts}</>
    }

    const isDesktop = variant === "desktop"

    return (
        <div ref={containerRef} className={`relative ${isDesktop ? "w-full" : "w-full"}`}>
            {/* Glass-styled search bar */}
            <div className={`flex items-center gap-[10px] px-4 h-[52px] rounded-full bg-white/60 backdrop-blur-md border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all focus-within:ring-2 focus-within:ring-[#ff4d2d]/40 focus-within:bg-white/80`}>
                <IoIosSearch size={22} className='text-[#ff4d2d] flex-shrink-0' />
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls="search-listbox"
                    aria-activedescendant={highlightedIndex >= 0 ? `search-option-${highlightedIndex}` : undefined}
                    aria-autocomplete="list"
                    placeholder='Search for food or restaurants...'
                    className='bg-transparent outline-none w-full text-gray-800 placeholder:text-gray-400'
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
                {query && (
                    <RxCross2
                        size={18}
                        className='text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0'
                        onClick={() => { setQuery(""); setDebouncedQuery(""); inputRef.current?.focus() }}
                    />
                )}
            </div>

            {/* Dropdown panel */}
            <AnimatePresence>
                {isOpen && query.trim() && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        id="search-listbox"
                        role="listbox"
                        className='absolute top-[60px] left-0 w-full max-h-[420px] overflow-y-auto bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl p-2 z-[10000]'
                    >
                        {isDataStillLoading ? (
                            // Skeleton loading rows — shown only in the brief window
                            // where the user is typing before city data has arrived
                            <div className='space-y-2'>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className='flex items-center gap-3 p-2 animate-pulse'>
                                        <div className='w-12 h-12 rounded-lg bg-gray-200 flex-shrink-0' />
                                        <div className='flex-1 space-y-2'>
                                            <div className='h-3 bg-gray-200 rounded w-3/4' />
                                            <div className='h-2 bg-gray-100 rounded w-1/2' />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : showEmptyState ? (
                            <div className='flex flex-col items-center justify-center py-10 text-center px-4'>
                                <IoIosSearch size={28} className='text-gray-300 mb-2' />
                                <p className='text-gray-500 text-sm font-medium'>No matching food or restaurant found.</p>
                            </div>
                        ) : (
                            <div className='flex flex-col'>
                                {results.map(({ item, matches }, index) => (
                                    <motion.div
                                        id={`search-option-${index}`}
                                        role="option"
                                        aria-selected={highlightedIndex === index}
                                        key={item.id}
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.12, delay: index * 0.02 }}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                        onClick={() => goToResult(item)}
                                        className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${highlightedIndex === index ? "bg-[#ff4d2d]/10" : "hover:bg-black/5"}`}
                                    >
                                        <img src={item.image} alt="" className='w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100' />
                                        <div className='flex-1 min-w-0'>
                                            <div className='text-sm font-medium text-gray-900 truncate flex items-center gap-1.5'>
                                                {item.type === 'shop' && <FaStore size={11} className='text-gray-400 flex-shrink-0' />}
                                                {renderHighlighted(item.name, matches)}
                                            </div>
                                            {item.type === 'item' && (
                                                <div className='text-xs text-gray-500 truncate'>{item.shopName}</div>
                                            )}
                                        </div>
                                        {item.type === 'item' ? (
                                            <div className='flex items-center gap-2 flex-shrink-0'>
                                                <span className='text-sm font-bold text-gray-800'>₹{item.price}</span>
                                                <button
                                                    onClick={(e) => handleQuickAdd(e, item)}
                                                    aria-label={`Add ${item.name} to cart`}
                                                    className='w-7 h-7 rounded-full bg-[#ff4d2d] text-white flex items-center justify-center hover:bg-[#e64526] transition-colors'
                                                >
                                                    <FaPlus size={11} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className='text-xs text-gray-400 flex-shrink-0'>Restaurant</span>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default SearchDropdown