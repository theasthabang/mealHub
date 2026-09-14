import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { createOffer, getMyOffers, toggleOfferActive, deleteOffer, getActiveOffersForShopPublic } from "../controllers/offer.controllers.js"

const offerRouter = express.Router()

// Public — no isAuth. This just displays currently-active offers, the same
// read-only, no-authorization-needed shape as browsing a shop's menu.
offerRouter.get("/active/:shopId", getActiveOffersForShopPublic)

// All owner-management routes behind isAuth -- ownership itself (does this
// owner actually own the shop/offer in question) is checked inside each
// controller, same as everywhere else in this app.
offerRouter.post("/create", isAuth, createOffer)
offerRouter.get("/my-offers/:shopId", isAuth, getMyOffers)
offerRouter.patch("/toggle/:offerId", isAuth, toggleOfferActive)
offerRouter.delete("/:offerId", isAuth, deleteOffer)

export default offerRouter