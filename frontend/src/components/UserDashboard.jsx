import React, { useEffect, useRef, useState } from "react";
import Nav from "./Nav";
import { categories } from "../category";
import CategoryCard from "./CategoryCard";
import { FaCircleChevronLeft } from "react-icons/fa6";
import { FaCircleChevronRight } from "react-icons/fa6";
import { useSelector } from "react-redux";
import FoodCard from "./FoodCard";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { serverUrl } from "../App";

function UserDashboard() {
  const {
    currentCity,
    shopInMyCity,
    shopInMyCityLoading,
    itemsInMyCity,
    itemsInMyCityLoading,
    searchItems,
  } = useSelector((state) => state.user);
  const cateScrollRef = useRef();
  const shopScrollRef = useRef();
  const navigate = useNavigate();
  const [showLeftCateButton, setShowLeftCateButton] = useState(false);
  const [showRightCateButton, setShowRightCateButton] = useState(false);
  const [showLeftShopButton, setShowLeftShopButton] = useState(false);
  const [showRightShopButton, setShowRightShopButton] = useState(false);
  const [updatedItemsList, setUpdatedItemsList] = useState([]);

  const handleFilterByCategory = (category) => {
    if (category == "All") {
      setUpdatedItemsList(itemsInMyCity);
    } else {
      const filteredList = itemsInMyCity?.filter(
        (i) => i.category === category,
      );
      setUpdatedItemsList(filteredList);
    }
  };

  useEffect(() => {
    setUpdatedItemsList(itemsInMyCity);
  }, [itemsInMyCity]);

  const updateButton = (ref, setLeftButton, setRightButton) => {
    const element = ref.current;
    if (element) {
      setLeftButton(element.scrollLeft > 0);
      setRightButton(
        element.scrollLeft + element.clientWidth < element.scrollWidth,
      );
    }
  };
  const scrollHandler = (ref, direction) => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direction == "left" ? -200 : 200,
        behavior: "smooth",
      });
    }
  };

  // FIX (crash — regression from the loading-spinner fix): this effect runs once
  // on mount, but the "Best Shop" section now conditionally renders a loading
  // spinner INSTEAD of the actual scrollable row while shopInMyCityLoading is
  // true (see below) — shopInMyCityLoading starts true, so on first mount
  // shopScrollRef has nothing to attach to yet, and shopScrollRef.current is
  // null. The old code only checked cateScrollRef.current before touching BOTH
  // refs, so it crashed trying to call .addEventListener on null the moment
  // this effect ran before the shop data had loaded. Each ref is now guarded
  // independently, and shopInMyCityLoading is added to the dependency array so
  // this effect re-runs (and successfully attaches the listener) the moment the
  // real scroll container actually mounts.
  useEffect(() => {
    if (cateScrollRef.current) {
      updateButton(
        cateScrollRef,
        setShowLeftCateButton,
        setShowRightCateButton,
      );
      cateScrollRef.current.addEventListener("scroll", () => {
        updateButton(
          cateScrollRef,
          setShowLeftCateButton,
          setShowRightCateButton,
        );
      });
    }

    if (shopScrollRef.current) {
      updateButton(
        shopScrollRef,
        setShowLeftShopButton,
        setShowRightShopButton,
      );
      shopScrollRef.current.addEventListener("scroll", () => {
        updateButton(
          shopScrollRef,
          setShowLeftShopButton,
          setShowRightShopButton,
        );
      });
    }

    return () => {
      cateScrollRef?.current?.removeEventListener("scroll", () => {
        updateButton(
          cateScrollRef,
          setShowLeftCateButton,
          setShowRightCateButton,
        );
      });
      shopScrollRef?.current?.removeEventListener("scroll", () => {
        updateButton(
          shopScrollRef,
          setShowLeftShopButton,
          setShowRightShopButton,
        );
      });
    };
  }, [categories, shopInMyCityLoading]);

  return (
    <div className="w-screen min-h-screen flex flex-col gap-5 items-center bg-[#fff9f6] overflow-y-auto">
      <Nav />

      {searchItems && searchItems.length > 0 && (
        <div className="w-full max-w-6xl flex flex-col gap-5 items-start p-5 bg-white shadow-md rounded-2xl mt-4">
          <h1 className="text-gray-900 text-2xl sm:text-3xl font-semibold border-b border-gray-200 pb-2">
            Search Results
          </h1>
          <div className="w-full h-auto flex flex-wrap gap-6 justify-center">
            {searchItems.map((item) => (
              <FoodCard data={item} key={item._id} />
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl flex flex-col gap-5 items-start p-[10px]">
        <h1 className="text-gray-800 text-2xl sm:text-3xl">
          Inspiration for your first order
        </h1>
        <div className="w-full relative">
          {showLeftCateButton && (
            <button
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10"
              onClick={() => scrollHandler(cateScrollRef, "left")}
            >
              <FaCircleChevronLeft />
            </button>
          )}

          <div
            className="w-full flex overflow-x-auto gap-4 pb-2 "
            ref={cateScrollRef}
          >
            {categories.map((cate, index) => (
              <CategoryCard
                name={cate.category}
                image={cate.image}
                key={index}
                onClick={() => handleFilterByCategory(cate.category)}
              />
            ))}
          </div>
          {showRightCateButton && (
            <button
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10"
              onClick={() => scrollHandler(cateScrollRef, "right")}
            >
              <FaCircleChevronRight />
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-6xl flex flex-col gap-5 items-start p-[10px]">
        <h1 className="text-gray-800 text-2xl sm:text-3xl">
          Best Shop in {currentCity}
        </h1>
        {/* FIX (loading-state fix): previously there was no loading flag at all here,
     so an empty shopInMyCity briefly rendered as an empty row indistinguishable
     from "genuinely no shops in this city" — this now shows an honest loading
     spinner while the fetch is actually still in progress, same visual pattern
     already used elsewhere in the app (MyOrders.jsx, TrackOrderPage.jsx). */}
        {shopInMyCityLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#ff4d2d] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Loading shops near you...</p>
          </div>
        ) : (
          <div className="w-full relative">
            {showLeftShopButton && (
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10"
                onClick={() => scrollHandler(shopScrollRef, "left")}
              >
                <FaCircleChevronLeft />
              </button>
            )}

            <div
              className="w-full flex overflow-x-auto gap-4 pb-2 "
              ref={shopScrollRef}
            >
              {shopInMyCity?.map((shop, index) => (
                <CategoryCard
                  name={shop.name}
                  image={shop.image}
                  key={index}
                  onClick={() => navigate(`/shop/${shop._id}`)}
                />
              ))}
            </div>
            {showRightShopButton && (
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#ff4d2d] text-white p-2 rounded-full shadow-lg hover:bg-[#e64528] z-10"
                onClick={() => scrollHandler(shopScrollRef, "right")}
              >
                <FaCircleChevronRight />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-6xl flex flex-col gap-5 items-start p-[10px]">
        <h1 className="text-gray-800 text-2xl sm:text-3xl">
          Suggested Food Items
        </h1>

        {/* FIX (loading-state fix): same reasoning as the shop section above, applied
    to the suggested-items list. */}
        {itemsInMyCityLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#ff4d2d] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Loading food items...</p>
          </div>
        ) : (
          <div className="w-full h-auto flex flex-wrap gap-[20px] justify-center">
            {updatedItemsList?.map((item, index) => (
              <FoodCard key={index} data={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
