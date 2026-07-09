const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

// ─── Vision Model Selection ───────────────────────────────
// gemma-3-27b-it: ~14,000 RPD on free tier, supports vision (image+text)
// gemini-2.5-flash: only ~20 RPD on free tier
// We use Gemma 3 by default to preserve Gemini quota for other tasks.
const VISION_MODEL = process.env.VISION_MODEL || 'gemma-4-31b-it';

class GeminiVisionService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.isConfigured = !!this.apiKey;
        if (this.isConfigured) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: VISION_MODEL });
        }
        // In-memory prompt cache: avoids re-analyzing the same sketch
        // Key = hash of image buffer, Value = { prompt, timestamp }
        this.promptCache = new Map();
        this.CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
    }

    _hashBuffer(buffer) {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    _getCachedPrompt(imageHash) {
        const cached = this.promptCache.get(imageHash);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
            console.log(`Using cached vision prompt for sketch [${imageHash.slice(0, 8)}...]`);
            return cached.prompt;
        }
        if (cached) this.promptCache.delete(imageHash); // expired
        return null;
    }

    _setCachedPrompt(imageHash, prompt) {
        this.promptCache.set(imageHash, { prompt, timestamp: Date.now() });
        // Evict old entries if cache grows too large
        if (this.promptCache.size > 100) {
            const oldest = this.promptCache.keys().next().value;
            this.promptCache.delete(oldest);
        }
    }

    async analyzeSketchStructure(imageBuffer, style) {
        if (!this.isConfigured) return null;

        // Check cache first — same sketch = same structural prompt
        const imageHash = this._hashBuffer(imageBuffer);
        const cached = this._getCachedPrompt(imageHash);
        if (cached) return cached;

        try {
            console.log(`Analyzing sketch with ${VISION_MODEL}...`);

            const prompt = `You are an expert AI Architectural Analyst. The user has uploaded a hand-drawn sketch or floor plan of a building.

CRITICAL INSTRUCTION: You must describe this building as a COMPLETE 3D OBJECT, not just the visible facade. 
We will use your description to generate images from MULTIPLE camera angles (front, left side, right side, rear, aerial). 
Therefore your description must be VIEW-NEUTRAL — do NOT lock it to any specific camera angle or viewpoint.

Analyze the sketch and produce a detailed architectural description covering:

1. OVERALL 3D MASSING & SHAPE:
   - Overall building footprint shape (rectangular, L-shaped, U-shaped, etc.)
   - Width-to-depth-to-height proportions of the full 3D volume
   - Number of stories and floor heights
   - Any wings, extensions, setbacks, or protruding volumes

2. ROOF STRUCTURE:
   - Roof type (flat, gabled, hip, mansard, etc.), pitch angle, and overhang
   - Roof materials and colors

3. MATERIALS & TEXTURES (applied to the ENTIRE building, all sides):
   - Primary wall material and color
   - Secondary/accent materials
   - Foundation/base material

4. FEATURES PER SIDE (describe what would logically be on each side):
   - FRONT: Main entrance, facade features, window arrangement from the sketch
   - LEFT SIDE: Side wall features, secondary windows, any attached structures
   - RIGHT SIDE: Side wall features, secondary windows, any attached structures  
   - REAR: Back entrance, utility areas, patio/deck, rear windows
   - ROOF/TOP: Rooftop features, chimneys, skylights, solar panels

5. SURROUNDINGS: Driveway, walkways, landscaping, garden areas

6. ARCHITECTURAL STYLE: "${style}"

Output ONLY a detailed, view-neutral architectural description prompt suitable for Stable Diffusion / FLUX image generation.
Do NOT mention any specific camera angle or viewpoint in your output.
Do NOT say "front view" or "facing the camera" or anything that locks a perspective.
End with quality tokens: "photorealistic, 8k, architectural photography, sharp focus, professional rendering"`;

            const imageParts = [
                {
                    inlineData: {
                        data: imageBuffer.toString("base64"),
                        mimeType: "image/png"
                    }
                }
            ];

            const result = await this.model.generateContent([prompt, ...imageParts]);
            const textResponse = result.response.text().trim();
            console.log(`${VISION_MODEL} Analysis Complete:`, textResponse);

            // Cache the result so subsequent views don't re-call
            this._setCachedPrompt(imageHash, textResponse);

            return textResponse;
        } catch (error) {
            console.error(`${VISION_MODEL} Vision error:`, error.message);
            // If Gemma fails, fall back to Gemini Flash as last resort
            if (VISION_MODEL !== 'gemini-2.5-flash') {
                console.log('Falling back to gemini-2.5-flash...');
                try {
                    const fallbackModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const imageParts = [{ inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/png" } }];
                    const fallbackResult = await fallbackModel.generateContent([`You are an expert AI Architectural Analyst. Analyze this building sketch and output a detailed image generation prompt for Stable Diffusion/FLUX that recreates its exact geometry in "${style}" style. Output ONLY the prompt.`, ...imageParts]);
                    const text = fallbackResult.response.text().trim();
                    this._setCachedPrompt(imageHash, text);
                    return text;
                } catch (fallbackErr) {
                    console.error('Fallback to Gemini Flash also failed:', fallbackErr.message);
                }
            }
            return null;
        }
    }

    async analyzeRenovationStructure(imageBuffer, style, additionalPrompt) {
        if (!this.isConfigured) return null;

        // Check cache for renovation too
        const imageHash = this._hashBuffer(imageBuffer) + '_reno_' + style;
        const cached = this._getCachedPrompt(imageHash);
        if (cached) return cached;

        try {
            console.log(`Analyzing room for renovation with ${VISION_MODEL}...`);

            const prompt = `You are an expert AI Interior Designer and Architect. The user wants to renovate the uploaded image of a room or building.
Listen carefully: We need to recreate the exact physical structure of this space (walls, windows, main furniture placement, layout) but fully transform its aesthetic style.

1. Carefully analyze the exact geometry, layout, and existing elements in the image.
2. Break it down into strict physical instructions for the layout (e.g., "A bedroom with a large window on the left wall, a central bed facing the camera, a wardrobe on the right wall").
3. Apply the requested aesthetic style: "${style}".
${additionalPrompt ? `4. The user also specifically requested: "${additionalPrompt}".` : ''}

Output ONLY the raw highly detailed image generation prompt designed for Stable Diffusion / FLUX. 
Do not talk to me, do not say "Here is your prompt". Only output the prompt focusing strictly on matching the spatial layout perfectly while applying the new style.`;

            const imageParts = [
                {
                    inlineData: {
                        data: imageBuffer.toString("base64"),
                        mimeType: "image/png"
                    }
                }
            ];

            const result = await this.model.generateContent([prompt, ...imageParts]);
            const textResponse = result.response.text().trim();
            console.log(`${VISION_MODEL} Renovation Analysis Complete:`, textResponse);

            this._setCachedPrompt(imageHash, textResponse);
            return textResponse;
        } catch (error) {
            console.error(`${VISION_MODEL} Vision error (renovation):`, error.message);
            return null;
        }
    }
}

module.exports = new GeminiVisionService();
