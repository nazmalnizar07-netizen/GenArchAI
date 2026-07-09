/**
 * Data Normalizer — converts snake_case Firestore data to camelCase for API responses
 * Centralizes the mapping so frontend always receives consistent camelCase data.
 */

function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(normalizeObject);

    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = snakeToCamel(key);
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            normalized[camelKey] = normalizeObject(value);
        } else if (Array.isArray(value)) {
            normalized[camelKey] = value.map(item =>
                typeof item === 'object' ? normalizeObject(item) : item
            );
        } else {
            normalized[camelKey] = value;
        }
    }
    return normalized;
}

/**
 * Normalize a design document from Firestore (snake_case) to API response (camelCase)
 */
function normalizeDesign(doc) {
    if (!doc) return doc;
    return normalizeObject(doc);
}

/**
 * Normalize a project document
 */
function normalizeProject(doc) {
    if (!doc) return doc;
    return normalizeObject(doc);
}

module.exports = { normalizeObject, normalizeDesign, normalizeProject, snakeToCamel };
