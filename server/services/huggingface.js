const { HfInference } = require('@huggingface/inference');
const geminiVision = require('./geminiVision');

const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';
const MAX_INFERENCE_STEPS = 12;

class HuggingFaceService {
    constructor() {
        this.apiKey = process.env.HUGGINGFACE_API_KEY;
        this.isConfigured = !!this.apiKey;
        if (this.isConfigured) {
            this.hf = new HfInference(this.apiKey);
        }
    }

    async generateDesign(prompt, style = 'modern', imageBuffer = null, viewAngle = 'front') {
        let finalPrompt = prompt;
        let structuralPrompt = null; // The raw Gemini/Gemma vision output

        // If a sketch is provided, extract its exact geometry using Gemini Vision
        if (imageBuffer) {
            console.log('Sketch provided. Attempting to extract structural geometry via Gemini Vision...');
            const visionPrompt = await geminiVision.analyzeSketchStructure(imageBuffer, style);

            if (visionPrompt) {
                finalPrompt = visionPrompt;
                structuralPrompt = visionPrompt; // Save for reuse by other views
                console.log('Generated Structural Prompt successfully.');
            } else {
                console.log('Gemini Vision unavailable or failed. Using standard text prompt.');
            }
        }

        const fullPrompt = this._buildArchPrompt(finalPrompt, style, viewAngle);

        if (!this.isConfigured) {
            return { ...this._getMockDesign(style), structuralPrompt };
        }

        try {
            console.log(`Starting generation with SDK... Model: ${DEFAULT_MODEL}`);
            const blob = await this.hf.textToImage({
                inputs: fullPrompt,
                model: DEFAULT_MODEL,
                parameters: {
                    negative_prompt: "blurry, dark, low quality, deformed, text, watermark",
                    guidance_scale: 7.5,
                    num_inference_steps: MAX_INFERENCE_STEPS
                }
            });

            console.log('Generation success!');
            const buffer = Buffer.from(await blob.arrayBuffer());

            return {
                success: true,
                image: buffer,
                prompt: fullPrompt,
                structuralPrompt, // Pass the vision output back for DB storage
                model: DEFAULT_MODEL,
            };
        } catch (err) {
            console.error('HuggingFace SDK generation error:', err.message);
            return { ...this._getMockDesign(style), structuralPrompt };
        }
    }

    async renovateImage(imageBuffer, style = 'modern', prompt = '') {
        let finalPrompt = prompt;

        console.log('Room image provided. Attempting to extract physical layout via Gemini Vision...');
        const visionPrompt = await geminiVision.analyzeRenovationStructure(imageBuffer, style, prompt);

        if (visionPrompt) {
            finalPrompt = visionPrompt;
            console.log('Generated Renovation Prompt successfully.');
        } else {
            console.log('Gemini Vision unavailable or failed. Using standard text prompt.');
        }

        const fullPrompt = this._buildRenovationPrompt(style, finalPrompt);

        if (!this.isConfigured) {
            return this._getMockRenovation(style);
        }

        try {
            console.log(`Starting generation with SDK... Model: ${DEFAULT_MODEL}`);
            const blob = await this.hf.textToImage({
                inputs: fullPrompt,
                model: DEFAULT_MODEL,
                parameters: {
                    negative_prompt: "blurry, dark, low quality, deformed, text, watermark, bad architecture",
                    guidance_scale: 7.5,
                    num_inference_steps: MAX_INFERENCE_STEPS
                }
            });

            const buffer = Buffer.from(await blob.arrayBuffer());
            return {
                success: true,
                image: buffer,
                prompt: fullPrompt,
                style,
                model: DEFAULT_MODEL,
            };
        } catch (err) {
            console.error('HuggingFace SDK renovation error:', err.message);
            return this._getMockRenovation(style);
        }
    }

    _buildArchPrompt(basePrompt, style, viewAngle = 'front') {
        const styleModifiers = {
            modern: 'modern contemporary architecture, clean lines, large windows, minimalist facade, flat roof',
            minimalist: 'minimalist architecture, simple geometric forms, white walls, open space, zen garden',
            luxury: 'luxury mansion architecture, grand entrance, marble columns, premium materials, infinity pool',
            industrial: 'industrial architecture, exposed brick, steel beams, large factory windows, concrete',
            traditional: 'traditional architecture, pitched roof, stone walls, wooden details, garden',
            futuristic: 'futuristic architecture, parametric design, glass facade, sustainable features, green roof',
            mediterranean: 'mediterranean architecture, terracotta roof, stucco walls, arched windows, courtyard',
            colonial: 'colonial architecture, symmetrical design, columns, shuttered windows, brick exterior',
        };

        // CRITICAL: These view modifiers are the PRIMARY instruction to the image model.
        // They MUST be authoritative and override any conflicting language in the base prompt.
        const viewModifiers = {
            front: 'CAMERA POSITION: standing directly in front of the building, facing the main entrance and front facade. Eye-level medium shot. The front door, main windows, and primary facade are clearly visible. Front driveway and entrance path visible.',

            left: 'CAMERA POSITION: standing to the LEFT side of the building, facing the left wall perpendicularly. The camera is positioned at a 90-degree angle from the front entrance. We see the LEFT SIDE WALL of the building — side windows, side features, the depth of the building receding away from camera. The front entrance is NOT visible. This is a SIDE ELEVATION showing the building profile from the left.',

            right: 'CAMERA POSITION: standing to the RIGHT side of the building, facing the right wall perpendicularly. The camera is positioned at a 90-degree angle from the front entrance on the opposite side. We see the RIGHT SIDE WALL of the building — side windows, side features, the depth of the building receding away from camera. The front entrance is NOT visible. This is a SIDE ELEVATION showing the building profile from the right.',

            rear: 'CAMERA POSITION: standing directly BEHIND the building, facing the BACK wall and rear facade. We see the BACK of the building — rear entrance, back porch or patio, utility areas, rear windows, garden. The front entrance and front facade are completely hidden on the other side. This is the REAR ELEVATION showing the backyard-facing side.',

            aerial: 'CAMERA POSITION: drone hovering directly ABOVE the building, looking straight DOWN at a 70-degree angle. Bird\'s eye aerial view showing the complete ROOF layout, building footprint shape from above, surrounding landscape, driveway, garden. We see roof tiles, skylights, chimneys from above. NOT a front view — this is an OVERHEAD perspective.',
        };

        const styleMod = styleModifiers[style] || styleModifiers.modern;
        const viewMod = viewModifiers[viewAngle] || viewModifiers.front;

        // Adapt the base prompt to remove any conflicting view language
        const adaptedPrompt = this._adaptPromptForView(basePrompt, viewAngle);

        // View modifier goes FIRST to establish camera position as the top priority
        return `${viewMod}. professional architectural rendering, ${styleMod}, ${adaptedPrompt}, photorealistic, 8k quality, golden hour lighting, landscape architecture, architectural photography`;
    }

    /**
     * Strips front-view-locked language from a structural prompt and 
     * injects view-specific feature descriptions.
     */
    _adaptPromptForView(prompt, viewAngle) {
        if (!prompt || viewAngle === 'front') return prompt;

        // Remove any language that locks the prompt to the front view
        let adapted = prompt
            .replace(/front\s*(elevation|view|facade|facing|of\s+building)/gi, 'building')
            .replace(/facing\s+the\s+camera/gi, '')
            .replace(/straight[- ]on\s*(view|shot|facade)?/gi, '')
            .replace(/main\s+entrance\s+visible/gi, '')
            .replace(/front\s+door/gi, 'entrance')
            .replace(/camera\s+(facing|pointing|directed)\s+(at|toward)\s+the\s+front/gi, '')
            .replace(/16:9\s+landscape\s+format/gi, '')
            .replace(/medium\s+shot\s+showing\s+the\s+full\s+building/gi, '');

        // Add view-specific feature emphasis
        const viewFeatures = {
            left: 'Emphasize the left side wall depth, side windows, downspouts and gutters, side yard, and the building profile showing its depth from left to right.',
            right: 'Emphasize the right side wall depth, side windows, exterior utilities, side yard, and the building profile showing its depth from right to left.',
            rear: 'Emphasize the back porch, rear patio, back door, kitchen windows, utility connections, laundry area, rear garden, and backyard landscaping.',
            aerial: 'Emphasize the complete roof structure from above, roofing tiles and materials, chimney placement, skylight positions, building footprint, driveway layout, surrounding trees and landscaping from overhead.',
        };

        if (viewFeatures[viewAngle]) {
            adapted += ' ' + viewFeatures[viewAngle];
        }

        return adapted;
    }

    _buildRenovationPrompt(style, additionalPrompt) {
        const renovationStyles = {
            modern: 'modern interior design, clean lines, neutral colors, contemporary furniture, LED lighting',
            minimalist: 'minimalist interior, white walls, simple furniture, open space, natural light',
            luxury: 'luxury interior design, marble floors, crystal chandelier, premium furniture, gold accents',
            industrial: 'industrial interior, exposed brick, metal fixtures, Edison bulbs, concrete floors',
            traditional: 'traditional interior design, warm wood tones, classic furniture, ornate details, elegant drapery',
        };

        const styleMod = renovationStyles[style] || renovationStyles.modern;
        return `interior design renovation, ${styleMod}, ${additionalPrompt}, professional interior photography, well-lit room, high resolution`;
    }

    _getMockDesign(style) {
        return {
            success: true,
            image: null,
            mockUrl: `https://placehold.co/768x512/1a1a2e/00d4ff?text=${style}+Design`,
            prompt: `Mock ${style} design`,
            model: 'mock',
            isMock: true,
        };
    }

    _getMockRenovation(style) {
        return {
            success: true,
            image: null,
            mockUrl: `https://placehold.co/768x512/1a1a2e/ff6b35?text=${style}+Renovation`,
            prompt: `Mock ${style} renovation`,
            style,
            isMock: true,
        };
    }
}

module.exports = new HuggingFaceService();
