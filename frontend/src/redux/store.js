import { configureStore } from "@reduxjs/toolkit";
import userSlice from "./userSlice"
import ownerSlice from "./ownerSlice"
import mapSlice from "./mapSlice"

export const store = configureStore({
    reducer: {
        user: userSlice,
        owner: ownerSlice,
        map: mapSlice
    },
    // FIX (console noise, not a real bug): Redux Toolkit's default
    // serializableCheck middleware warns whenever a non-plain-data value lands
    // in state — and userSlice.js deliberately stores the live Socket.IO
    // connection object (via setSocket, set from App.jsx) directly in state.
    // That's a real class instance with internal buffers and connection state,
    // not simple data, so the check re-flags it on every single action, under
    // whatever action name happened to fire — not because that action itself
    // did anything wrong. Storing the socket instance in Redux is a deliberate,
    // common pattern (so any component can reach it via useSelector without prop
    // drilling), so the fix is telling the check to allow exactly this one path
    // rather than disabling the check globally.
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: ['user/setSocket'],
                ignoredPaths: ['user.socket']
            }
        })
})