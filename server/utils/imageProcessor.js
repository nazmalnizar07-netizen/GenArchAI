const sharp = require('sharp');

class ImageProcessor {
    async compress(buffer, options = {}) {
        const { width = 768, height = 512, quality = 80 } = options;
        try {
            const processed = await sharp(buffer)
                .resize(width, height, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality })
                .toBuffer();
            return processed;
        } catch (err) {
            console.error('Image processing error:', err.message);
            return buffer;
        }
    }

    async toBase64(buffer) {
        try {
            const processed = await sharp(buffer).png().toBuffer();
            return processed.toString('base64');
        } catch (err) {
            return buffer.toString('base64');
        }
    }

    async getMetadata(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: buffer.length,
            };
        } catch (err) {
            return { width: 0, height: 0, format: 'unknown', size: buffer.length };
        }
    }
}

module.exports = new ImageProcessor();
