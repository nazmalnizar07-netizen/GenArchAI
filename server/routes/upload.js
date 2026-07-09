const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinaryService = require('../services/cloudinary');
const imageProcessor = require('../utils/imageProcessor');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Compress image
        const compressed = await imageProcessor.compress(req.file.buffer, {
            width: 1024,
            height: 1024,
            quality: 85,
        });

        // Upload to Cloudinary or local (with fallback on timeout)
        let result;
        try {
            result = await cloudinaryService.upload(compressed, 'genarchai/uploads');
        } catch (uploadErr) {
            console.warn('Cloudinary upload failed, falling back to local storage:', uploadErr.message);
            result = await cloudinaryService._saveLocal(compressed);
        }

        res.json({
            success: true,
            url: result.url,
            publicId: result.publicId,
            isLocal: result.isLocal || false,
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;
