import multer from "multer"
import fs from "fs"

// FIX (Phase 3, #5): three issues in the original config —
// 1. filename collision: `cb(null, file.originalname)` meant two uploads named
//    "image.jpg" (which is an extremely common filename) would silently overwrite
//    each other on disk, corrupting whichever upload finished last.
// 2. no file-type filter: the frontend's `accept="image/*"` is just a UI hint, not
//    enforcement — nothing stopped a direct API call from uploading any file type.
// 3. no size limit: nothing stopped a very large file from being uploaded, tying up
//    disk space and upload time.

// Ensure the upload directory exists so multer doesn't throw on a fresh clone/deploy
// where "./public" hasn't been created yet
const uploadDir = "./public"
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        cb(null, `${uniqueSuffix}-${file.originalname}`)
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true)
    } else {
        cb(new Error("Only image files are allowed"), false)
    }
}

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
})