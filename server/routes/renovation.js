const express = require('express');
const router = express.Router();
const multer = require('multer');
const huggingface = require('../services/huggingface');
const cloudinaryService = require('../services/cloudinary');
const imageProcessor = require('../utils/imageProcessor');
const { db, isConfigured } = require('../services/firebase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/renovate', upload.single('image'), async (req, res) => {
    try {
        const { style = 'modern', prompt = '', projectId } = req.body;
        const io = req.app.get('io');

        if (io && projectId) io.to(`project-${projectId}`).emit('renovation-status', { status: 'processing', message: 'Renovating your room...' });
        else if (io) io.emit('renovation-status', { status: 'processing', message: 'Renovating your room...' });

        let imageBuffer = null;
        if (req.file) {
            imageBuffer = await imageProcessor.compress(req.file.buffer, { width: 768, height: 512 });
        }

        const result = await huggingface.renovateImage(imageBuffer, style, prompt);

        let imageUrl;
        if (result.image) {
            try {
                const uploaded = await cloudinaryService.upload(result.image, 'genarchai/renovations');
                imageUrl = uploaded.url;
            } catch (uploadErr) {
                console.warn('Cloudinary upload failed for renovation, falling back to local storage:', uploadErr.message);
                const localUpload = await cloudinaryService._saveLocal(result.image);
                imageUrl = localUpload.url;
            }
        } else {
            imageUrl = result.mockUrl;
        }

        if (projectId) {
            const renoId = Date.now().toString();
            const newReno = {
                id: renoId,
                project_id: projectId,
                image_url: imageUrl,
                prompt,
                style,
                type: 'renovation',
                created_at: new Date().toISOString()
            };
            let savedToDb = false;
            try {
                if (isConfigured && db) {
                    await db.collection('designs').doc(renoId).set(newReno);
                    savedToDb = true;
                }
            } catch (dbErr) {
                console.error("Failed to save renovation to Firestore:", dbErr.message);
            }
            if (!savedToDb) {
                global.memoryDesigns = global.memoryDesigns || [];
                global.memoryDesigns.push(newReno);
            }
        }

        if (io && projectId) io.to(`project-${projectId}`).emit('renovation-status', { status: 'complete', message: 'Renovation complete!' });
        else if (io) io.emit('renovation-status', { status: 'complete', message: 'Renovation complete!' });

        res.json({
            success: true,
            originalUrl: req.body.originalUrl || null,
            renovatedUrl: imageUrl,
            style,
            isMock: result.isMock || false,
        });
    } catch (err) {
        console.error('Renovation error:', err);
        res.status(500).json({ error: 'Failed to renovate image' });
    }
});

module.exports = router;
