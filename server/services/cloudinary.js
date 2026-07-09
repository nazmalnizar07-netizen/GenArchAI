const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CloudinaryService {
    constructor() {
        this.isConfigured = !!(
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
        );

        if (this.isConfigured) {
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
            });
        }

        // Ensure local uploads dir exists
        this.uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    async upload(fileBuffer, folder = 'genarchai') {
        if (this.isConfigured) {
            try {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder, resource_type: 'image' },
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        }
                    );
                    stream.end(fileBuffer);
                });

                return {
                    success: true,
                    url: result.secure_url,
                    publicId: result.public_id,
                    width: result.width,
                    height: result.height,
                };
            } catch (err) {
                console.error('Cloudinary upload error:', err.message);
                return this._saveLocal(fileBuffer);
            }
        }

        return this._saveLocal(fileBuffer);
    }

    async uploadFromUrl(url, folder = 'genarchai') {
        if (this.isConfigured) {
            try {
                const result = await cloudinary.uploader.upload(url, { folder });
                return {
                    success: true,
                    url: result.secure_url,
                    publicId: result.public_id,
                };
            } catch (err) {
                console.error('Cloudinary URL upload error:', err.message);
            }
        }
        return { success: true, url };
    }

    _saveLocal(fileBuffer) {
        const filename = `${uuidv4()}.png`;
        const filepath = path.join(this.uploadsDir, filename);
        fs.writeFileSync(filepath, fileBuffer);

        return {
            success: true,
            url: `/uploads/${filename}`,
            publicId: filename,
            isLocal: true,
        };
    }

    async delete(publicId) {
        if (this.isConfigured) {
            try {
                await cloudinary.uploader.destroy(publicId);
                return { success: true };
            } catch (err) {
                console.error('Cloudinary delete error:', err.message);
            }
        }
        return { success: false };
    }
}

module.exports = new CloudinaryService();
