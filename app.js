import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import sharp from "sharp";
import cors from "cors";

dotenv.config();

const app = express();

app.use(cors({
	origin: [
		"http://localhost:5173", //WILL DELETE AFTER TESTING
		"https://api.bitezy.online"
	],
	methods: ["POST", "GET"],
	allowedHeaders: ["Content-Type", "x-service-key"],
}));

const PORT = process.env.PORT || 3020;
const SERVICE_KEY = process.env.SERVICE_KEY;
const ENVIRONMENT = process.env.ENVIRONMENT || "production";

const BASE_UPLOAD_DIR =
	ENVIRONMENT === "development"
		? path.resolve("./assets")
		: "/var/www/cdn/assets";

const BASE_URL =
	ENVIRONMENT === "development"
		? "http://localhost:3020/assets"
		: "https://cdn.bitezy.online/assets";

fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });

function sanitizeMerchantId(id) {
	if (!id) return null;
	const clean = id.replace(/[^a-zA-Z0-9_-]/g, "");
	return clean.length ? clean : null;
}

function validateServiceKey(req, res, next) {
	const key = req.headers["x-service-key"];

	if (!key || key !== SERVICE_KEY) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	next();
}

// ================= MULTER =================

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		console.log(req)
		const merchantId = sanitizeMerchantId(req.body.merchantId);

		if (!merchantId) {
			return cb(new Error("Invalid merchantId"));
		}

		req.merchantId = merchantId;

		const merchantDir = path.join(BASE_UPLOAD_DIR, merchantId);
		fs.mkdirSync(merchantDir, { recursive: true });

		cb(null, merchantDir);
	},

	filename: (req, file, cb) => {
		cb(null, uuidv4() + path.extname(file.originalname));
	},
});

const fileFilter = (req, file, cb) => {
	if (!file.mimetype.startsWith("image/")) {
		return cb(new Error("Only image files allowed"));
	}
	cb(null, true);
};

const upload = multer({
	storage,
	fileFilter,
	limits: { fileSize: 5 * 1024 * 1024 },
});



app.post(
	"/upload",
	// upload.none(),
	validateServiceKey,
	upload.single("file"),
	async (req, res) => {
		try {
			console.log(req.file)

			if (!req.file) {
				return res.status(400).json({ error: "No file uploaded" });
			}
			const merchantId = req.merchantId;
			const originalPath = req.file.path;
			const webpName = uuidv4() + ".webp";
			const webpPath = path.join(
				BASE_UPLOAD_DIR,
				merchantId,
				webpName
			);

			// Convert to WebP
			await sharp(originalPath)
				.webp({ quality: 82 }) // lower quality = lower file
				.toFile(webpPath);

			// Remove original upload
			fs.unlinkSync(originalPath);

			const publicUrl = `${BASE_URL}/${merchantId}/${webpName}`;

			res.json({
				success: true,
				merchantId,
				filename: webpName,
				url: publicUrl,
			});
		} catch (err) {
			next(err);
		}
	}
);

app.get("/", (req, res) => {
	res.status(404).json({ error: "Not Found" });
});

app.use((err, req, res, next) => {
	console.error("Upload error:", err.message);

	res.status(400).json({
		error: err.message || "Upload failed",
	});
});

app.listen(PORT, () => {
	console.log(`Upload API running on port ${PORT}`);
});
