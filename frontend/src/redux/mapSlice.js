import { createSlice } from "@reduxjs/toolkit";
// FIX (dead code): removed unused `current` import

// FIX (duplicate Redux slice name): this was `name: "user"`, identical to userSlice.js's
// name. Both slices still worked correctly today since they're stored under different
// store keys (`map` and `user`), but every action this slice dispatches showed up in
// Redux DevTools/logs as `user/setLocation`, `user/setAddress`, etc. — indistinguishable
// from userSlice's own actions. Renamed to "map" to match its actual store key.
const mapSlice = createSlice({
    name: "map",
    initialState: {
        location: {
            lat: null,
            lon: null
        },
        address: null
    },
    reducers: {
        setLocation: (state, action) => {
            const { lat, lon } = action.payload
            state.location.lat = lat
            state.location.lon = lon
        },
        setAddress: (state, action) => {
            state.address = action.payload
        }
    }
})

export const { setAddress, setLocation } = mapSlice.actions
export default mapSlice.reducer