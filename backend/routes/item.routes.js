import express from "express"

import isAuth from "../middlewares/isAuth.js"
import { addItem, deleteItem, editItem, getItemByCity, getItemById, getItemsByShop, rating, searchItems, toggleItemAvailability } from "../controllers/item.controllers.js"
import { upload } from "../middlewares/multer.js"

const itemRouter = express.Router()

itemRouter.post("/add-item", isAuth, upload.single("image"), addItem)
itemRouter.post("/edit-item/:itemId", isAuth, upload.single("image"), editItem)
itemRouter.get("/get-by-id/:itemId", isAuth, getItemById)
// FIX (CSRF exposure): same class of issue as order.routes.js's accept-order —
// GET mutating state (permanently deleting a menu item) with no CSRF protection.
itemRouter.post("/delete/:itemId", isAuth, deleteItem)
itemRouter.get("/get-by-city/:city", isAuth, getItemByCity)
itemRouter.get("/get-by-shop/:shopId", isAuth, getItemsByShop)
itemRouter.get("/search-items", isAuth, searchItems)
itemRouter.post("/rating", isAuth, rating)
// NEW: real availability toggle
itemRouter.post("/toggle-availability/:itemId", isAuth, toggleItemAvailability)

export default itemRouter