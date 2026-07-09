const admin = require('firebase-admin');

let db = null;
let isConfigured = false;

try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
        const path = require('path');
        const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
        const serviceAccount = require(resolvedPath);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        db = admin.firestore();
        isConfigured = true;
        console.log('✅ Firebase Firestore initialized');
    } else {
        console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_PATH not set — running in-memory mode');
    }
} catch (err) {
    console.error('❌ Firebase init error:', err.message);
    console.warn('   Falling back to in-memory mode');
}

module.exports = { db, isConfigured };
