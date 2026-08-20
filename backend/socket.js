import jwt from "jsonwebtoken"
import User from "./models/user.model.js"

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


    socket.on('updateLocation', async ({ latitude, longitude }) => {
      try {
        const user = await User.findByIdAndUpdate(socket.userId, {
          location: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          isOnline: true,
          socketId: socket.id
        })

        if (user) {
          io.emit('updateDeliveryLocation', {
            deliveryBoyId: socket.userId,
            latitude,
            longitude
          })
        }


      } catch (error) {
          console.log('updateDeliveryLocation error')
      }
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