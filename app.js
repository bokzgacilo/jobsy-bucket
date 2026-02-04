import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const app = express();

const UPLOAD_DIR = "/var/www/cdn/assets";
const BASE_URL = "https://cdn.bitezy.online/assets";

// Ensure folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = uuidv4() + ext;
        cb(null, filename);
    },
});

// Only allow images
const fileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image files allowed"), false);
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

app.post("/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const publicUrl = `${BASE_URL}/${req.file.filename}`;

    res.json({
        success: true,
        url: publicUrl,
        filename: req.file.filename,
    });
});

app.get("/", (req, res) => {
    return res.status(404).json({
        error: "Not Found"
    });
});

app.listen(3020, () => console.log("Upload API running on port 3020"));
