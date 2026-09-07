import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"
const uploadOnCloudinary = async (file) => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    try {
        const result = await cloudinary.uploader.upload(file)
        fs.unlinkSync(file)
        return result.secure_url
    } catch (error) {
        fs.unlinkSync(file)
        // FIX (silent failure): this used to just console.log the error and
        // return undefined. Every caller (addItem, editItem, createEditShop) would
        // then try to save `image: undefined` — for a NEW item/shop, the model's
        // `required: true` on image turns that into a confusing Mongoose
        // ValidationError far from the actual cause; for an EDIT, undefined is
        // silently dropped by the DB driver (safe, but still means "your new
        // image upload failed" surfaced as nothing at all). Throwing here lets
        // the caller's own try/catch return a clear "image upload failed"
        // message instead.
        console.log("Cloudinary upload error:", error)
        throw new Error(`Image upload failed: ${error.message || error}`)
    }
}

export default uploadOnCloudinary