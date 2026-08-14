import { createSlice } from "@reduxjs/toolkit";

const ownerSlice = createSlice({
    name: "owner",
    initialState: {
        myShopData: null
    },
    reducers: {
        setMyShopData: (state, action) => {
            state.myShopData = action.payload
        },
        // NEW: the toggle-status endpoint only returns { isOpen }, not the whole shop
        // object — this patches just that one field onto the existing myShopData
        // instead of needing a full re-fetch after every toggle.
        setShopOpenStatus: (state, action) => {
            if (state.myShopData) {
                state.myShopData.isOpen = action.payload
            }
        }
    }
})

export const { setMyShopData, setShopOpenStatus } = ownerSlice.actions
export default ownerSlice.reducer