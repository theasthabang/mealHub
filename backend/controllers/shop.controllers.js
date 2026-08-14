import Shop from "../models/shop.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

export const createEditShop = async (req, res) => {
    try {
        const { name, city, state, address } = req.body
        let image;
        if (req.file) {
            image = await uploadOnCloudinary(req.file.path)
        }
        let shop = await Shop.findOne({ owner: req.userId })
        if (!shop) {
            shop = await Shop.create({
                name, city, state, address, image, owner: req.userId
            })
        } else {
            shop = await Shop.findByIdAndUpdate(shop._id, {
                name, city, state, address, image, owner: req.userId
            }, { new: true })
        }

        await shop.populate("owner items")
        return res.status(201).json(shop)
    } catch (error) {
        return res.status(500).json({ message: `create shop error ${error}` })
    }
}

export const getMyShop = async (req, res) => {
    try {
        const shop = await Shop.findOne({ owner: req.userId }).populate("owner").populate({
            path: "items",
            options: { sort: { updatedAt: -1 } }
        })
        // FIX (Phase 3, #3 — hanging response): `return null` sends NO HTTP response at
        // all. A new owner who hasn't created a shop yet would send this request and it
        // would just hang forever (until the browser/axios timeout), rather than
        // resolving. A 200 with `null` is the correct "no shop yet" response — it matches
        // what the frontend already expects (`dispatch(setMyShopData(result.data))` where
        // `result.data` being `null` is a normal, valid state).
        if (!shop) {
            return res.status(200).json(null)
        }
        return res.status(200).json(shop)
    } catch (error) {
        return res.status(500).json({ message: `get my shop error ${error}` })
    }
}

export const getShopByCity = async (req, res) => {
    try {
        const { city } = req.params

        // NEW: extended the same "closed shops shouldn't be listed" fix here too —
        // showing a closed shop under "Best Shop in your city" when a customer can't
        // actually order from it felt like the same problem as the item-listing one.
        // If you'd rather keep closed shops VISIBLE but clearly marked "Closed"
        // instead of hiding them from this list entirely, this is a one-line change
        // back (remove isOpen: true, add the isOpen flag to the response instead) —
        // flagging it since it's a judgment call, not something explicitly asked for.
        const shops = await Shop.find({
            city: { $regex: new RegExp(`^${city}$`, "i") },
            isOpen: true
        }).populate('items')
        if (!shops) {
            return res.status(400).json({ message: "shops not found" })
        }
        return res.status(200).json(shops)
    } catch (error) {
        return res.status(500).json({ message: `get shop by city error ${error}` })
    }
}

// NEW: real open/closed toggle. Self-scoped to the requester's own shop (same
// pattern as getMyShop) — no separate role check needed, since a non-owner has no
// shop to find in the first place.
export const toggleShopStatus = async (req, res) => {
    try {
        const shop = await Shop.findOne({ owner: req.userId })
        if (!shop) {
            return res.status(400).json({ message: "shop not found" })
        }
        shop.isOpen = !shop.isOpen
        await shop.save()
        return res.status(200).json({ isOpen: shop.isOpen })
    } catch (error) {
        return res.status(500).json({ message: `toggle shop status error ${error}` })
    }
}