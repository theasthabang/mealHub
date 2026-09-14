import Offer from "../models/offer.model.js"

// Offers currently valid right now -- active flag, and within their date
// window (validUntil null means "no expiry"). Used both by placeOrder (to
// actually apply a discount) and by the public customer-facing endpoint (to
// display what's currently on offer) -- one shared definition of "currently
// valid" for both.
export const getActiveOffersForShop = async (shopId) => {
    const now = new Date()
    return await Offer.find({
        shop: shopId,
        isActive: true,
        validFrom: { $lte: now },
        $or: [{ validUntil: null }, { validUntil: { $gte: now } }]
    })
}

// NEW: real discount computation, called from placeOrder using the shop's
// REAL, DB-priced shopOrderItems and subtotal (the same tamper-proof values
// the price-integrity fix already computes) -- an offer's discount is just
// as capable of being a price-tampering vector as a raw price would be, so
// this gets the identical treatment: computed entirely server-side, from
// real Offer records, never trusted from anything the client sends.
export const computeShopOrderDiscount = async (shopId, shopOrderItems, originalSubtotal) => {
    const offers = await getActiveOffersForShop(shopId)
    if (offers.length === 0) {
        return { discountAmount: 0, appliedOffers: [] }
    }

    const itemOffers = offers.filter(o => o.item)
    const shopWideOffers = offers.filter(o => !o.item)

    let totalDiscount = 0
    const appliedOffers = []

    // Item-specific offers: group by item, so if more than one offer somehow
    // targets the same item, only the single best one for that item applies
    // -- never double-discounting one line.
    const offersByItem = {}
    itemOffers.forEach(o => {
        const key = String(o.item)
        if (!offersByItem[key]) offersByItem[key] = []
        offersByItem[key].push(o)
    })

    shopOrderItems.forEach(lineItem => {
        const candidateOffers = offersByItem[String(lineItem.item)]
        if (!candidateOffers || candidateOffers.length === 0) return

        const lineTotal = lineItem.price * lineItem.quantity
        let bestDiscount = 0
        let bestOffer = null

        candidateOffers.forEach(offer => {
            let discount = offer.discountType === "percentage"
                ? (lineTotal * offer.discountValue) / 100
                : offer.discountValue

            if (offer.discountType === "percentage" && offer.maxDiscountAmount) {
                discount = Math.min(discount, offer.maxDiscountAmount)
            }
            // A discount can never exceed the value of the line it's discounting.
            discount = Math.min(discount, lineTotal)

            if (discount > bestDiscount) {
                bestDiscount = discount
                bestOffer = offer
            }
        })

        if (bestOffer && bestDiscount > 0) {
            totalDiscount += bestDiscount
            appliedOffers.push({ offer: bestOffer._id, title: bestOffer.title, amount: Math.round(bestDiscount * 100) / 100 })
        }
    })

    // Shop-wide offers: only the single BEST eligible one applies -- not
    // stacked with other shop-wide offers, matching how most real platforms
    // auto-apply "the best available offer" rather than combining several.
    let bestShopWideDiscount = 0
    let bestShopWideOffer = null

    shopWideOffers.forEach(offer => {
        if (originalSubtotal < offer.minOrderValue) return

        let discount = offer.discountType === "percentage"
            ? (originalSubtotal * offer.discountValue) / 100
            : offer.discountValue

        if (offer.discountType === "percentage" && offer.maxDiscountAmount) {
            discount = Math.min(discount, offer.maxDiscountAmount)
        }
        discount = Math.min(discount, originalSubtotal)

        if (discount > bestShopWideDiscount) {
            bestShopWideDiscount = discount
            bestShopWideOffer = offer
        }
    })

    if (bestShopWideOffer && bestShopWideDiscount > 0) {
        totalDiscount += bestShopWideDiscount
        appliedOffers.push({ offer: bestShopWideOffer._id, title: bestShopWideOffer.title, amount: Math.round(bestShopWideDiscount * 100) / 100 })
    }

    // Final safety net: even combining item-level + one shop-wide discount,
    // the total can never exceed this shop's own subtotal.
    totalDiscount = Math.min(totalDiscount, originalSubtotal)

    return { discountAmount: Math.round(totalDiscount * 100) / 100, appliedOffers }
}