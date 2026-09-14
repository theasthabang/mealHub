import { createSlice } from "@reduxjs/toolkit";
// FIX: removed unused `current` import (the only real bug here — see note below)

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
    currentCity: null,
    currentState: null,
    currentAddress: null,
    shopInMyCity: null,
    itemsInMyCity: null,
    // NEW: mirrors myOrdersLoading below — useGetShopByCity/useGetItemsByCity had
    // no equivalent loading flag, so UserDashboard.jsx couldn't tell "still
    // fetching" apart from "genuinely no shops in this city," and would flash a
    // false empty state while the real data was still on its way.
    shopInMyCityLoading: true,
    itemsInMyCityLoading: true,
    cartItems: [],
    totalAmount: 0,
    myOrders: [],
    myOrdersLoading: true,
    searchItems: null,
    socket: null
  },
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload
    },
    setCurrentCity: (state, action) => {
      state.currentCity = action.payload
    },
    setCurrentState: (state, action) => {
      state.currentState = action.payload
    },
    setCurrentAddress: (state, action) => {
      state.currentAddress = action.payload
    },
    setShopsInMyCity: (state, action) => {
      state.shopInMyCity = action.payload
    },
    setShopInMyCityLoading: (state, action) => {
      state.shopInMyCityLoading = action.payload
    },
    setItemsInMyCity: (state, action) => {
      state.itemsInMyCity = action.payload
    },
    setItemsInMyCityLoading: (state, action) => {
      state.itemsInMyCityLoading = action.payload
    },
    setSocket: (state, action) => {
      state.socket = action.payload
    },
    addToCart: (state, action) => {
      const cartItem = action.payload
      const existingItem = state.cartItems.find(i => i.id == cartItem.id)
      if (existingItem) {
        existingItem.quantity += cartItem.quantity
      } else {
        state.cartItems.push(cartItem)
      }
      state.totalAmount = state.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    },
    setTotalAmount: (state, action) => {
      state.totalAmount = action.payload
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload
      const item = state.cartItems.find(i => i.id == id)
      if (item) {
        item.quantity = quantity
      }
      state.totalAmount = state.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    },
    removeCartItem: (state, action) => {
      state.cartItems = state.cartItems.filter(i => i.id !== action.payload)
      state.totalAmount = state.cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    },
    // NEW: previously nothing ever cleared the cart after a successful order —
    // a customer landing on "Order Placed!" and then navigating back to /cart
    // would still see the items they just ordered, inviting an accidental
    // re-order. Dispatched from CheckOut.jsx right after a successful COD or
    // online payment.
    clearCart: (state) => {
      state.cartItems = []
      state.totalAmount = 0
    },
    setMyOrders: (state, action) => {
      state.myOrders = action.payload
    },
    // NEW (loading-state fix): lets useGetMyOrders distinguish "still fetching" from
    // "fetched, and there really are zero orders" — without this, MyOrders.jsx couldn't
    // tell the two apart, since myOrders starts as [] either way and briefly flashed
    // the empty-state message before real data arrived.
    setMyOrdersLoading: (state, action) => {
      state.myOrdersLoading = action.payload
    },
    addMyOrder: (state, action) => {
      state.myOrders = [action.payload, ...state.myOrders]
    },
    // REVERTED to original: confirmed correct via order.controllers.js getMyOrders.
    // For an OWNER's myOrders, the backend deliberately flattens shopOrders to a single
    // object (order.shopOrders.find(o => o.owner._id == req.userId)) — only this owner's
    // slice of a possibly multi-shop order. This reducer is only ever dispatched from
    // OwnerOrderCard, against that owner-shaped myOrders array, so the object treatment
    // here is correct. Do not change this to array-based logic.
    updateOrderStatus: (state, action) => {
      const { orderId, shopId, status, cancelReason } = action.payload
      const order = state.myOrders.find(o => o._id == orderId)
      if (order) {
        if (order.shopOrders && order.shopOrders.shop._id == shopId) {
          order.shopOrders.status = status
          // NEW: carries the cancel reason through to the owner's view when the
          // 'order-cancelled' socket event fires (status will be "cancelled" then)
          if (cancelReason) {
            order.shopOrders.cancelReason = cancelReason
          }
        }
      }
    },
    // NEW: customer-side cancellation. Dispatched right after a successful
    // POST /api/order/cancel/:orderId/:shopId call. Uses the array shape, since this
    // is only ever dispatched against the USER's myOrders (owner cancellations don't
    // exist — only customers cancel, via updateOrderStatus above instead).
    cancelOrderStatus: (state, action) => {
      const { orderId, shopId, cancelReason, refundAmount, refundStatus, refundedAt } = action.payload
      const order = state.myOrders.find(o => o._id == orderId)
      if (order) {
        const shopOrder = order.shopOrders.find(so => so.shop._id == shopId)
        if (shopOrder) {
          shopOrder.status = "cancelled"
          shopOrder.cancelReason = cancelReason
          // NEW: refund summary, only set when this cancellation actually
          // triggered a real refund (undefined for COD/unpaid orders,
          // which is fine — the UI only shows this section when it's present)
          if (refundAmount !== undefined) {
            shopOrder.refundAmount = refundAmount
            shopOrder.refundStatus = refundStatus
            shopOrder.refundedAt = refundedAt
          }
        }
      }
    },
    // For a USER's myOrders, getMyOrders returns full Order docs — shopOrders stays the
    // full ARRAY (a single order can span multiple shops). This reducer is only ever
    // dispatched via the 'update-status' socket event sent to the customer, against
    // that user-shaped myOrders array, so the array treatment here is correct.
    updateRealtimeOrderStatus: (state, action) => {
      const { orderId, shopId, status } = action.payload
      const order = state.myOrders.find(o => o._id == orderId)
      if (order) {
        const shopOrder = order.shopOrders.find(so => so.shop._id == shopId)
        if (shopOrder) {
          shopOrder.status = status
        }
      }
    },
    setSearchItems: (state, action) => {
      state.searchItems = action.payload
    },
    // NEW: persists a star rating into myOrders locally right after the rating
    // endpoint succeeds, so the stars stay filled without waiting for a refetch —
    // mirrors the array-shaped lookup updateRealtimeOrderStatus above already uses
    // for the customer's myOrders (shopOrders stays a full array here, since one
    // order can span multiple shops).
    setItemRating: (state, action) => {
      const { orderId, shopId, itemId, rating } = action.payload
      const order = state.myOrders.find(o => o._id == orderId)
      if (order) {
        const shopOrder = order.shopOrders.find(so => so.shop._id == shopId)
        if (shopOrder) {
          const shopOrderItem = shopOrder.shopOrderItems.find(i => i.item._id == itemId)
          if (shopOrderItem) {
            shopOrderItem.userRating = rating
          }
        }
      }
    }
  }
})

export const {
  setUserData, setCurrentAddress, setCurrentCity, setCurrentState, setShopsInMyCity,
  setShopInMyCityLoading, setItemsInMyCity, setItemsInMyCityLoading, addToCart,
  updateQuantity, removeCartItem, clearCart, setMyOrders, setMyOrdersLoading, addMyOrder,
  updateOrderStatus, setSearchItems, setTotalAmount, setSocket, updateRealtimeOrderStatus,
  cancelOrderStatus, setItemRating
} = userSlice.actions
export default userSlice.reducer