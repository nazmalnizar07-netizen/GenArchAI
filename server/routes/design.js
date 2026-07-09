const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const huggingface = require('../services/huggingface');
const cloudinaryService = require('../services/cloudinary');
const costEngine = require('../services/costEngine');
const imageProcessor = require('../utils/imageProcessor');
const { db, isConfigured } = require('../services/firebase');

// Store uploaded files in memory (10MB max, same as renovation route)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Quick cost estimate (used by PDF brochure as fallback)
router.post('/estimate', async (req, res) => {
    try {
        const { area = 1000, floors = 1, rooms = 3, qualityLevel = 'standard', style = 'modern', location = 'urban', budget = 0 } = req.body;
        const result = costEngine.estimate({ area: Number(area), floors: Number(floors), rooms: Number(rooms), qualityLevel, location, style, budget: Number(budget) });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: 'Estimation failed' });
    }
});

// Generate design from text/prompt + optional sketch
router.post('/generate-design', upload.single('image'), async (req, res) => {
    try {
        const { prompt, style = 'modern', area, floors, rooms, qualityLevel, budget, projectId, viewAngle = 'front' } = req.body;
        const sketchBuffer = req.file ? req.file.buffer : null;
        const io = req.app.get('io');

        // Notify clients generation started (project-scoped)
        if (io && projectId) io.to(`project-${projectId}`).emit('generation-status', { status: 'generating', message: 'Creating your architectural design...' });
        else if (io) io.emit('generation-status', { status: 'generating', message: 'Creating your architectural design...' });

        const startTime = Date.now();

        // Upload sketch to Cloudinary if provided (with timeout/fallback handling)
        let sketchUrl = null;
        if (sketchBuffer) {
            try {
                const sketchUpload = await cloudinaryService.upload(sketchBuffer, 'genarchai/sketches');
                sketchUrl = sketchUpload.url;
            } catch (uploadErr) {
                console.warn('Sketch upload failed, will proceed without sketch URL:', uploadErr.message);
                sketchUrl = null; // Continue without sketch URL
            }
        }

        // Generate design image with view angle
        const result = await huggingface.generateDesign(
            prompt || `${style} building, ${floors || 1} floors, ${area || 1000} sq ft`,
            style,
            sketchBuffer,
            viewAngle
        );

        let imageUrl;
        if (result.image) {
            // Compress generated image before uploading (saves bandwidth & storage)
            const compressed = await imageProcessor.compress(result.image, { width: 1024, height: 1024, quality: 85 });
            try {
                const uploaded = await cloudinaryService.upload(compressed, 'genarchai/designs');
                imageUrl = uploaded.url;
            } catch (uploadErr) {
                console.warn('Cloudinary upload failed, falling back to local storage:', uploadErr.message);
                // Fallback to local storage on Cloudinary timeout
                const localUpload = await cloudinaryService._saveLocal(compressed);
                imageUrl = localUpload.url;
            }
        } else {
            imageUrl = result.mockUrl;
        }

        // Calculate cost estimate
        const costEstimate = costEngine.estimate({
            area: Number(area) || 1000,
            floors: Number(floors) || 1,
            rooms: Number(rooms) || 3,
            qualityLevel: qualityLevel || 'standard',
            style,
            budget: Number(budget) || 0,
        });

        const parsedBudget = Number(budget);
        let effectiveBudget = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : undefined;
        if (!effectiveBudget && projectId && isConfigured && db) {
            try {
                const projectDoc = await db.collection('projects').doc(projectId).get();
                if (projectDoc.exists) {
                    const projectInfo = projectDoc.data();
                    const projectBudget = Number(projectInfo?.budget);
                    if (Number.isFinite(projectBudget) && projectBudget > 0) {
                        effectiveBudget = projectBudget;
                    }
                }
            } catch (err) {
                console.warn('Failed to resolve project budget:', err.message);
            }
        }
        effectiveBudget = effectiveBudget || 5000000;

        // Calculate design scores
        const scores = costEngine.scoreDesign({
            budget: effectiveBudget,
            qualityLevel: qualityLevel || 'standard',
            style,
            area: area || 1000,
            floors: floors || 1,
            rooms: rooms || 3,
            estimatedCost: costEstimate.totalCost,
        });

        const generationTime = Date.now() - startTime;

        // Create a plan_id to group multiple views together
        const planId = uuidv4();

        const designData = {
            imageUrl,
            sketchUrl,
            viewAngle,
            planId,
            prompt: result.prompt,
            structuralPrompt: result.structuralPrompt || null, // Cache the Gemini/Gemma vision output
            style,
            scores,
            costEstimate: {
                total: costEstimate.totalCost,
                materials: costEstimate.materialCost,
                labor: costEstimate.laborCost,
            },
            breakdown: costEstimate.breakdown,
            metadata: {
                model: result.model,
                generationTime,
                isMock: result.isMock || false,
            },
        };

        // Save to Firestore if projectId is provided
        if (projectId) {
            const designId = Date.now().toString();
            const newDesign = {
                id: designId,
                project_id: projectId,
                plan_id: planId,
                image_url: imageUrl,
                sketch_url: sketchUrl,
                view_angle: viewAngle,
                prompt: result.prompt,
                structural_prompt: result.structuralPrompt || null, // Cache for reuse by other views
                original_prompt: prompt || '',
                style,
                area: Number(area || 1000),
                floors: Number(floors || 1),
                rooms: Number(rooms || 3),
                budget: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : effectiveBudget,
                quality_level: qualityLevel || 'standard',
                cost_estimate: designData.costEstimate,
                breakdown: designData.breakdown,
                scores: designData.scores,
                metadata: designData.metadata,
                type: 'design',
                created_at: new Date().toISOString()
            };

            let savedToDb = false;
            try {
                if (isConfigured && db) {
                    await db.collection('designs').doc(designId).set(newDesign);
                    savedToDb = true;

                    // Update project thumbnail with first design
                    try {
                        const projRef = db.collection('projects').doc(projectId);
                        const projDoc = await projRef.get();
                        if (projDoc.exists) {
                            const projData = projDoc.data();
                            if (!projData.thumbnail || projData.thumbnail.includes('placehold.co')) {
                                await projRef.update({ thumbnail: imageUrl });
                            }
                        }
                    } catch (thumbErr) {
                        console.warn('Failed to update project thumbnail:', thumbErr.message);
                    }
                }
            } catch (dbErr) {
                console.error("Failed to save design to Firestore:", dbErr.message);
            }
            if (!savedToDb) {
                global.memoryDesigns = global.memoryDesigns || [];
                global.memoryDesigns.push(newDesign);
            }
        }

        if (io && projectId) io.to(`project-${projectId}`).emit('generation-status', { status: 'complete', message: 'Design generated!' });
        else if (io) io.emit('generation-status', { status: 'complete', message: 'Design generated!' });

        res.json({ success: true, design: designData });
    } catch (err) {
        console.error('Design generation error:', err);
        res.status(500).json({ error: 'Failed to generate design' });
    }
});

// Generate additional view for an existing plan
router.post('/generate-view', async (req, res) => {
    try {
        const { planId, projectId, viewAngle, prompt, style, area, floors, rooms, qualityLevel, budget, sketchUrl } = req.body;
        const io = req.app.get('io');

        if (!viewAngle) return res.status(400).json({ error: 'viewAngle is required' });

        if (io && projectId) io.to(`project-${projectId}`).emit('generation-status', { status: 'generating', message: `Generating ${viewAngle} view...` });
        else if (io) io.emit('generation-status', { status: 'generating', message: `Generating ${viewAngle} view...` });

        const startTime = Date.now();

        // ─── Reuse the structural prompt from the original plan ───
        // This completely skips the Gemini/Gemma vision API call!
        let cachedStructuralPrompt = null;
        if (planId) {
            try {
                // Check Firestore first
                if (isConfigured && db) {
                    const snapshot = await db.collection('designs')
                        .where('plan_id', '==', planId)
                        .limit(1)
                        .get();
                    if (!snapshot.empty) {
                        cachedStructuralPrompt = snapshot.docs[0].data().structural_prompt;
                    }
                }
                // Fall back to memory store
                if (!cachedStructuralPrompt) {
                    const memView = (global.memoryDesigns || []).find(d => d.plan_id === planId);
                    if (memView) cachedStructuralPrompt = memView.structural_prompt;
                }
                if (cachedStructuralPrompt) {
                    console.log('Reusing cached structural prompt — skipping vision API call!');
                }
            } catch (lookupErr) {
                console.warn('Could not look up cached structural prompt:', lookupErr.message);
            }
        }

        // Generate design image — use cachedStructuralPrompt if available
        const effectivePrompt = cachedStructuralPrompt || prompt || `${style} building, ${floors || 1} floors, ${area || 1000} sq ft`;
        console.log(`Generating ${viewAngle} view. Prompt source: ${cachedStructuralPrompt ? 'cached structural' : 'user prompt'}. Prompt length: ${effectivePrompt.length} chars`);
        const result = await huggingface.generateDesign(
            effectivePrompt,
            style,
            null,  // No sketch buffer for additional views
            viewAngle
        );

        let imageUrl;
        if (result.image) {
            const compressed = await imageProcessor.compress(result.image, { width: 1024, height: 1024, quality: 85 });
            try {
                const uploaded = await cloudinaryService.upload(compressed, 'genarchai/designs');
                imageUrl = uploaded.url;
            } catch (uploadErr) {
                console.warn('Cloudinary upload failed for view, falling back to local storage:', uploadErr.message);
                const localUpload = await cloudinaryService._saveLocal(compressed);
                imageUrl = localUpload.url;
            }
        } else {
            imageUrl = result.mockUrl;
        }

        const generationTime = Date.now() - startTime;

        const costEstimate = costEngine.estimate({
            area: Number(area) || 1000,
            floors: Number(floors) || 1,
            rooms: Number(rooms) || 3,
            qualityLevel: qualityLevel || 'standard',
            style: style || 'modern',
            budget: Number(budget) || 0,
        });

        const scores = costEngine.scoreDesign({
            budget: budget || 50000,
            qualityLevel: qualityLevel || 'standard',
            style: style || 'modern',
            area: area || 1000,
            floors: floors || 1,
            rooms: rooms || 3,
            estimatedCost: costEstimate.totalCost,
        });

        // Save to Firestore
        if (projectId) {
            const designId = Date.now().toString();
            const newDesign = {
                id: designId,
                project_id: projectId,
                plan_id: planId,
                image_url: imageUrl,
                sketch_url: sketchUrl || null,
                view_angle: viewAngle,
                prompt: result.prompt,
                original_prompt: prompt || '',
                style: style || 'modern',
                area: Number(area || 1000),
                floors: Number(floors || 1),
                rooms: Number(rooms || 3),
                budget: Number(budget || 5000000),
                quality_level: qualityLevel || 'standard',
                cost_estimate: {
                    total: costEstimate.totalCost,
                    materials: costEstimate.materialCost,
                    labor: costEstimate.laborCost,
                },
                scores,
                metadata: {
                    model: result.model,
                    generationTime,
                    isMock: result.isMock || false,
                },
                type: 'design',
                created_at: new Date().toISOString()
            };

            let savedToDb = false;
            try {
                if (isConfigured && db) {
                    await db.collection('designs').doc(designId).set(newDesign);
                    savedToDb = true;
                }
            } catch (dbErr) {
                console.error("Failed to save view to Firestore:", dbErr.message);
            }
            if (!savedToDb) {
                global.memoryDesigns = global.memoryDesigns || [];
                global.memoryDesigns.push(newDesign);
            }
        }

        if (io && projectId) io.to(`project-${projectId}`).emit('generation-status', { status: 'complete', message: `${viewAngle} view generated!` });
        else if (io) io.emit('generation-status', { status: 'complete', message: `${viewAngle} view generated!` });

        res.json({
            success: true,
            view: {
                imageUrl,
                viewAngle,
                planId,
                metadata: { model: result.model, generationTime, isMock: result.isMock || false },
            }
        });
    } catch (err) {
        console.error('View generation error:', err);
        res.status(500).json({ error: 'Failed to generate view' });
    }
});

// Get all views for a specific plan
router.get('/plan/:planId/views', async (req, res) => {
    try {
        let views = [];
        if (isConfigured && db) {
            const snapshot = await db.collection('designs')
                .where('plan_id', '==', req.params.planId)
                // Removed orderBy since missing index causes query to silently fail and return nothing
                .get();
            views = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort manually in memory
            views.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        // Also check memory
        const memViews = (global.memoryDesigns || []).filter(d => d.plan_id === req.params.planId);
        const allViews = [...views, ...memViews];

        res.json({ success: true, views: allViews });
    } catch (err) {
        console.error('Failed to get plan views:', err);
        res.json({ success: true, views: [] });
    }
});

// Apply style to existing design
router.post('/generate-style', async (req, res) => {
    try {
        const { prompt, style = 'modern', originalImageUrl } = req.body;

        const result = await huggingface.generateDesign(
            `${prompt || 'beautiful building'} in ${style} architectural style`,
            style
        );

        let imageUrl;
        if (result.image) {
            try {
                const uploaded = await cloudinaryService.upload(result.image, 'genarchai/styles');
                imageUrl = uploaded.url;
            } catch (uploadErr) {
                console.warn('Cloudinary upload failed for style, falling back to local storage:', uploadErr.message);
                const localUpload = await cloudinaryService._saveLocal(result.image);
                imageUrl = localUpload.url;
            }
        } else {
            imageUrl = result.mockUrl;
        }

        res.json({
            success: true,
            imageUrl,
            style,
            prompt: result.prompt,
            isMock: result.isMock || false,
        });
    } catch (err) {
        console.error('Style generation error:', err);
        res.status(500).json({ error: 'Failed to generate style' });
    }
});

// Get design by ID
router.get('/design/:id', async (req, res) => {
    try {
        if (isConfigured && db) {
            const doc = await db.collection('designs').doc(req.params.id).get();
            if (doc.exists) {
                return res.json({ success: true, design: { id: doc.id, ...doc.data() } });
            }
        }
        res.json({ success: true, design: { id: req.params.id, message: 'Design not found' } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get design' });
    }
});

// Compare two designs
router.post('/designs/compare', async (req, res) => {
    try {
        const { design1, design2 } = req.body;
        const comparison = costEngine.compareDesigns(design1, design2);
        res.json({ success: true, comparison });
    } catch (err) {
        res.status(500).json({ error: 'Failed to compare designs' });
    }
});

// Get all designs for a project
router.get('/designs', async (req, res) => {
    const { projectId } = req.query;
    try {
        let dbDesigns = [];
        if (isConfigured && db && projectId) {
            try {
                const snapshot = await db.collection('designs')
                    .where('project_id', '==', projectId)
                    .orderBy('created_at', 'desc')
                    .get();
                dbDesigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.error('Firestore designs query failed:', e.message);
            }
        }

        const memDesigns = (global.memoryDesigns || []).filter(d => String(d.project_id) === String(projectId));
        const allDesigns = [...dbDesigns, ...memDesigns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ success: true, designs: allDesigns });
    } catch (err) {
        console.error('Failed to get designs:', err);
        res.json({ success: true, designs: [] });
    }
});

// Toggle favorite on a design
router.post('/design/:id/favorite', async (req, res) => {
    try {
        const { id } = req.params;
        let design = null;

        if (isConfigured && db) {
            const doc = await db.collection('designs').doc(id).get();
            if (doc.exists) {
                const current = doc.data().favorite || false;
                await db.collection('designs').doc(id).update({ favorite: !current });
                return res.json({ success: true, favorite: !current });
            }
        }

        // Memory fallback
        const memDesign = (global.memoryDesigns || []).find(d => d.id === id);
        if (memDesign) {
            memDesign.favorite = !memDesign.favorite;
            return res.json({ success: true, favorite: memDesign.favorite });
        }

        res.status(404).json({ error: 'Design not found' });
    } catch (err) {
        console.error('Toggle favorite error:', err);
        res.status(500).json({ error: 'Failed to toggle favorite' });
    }
});

// AI-powered design critique — with model fallback and graceful error handling
router.post('/design/:id/critique', async (req, res) => {
    try {
        const { imageUrl, style, viewAngle } = req.body;

        if (!imageUrl) {
            return res.json({
                success: true,
                critique: {
                    scores: { aesthetics: 70, structural: 70, styleMatch: 70, overall: 70 },
                    feedback: ['No image URL provided for analysis.', 'Please generate a design first.', 'Then try critiquing again.'],
                    summary: 'No image available for critique.',
                },
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.json({
                success: true,
                critique: {
                    scores: { aesthetics: 75, structural: 70, styleMatch: 80, overall: 75 },
                    feedback: [
                        'AI critique unavailable \u2014 GEMINI_API_KEY not configured.',
                        'Add your API key to .env to enable vision-based critique.',
                        'Scores shown are placeholder values.'
                    ],
                    summary: 'Configure Gemini API key to enable AI-powered design critique.',
                },
            });
        }

        // Download the image for analysis
        const axios = require('axios');
        let imageBuffer;
        try {
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
            imageBuffer = Buffer.from(imgRes.data);
            console.log('Critique: Downloaded image (' + (imageBuffer.length / 1024).toFixed(0) + ' KB)');
        } catch (dlErr) {
            console.error('Critique image download failed:', dlErr.message);
            return res.json({
                success: true,
                critique: {
                    scores: { aesthetics: 72, structural: 68, styleMatch: 76, overall: 72 },
                    feedback: [
                        'Could not download the design image for analysis.',
                        'The image URL may have expired or be inaccessible.',
                        'Try regenerating the design and requesting critique again.'
                    ],
                    summary: 'Image download failed \u2014 showing estimated scores.',
                },
            });
        }

        const critiquePrompt = 'You are an expert architectural critic. Analyze this ' + (viewAngle || 'front') + ' view of a ' + (style || 'modern') + ' building design.\n\nRate the design from 0-100 on these criteria:\n1. AESTHETICS: Visual appeal, proportions, harmony\n2. STRUCTURAL: Plausibility of the structure, realistic features\n3. STYLE_MATCH: How well it matches the "' + (style || 'modern') + '" architectural style\n\nThen provide exactly 3 specific, actionable feedback points about what could be improved.\n\nRespond in this EXACT JSON format only, no other text:\n{"aesthetics":85,"structural":78,"styleMatch":90,"feedback":["Point 1","Point 2","Point 3"],"summary":"One sentence overall assessment"}';

        const imageParts = [{
            inlineData: { data: imageBuffer.toString('base64'), mimeType: 'image/jpeg' }
        }];

        // Try multiple models in fallback chain
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelsToTry = [
            process.env.VISION_MODEL || 'gemma-4-31b-it',
            'gemini-2.5-flash',
        ];

        let responseText = null;
        for (const modelName of modelsToTry) {
            try {
                console.log('Critique: Trying model ' + modelName + '...');
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([critiquePrompt, ...imageParts]);
                responseText = result.response.text().trim();
                console.log('Critique: ' + modelName + ' succeeded (' + responseText.length + ' chars)');
                break;
            } catch (modelErr) {
                console.error('Critique: ' + modelName + ' failed:', modelErr.message);
                continue;
            }
        }

        if (!responseText) {
            return res.json({
                success: true,
                critique: {
                    scores: { aesthetics: 74, structural: 70, styleMatch: 78, overall: 74 },
                    feedback: [
                        'AI vision models are currently unavailable.',
                        'This may be due to rate limits on the free tier.',
                        'Try again in a few minutes.'
                    ],
                    summary: 'Could not reach AI vision service \u2014 showing estimated scores.',
                },
            });
        }

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        let critique;
        if (jsonMatch) {
            try {
                critique = JSON.parse(jsonMatch[0]);
            } catch (e) {
                critique = {
                    aesthetics: 75, structural: 70, styleMatch: 75,
                    feedback: [responseText.slice(0, 200)],
                    summary: 'Could not parse structured critique.'
                };
            }
        } else {
            critique = {
                aesthetics: 75, structural: 70, styleMatch: 75,
                feedback: [responseText.slice(0, 200)],
                summary: 'Could not parse structured critique.'
            };
        }

        critique.overall = Math.round(
            ((critique.aesthetics || 0) + (critique.structural || 0) + (critique.styleMatch || 0)) / 3
        );

        res.json({
            success: true,
            critique: {
                scores: {
                    aesthetics: critique.aesthetics || 0,
                    structural: critique.structural || 0,
                    styleMatch: critique.styleMatch || 0,
                    overall: critique.overall || 0,
                },
                feedback: critique.feedback || [],
                summary: critique.summary || 'Analysis complete.'
            }
        });
    } catch (err) {
        console.error('AI Critique unexpected error:', err.message);
        res.json({
            success: true,
            critique: {
                scores: { aesthetics: 70, structural: 70, styleMatch: 70, overall: 70 },
                feedback: [
                    'An error occurred: ' + ((err.message || '').slice(0, 100)),
                    'Please try again later.',
                    'Scores shown are placeholder values.'
                ],
                summary: 'Analysis encountered an error \u2014 showing placeholder scores.',
            },
        });
    }
});

module.exports = router;
