import { createSlice } from "@reduxjs/toolkit";

const ownerSlice = createSlice({
    name: "owner",
    initialState: {
        myShopData: null,
        // NEW: count of new orders the owner hasn't looked at yet. Lives here (in
        // Redux) rather than as local state in Nav.jsx because Nav unmounts every
        // time the owner navigates to a different route (react-router swaps the
        // whole page) — local state would reset to 0 on every navigation, losing
        // track of orders that came in while they were on, say, the add-item page.
        newOrderCount: 0
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
        },
        // NEW: bumped once per incoming 'newOrder' socket event while the owner is
        // anywhere other than the My Orders page (see Nav.jsx).
        incrementNewOrderCount: (state) => {
            state.newOrderCount += 1
        },
        // NEW: cleared once the owner actually opens My Orders and sees the list —
        // "unseen" only means anything until they've looked.
        resetNewOrderCount: (state) => {
            state.newOrderCount = 0
        }
    }
})

export const { setMyShopData, setShopOpenStatus, incrementNewOrderCount, resetNewOrderCount } = ownerSlice.actions
export default ownerSlice.reducer