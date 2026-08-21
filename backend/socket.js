import jwt from "jsonwebtoken"
import User from "./models/user.model.js"
import Order from "./models/order.model.js"

// FIX (critical — spoofable identity/location): every handler below used to trust
// whatever `userId` the CLIENT put in the emitted payload — 'identity' and
// 'updateLocation' both did `User.findByIdAndUpdate(userId, ...)` using that
// client-supplied value with no proof it belonged to whoever was actually
// connected. Any browser tab with a socket connection could claim to be ANY
// user's ID: flip a stranger's isOnline status, or push fake GPS coordinates that
// live-update a real customer's delivery-tracking map. isAuth.js already solves
// this exact problem for ordinary HTTP requests by reading the httpOnly JWT
// cookie instead of trusting anything the client asserts — this does the same
// thing for the socket connection, once, at handshake time.

// Minimal manual cookie parser: reading a single named cookie out of the raw
// `Cookie` header string on the socket handshake. Not pulling in the `cookie`
// package here since it isn't a direct dependency of this project (only a
// transitive one, via cookie-parser) — a few lines avoids adding an implicit
// dependency for something this small.
const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const key = pair.slice(0, idx).trim()
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim())
    }
  }
  return null
}

export const socketHandler = (io) => {
  // Runs once per new connection, before 'connection' fires — rejects the
  // handshake entirely if there's no valid session, exactly like isAuth.js
  // rejects an HTTP request. socket.userId below is the ONLY source of truth for
  // "who is this" from this point on; no handler trusts a client-supplied userId
  // again.
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie
      const token = getCookieValue(cookieHeader, "token")
      if (!token) {
        return next(new Error("unauthorized"))
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      socket.userId = decoded.userId
      next()
    } catch (error) {
      // Covers a missing cookie, an expired/tampered token, and a missing
      // JWT_SECRET — all are "can't trust this connection," same as isAuth.js
      // collapsing every failure mode into one clear rejection.
      next(new Error("unauthorized"))
    }
  })

  io.on('connection', (socket) => {
    console.log(socket.id)

    // FIX (privacy leak — location broadcast to everyone): tracks which order
    // this delivery boy's most recent updateLocation call was already verified
    // against, so the DB isn't hit on every single GPS tick — only when the order
    // they're broadcasting for actually changes (picking up a new delivery).
    let verifiedDeliveryOrderId = null

    // FIX: no longer destructures userId from the client payload — socket.userId
    // (set above from the verified JWT) is used instead. The frontend can keep
    // sending { userId } in its emit without any change; it's simply ignored now.
    socket.on('identity', async () => {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          socketId: socket.id, isOnline: true
        }, { new: true })
      } catch (error) {
        console.log(error)
      }
    })


    // FIX (privacy leak — location broadcast to everyone): this used to
    // `io.emit(...)` a delivery boy's live coordinates to EVERY connected
    // client — any logged-in user could listen for 'updateDeliveryLocation' and
    // passively track every active delivery boy in the system, not just their
    // own order. Now the delivery boy's client sends the orderId they're
    // currently delivering, the server verifies (once per order — cached in
    // verifiedDeliveryOrderId above, re-checked only when it changes) that
    // socket.userId really is the assigned delivery boy for THAT order, and only
    // broadcasts into a room scoped to that specific order — a room only joined
    // by clients who separately proved they're allowed to see it (see
    // 'trackOrder' below). No orderId, or a failed check, means no broadcast —
    // fails closed rather than falling back to the old global emit.
    socket.on('updateLocation', async ({ latitude, longitude, orderId }) => {
      try {
        const user = await User.findByIdAndUpdate(socket.userId, {
          location: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          isOnline: true,
          socketId: socket.id
        })

        if (!user || !orderId) return

        if (verifiedDeliveryOrderId !== orderId) {
          const order = await Order.findById(orderId)
          const isAssigned = order?.shopOrders?.some(
            so => String(so.assignedDeliveryBoy) === String(socket.userId)
          )
          if (!isAssigned) {
            // Sent an orderId they're not actually assigned to (stale client
            // state, or a spoofing attempt) — don't cache it, don't broadcast.
            return
          }
          verifiedDeliveryOrderId = orderId
        }

        io.to(`order:${orderId}`).emit('updateDeliveryLocation', {
          deliveryBoyId: socket.userId,
          latitude,
          longitude
        })

      } catch (error) {
          console.log('updateDeliveryLocation error')
      }
    })

    // NEW: a client (the order's customer, the shop owner, or the assigned
    // delivery boy) joins this room only after the server independently
    // verifies — via a real DB check, not just by knowing an orderId — that
    // they're actually allowed to see it. Mirrors the same three-way
    // authorization getOrderById already enforces over HTTP in
    // order.controllers.js, applied here to the socket room instead.
    socket.on('trackOrder', async ({ orderId }) => {
      try {
        if (!orderId) return
        const order = await Order.findById(orderId)
        if (!order) return

        const isCustomer = String(order.user) === String(socket.userId)
        const isOwnerOrDeliveryBoy = order.shopOrders?.some(so =>
          String(so.owner) === String(socket.userId) ||
          String(so.assignedDeliveryBoy) === String(socket.userId)
        )

        if (isCustomer || isOwnerOrDeliveryBoy) {
          socket.join(`order:${orderId}`)
        }
      } catch (error) {
        console.log('trackOrder error')
      }
    })

    socket.on('stopTrackingOrder', ({ orderId }) => {
      if (orderId) socket.leave(`order:${orderId}`)
    })


    socket.on('disconnect', async () => {
      try {

        await User.findOneAndUpdate({ socketId: socket.id }, {
          socketId: null,
          isOnline: false
        })
      } catch (error) {
        console.log(error)
      }

    })
  })
}