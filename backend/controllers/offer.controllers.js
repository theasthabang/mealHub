import Offer from "../models/offer.model.js"
import { getActiveOffersForShop } from "../utils/offerHelpers.js"
import Shop from "../models/shop.model.js"
import Item from "../models/item.model.js"

// NEW: owner-side offer management. Every endpoint here verifies the
// requesting owner actually owns the shop in question -- same ownership-
// check pattern already used throughout this app (e.g. updateOrderStatus
// checking shopOrder.owner, getOrderById checking isShopOwnerOfOrder) --
// never trusting a shopId in the request body/params without confirming the
// logged-in user actually owns it.
export const createOffer = async (req, res) => {
    try {
        const { shopId, itemId, title, discountType, discountValue, maxDiscountAmount, minOrderValue, validUntil } = req.body

        if (!shopId || !title || !discountType || !discountValue) {
            return res.status(400).json({ message: "shopId, title, discountType, and discountValue are required" })
        }

        const shop = await Shop.findById(shopId)
        if (!shop) {
            return res.status(400).json({ message: "shop not found" })
        }
        if (String(shop.owner) !== String(req.userId)) {
            return res.status(403).json({ message: "you do not own this shop" })
        }

        if (!["percentage", "flat"].includes(discountType)) {
            return res.status(400).json({ message: "discountType must be 'percentage' or 'flat'" })
        }
        // A percentage above 100 makes no real-world sense (more than 100%
        // off), and a zero/negative value isn't a discount at all -- caught
        // here rather than left to whatever the schema's bare min:1 allows.
        if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
            return res.status(400).json({ message: "percentage discount must be between 1 and 100" })
        }
        if (discountType === "flat" && discountValue <= 0) {
            return res.status(400).json({ message: "flat discount must be a positive amount" })
        }

        // NEW: if this offer is scoped to one specific item, confirm that
        // item actually belongs to THIS shop -- otherwise an owner could
        // create a discount referencing another shop's item entirely.
        if (itemId) {
            const item = await Item.findById(itemId)
            if (!item) {
                return res.status(400).json({ message: "item not found" })
            }
            if (String(item.shop) !== String(shopId)) {
                return res.status(400).json({ message: "this item does not belong to your shop" })
            }
        }

        const offer = await Offer.create({
            shop: shopId,
            item: itemId || null,
            title,
            discountType,
            discountValue,
            maxDiscountAmount: discountType === "percentage" ? (maxDiscountAmount || null) : null,
            minOrderValue: itemId ? 0 : (minOrderValue || 0),
            validUntil: validUntil || null
        })

        return res.status(201).json(offer)
    } catch (error) {
        return res.status(500).json({ message: `create offer error ${error}` })
    }
}

// Owner's own management view -- ALL of this shop's offers, active or not,
// so they can see and toggle things they've previously turned off.
export const getMyOffers = async (req, res) => {
    try {
        const { shopId } = req.params

        const shop = await Shop.findById(shopId)
        if (!shop) {
            return res.status(400).json({ message: "shop not found" })
        }
        if (String(shop.owner) !== String(req.userId)) {
            return res.status(403).json({ message: "you do not own this shop" })
        }

        const offers = await Offer.find({ shop: shopId })
            .populate("item", "name image")
            .sort({ createdAt: -1 })

        return res.status(200).json(offers)
    } catch (error) {
        return res.status(500).json({ message: `get offers error ${error}` })
    }
}

export const toggleOfferActive = async (req, res) => {
    try {
        const { offerId } = req.params

        const offer = await Offer.findById(offerId).populate("shop", "owner")
        if (!offer) {
            return res.status(400).json({ message: "offer not found" })
        }
        if (String(offer.shop.owner) !== String(req.userId)) {
            return res.status(403).json({ message: "you do not own this offer" })
        }

        offer.isActive = !offer.isActive
        await offer.save()

        return res.status(200).json({ message: `offer ${offer.isActive ? "activated" : "deactivated"}`, offer })
    } catch (error) {
        return res.status(500).json({ message: `toggle offer error ${error}` })
    }
}

export const deleteOffer = async (req, res) => {
    try {
        const { offerId } = req.params

        const offer = await Offer.findById(offerId).populate("shop", "owner")
        if (!offer) {
            return res.status(400).json({ message: "offer not found" })
        }
        if (String(offer.shop.owner) !== String(req.userId)) {
            return res.status(403).json({ message: "you do not own this offer" })
        }

        await Offer.findByIdAndDelete(offerId)

        return res.status(200).json({ message: "offer deleted" })
    } catch (error) {
        return res.status(500).json({ message: `delete offer error ${error}` })
    }
}

// Public, customer-facing: only currently-active, currently-valid offers —
// reuses the exact same "what counts as active right now" definition
// placeOrder's discount computation uses, so what a customer sees displayed
// is guaranteed to match what actually gets applied at checkout.
export const getActiveOffersForShopPublic = async (req, res) => {
    try {
        const { shopId } = req.params
        const offers = await getActiveOffersForShop(shopId)
        const populated = await Offer.populate(offers, { path: "item", select: "name image" })
        return res.status(200).json(populated)
    } catch (error) {
        return res.status(500).json({ message: `get active offers error ${error}` })
    }
}