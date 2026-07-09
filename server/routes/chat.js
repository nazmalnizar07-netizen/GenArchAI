const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const groqService = require('../services/groq');
const { db, isConfigured } = require('../services/firebase');

// In-memory chat storage (fallback)
const chatStore = new Map();

// Track if Firestore is available
let dbAvailable = isConfigured;

async function tryFirestore(fn) {
    if (!dbAvailable) return null;
    try {
        return await fn();
    } catch (err) {
        console.warn('Firestore chat query failed, falling back to in-memory:', err.message);
        dbAvailable = false;
        return null;
    }
}

router.post('/', async (req, res) => {
    try {
        const { message, projectId = 'default', context = {} } = req.body;
        let history = [];

        // Load recent history from Firestore subcollection (last 20 messages for AI context)
        const dbHistory = await tryFirestore(async () => {
            const snapshot = await db.collection('chat_history').doc(projectId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();
            // Map only role and content to avoid Groq API errors with extra fields like timestamp
            return snapshot.docs.map(d => ({
                role: d.data().role,
                content: d.data().content
            })).reverse(); // oldest first
        });

        history = dbHistory !== null ? dbHistory : (chatStore.get(projectId) || []);

        // Add user message
        const userMsg = { role: 'user', content: message };
        history.push(userMsg);

        // Strictly sanitize history to remove timestamps, etc. (Groq API strictly requires only role and content)
        const safeHistory = history.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Get AI response
        const result = await groqService.chat(safeHistory, context);

        // Add assistant response
        const assistantMsg = { role: 'assistant', content: result.message };
        history.push(assistantMsg);

        // Save both messages to Firestore subcollection
        await tryFirestore(async () => {
            const batch = db.batch();
            const colRef = db.collection('chat_history').doc(projectId).collection('messages');

            const userDoc = colRef.doc();
            batch.set(userDoc, { ...userMsg, timestamp: new Date().toISOString() });

            const assistantDoc = colRef.doc();
            batch.set(assistantDoc, { ...assistantMsg, timestamp: new Date().toISOString() });

            // Update parent doc with context metadata
            batch.set(db.collection('chat_history').doc(projectId), {
                context,
                updated_at: new Date().toISOString(),
                message_count: (history.length || 0),
            }, { merge: true });

            await batch.commit();
            return true;
        });

        // Keep only last 50 in memory
        if (history.length > 50) history = history.slice(-50);
        chatStore.set(projectId, history);

        res.json({
            success: true,
            response: result.message,
            model: result.model,
            isMock: result.isMock || false,
        });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

// Generate brochure copy
router.post('/brochure', async (req, res) => {
    try {
        const { style, area, floors, views } = req.body;
        const viewList = Array.isArray(views) ? views.join(', ') : 'Front View';

        let prompt = `You are GenArchAI, a premium architectural copywriter. Write compelling brochure descriptions for each of these architectural views: ${viewList}.
Project Details: ${style} style, ${area} sq ft, ${floors} floors.
For EACH view, provide:
1. "summary": One engaging sentence describing the overall impression of this view.
2. "points": An array of exactly 3 short bullet points highlighting specific architectural features visible from this angle (materials, lines, proportions, landscape integration, etc.)
IMPORTANT: Return ONLY a valid JSON object where keys are the view names in lowercase (e.g. 'front view', 'rear view', 'aerial') and values are objects with "summary" (string) and "points" (array of 3 strings). Do not include markdown codeblocks or any other text.`;

        const messages = [{ role: 'user', content: prompt }];
        const result = await groqService.chat(messages, {});

        // Try to parse JSON
        let text = result.message.trim();
        if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        if (text.startsWith('```')) text = text.replace(/```/g, '').trim();

        let copyData;
        try {
            copyData = JSON.parse(text);
        } catch (e) {
            // Fallback mock if JSON parsing fails due to Groq hallucinations
            console.error('Failed to parse Groq response to JSON for brochure:', text);
            copyData = {};
            if (Array.isArray(views)) {
                views.forEach(v => {
                    copyData[v.toLowerCase()] = {
                        summary: `This stunning ${v} highlights the signature ${style} elements, showcasing seamless integration with the surrounding landscape.`,
                        points: [
                            'Clean geometric lines define the structural silhouette',
                            'Premium material palette enhances visual depth',
                            'Thoughtful fenestration balances light and privacy'
                        ]
                    };
                });
            }
        }

        res.json({ success: true, brochureText: copyData });
    } catch (err) {
        console.error('Brochure error:', err);
        res.status(500).json({ error: 'Failed to generate brochure text' });
    }
});

// Get chat history
router.get('/:projectId', async (req, res) => {
    try {
        const dbHistory = await tryFirestore(async () => {
            const snapshot = await db.collection('chat_history').doc(req.params.projectId)
                .collection('messages')
                .orderBy('timestamp', 'asc')
                .limit(50)
                .get();
            return snapshot.docs.map(d => ({ role: d.data().role, content: d.data().content }));
        });

        if (dbHistory !== null) {
            return res.json({ success: true, messages: dbHistory });
        }

        const history = chatStore.get(req.params.projectId) || [];
        res.json({ success: true, messages: history });
    } catch (err) {
        res.json({ success: true, messages: [] });
    }
});

// Clear chat history
router.delete('/:projectId', async (req, res) => {
    try {
        await tryFirestore(async () => {
            await db.collection('chat_history').doc(req.params.projectId).delete();
            return true;
        });

        chatStore.delete(req.params.projectId);
        res.json({ success: true, message: 'Chat history cleared' });
    } catch (err) {
        res.json({ success: true, message: 'Chat history cleared' });
    }
});

module.exports = router;
