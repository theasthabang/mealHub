import axios from 'axios'
import toast from 'react-hot-toast'
import { store } from '../redux/store'
import { setUserData } from '../redux/userSlice'

// NEW (Phase 4 — axios 401 interceptor): registers a global response interceptor on
// axios's default singleton instance. Since every file in this app does
// `import axios from 'axios'` (not a shared axios.create() instance), this still
// applies everywhere — axios's default export is a shared singleton across the whole
// bundle, so registering the interceptor once here covers every request in the app.
//
// Import this file ONCE, as a side-effect import, near the top of App.jsx — it doesn't
// export anything meaningful, it just needs to run before any request fires.
//
// Design decision: we only show the "session expired" toast + force a redirect when the
// Redux store currently believes the user WAS logged in (userData is truthy) at the
// moment a 401 comes back. This distinguishes two very different situations:
//   1. A logged-in user's 7-day token actually expired mid-session -> this is the case
//      we want to announce clearly and recover from.
//   2. A first-time/logged-out visitor's initial useGetCurrentUser() check 401s, which
//      is completely normal and already handled gracefully by App.jsx's own
//      <Navigate to="/signin"/> route guards -> we deliberately stay silent here, since
//      showing "session expired" to someone who was never logged in is confusing.
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            const state = store.getState()
            const wasLoggedIn = !!state.user.userData

            if (wasLoggedIn) {
                store.dispatch(setUserData(null))
                toast.error("Your session has expired. Please log in again.")
                // A full reload (rather than client-side navigate) is used deliberately
                // here: this interceptor runs outside any React component, so it has no
                // access to react-router's navigate() or useNavigate(). A hard redirect
                // is a reasonable tradeoff for a rare event (session expiry every ~7
                // days); if this ever needs to be a client-side nav instead, that would
                // require lifting a router history reference out of App.jsx.
                window.location.href = "/signin"
            }
        }
        return Promise.reject(error)
    }
)