const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, isConfigured } = require('../services/firebase');
const { normalizeProject } = require('../utils/dataNormalizer');

// In-memory fallback storage
const memoryStore = new Map();

// Track if Firestore is available
let dbAvailable = isConfigured;

// Helper: try Firestore, fall back to memory on any error
async function tryFirestore(fn) {
    if (!dbAvailable) return null;
    try {
        return await fn();
    } catch (err) {
        console.warn('Firestore query failed, falling back to in-memory:', err.message);
        dbAvailable = false;
        return null;
    }
}

// ─── GET all projects ─────────────────────────────────────
router.get('/projects', async (req, res) => {
    try {
        const result = await tryFirestore(async () => {
            const snapshot = await db.collection('projects')
                .orderBy('created_at', 'desc')
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });

        if (result !== null) {
            return res.json({ success: true, projects: result.map(normalizeProject) });
        }

        // In-memory fallback
        const projects = Array.from(memoryStore.values())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ success: true, projects });
    } catch (err) {
        console.error('Get projects error:', err);
        const projects = Array.from(memoryStore.values());
        res.json({ success: true, projects });
    }
});

// ─── CREATE project ───────────────────────────────────────
router.post('/projects', async (req, res) => {
    try {
        const projectId = uuidv4();
        const parsedBudget = Number(req.body.budget);
        const project = {
            id: projectId,
            name: req.body.name || 'Untitled Project',
            description: req.body.description || '',
            area: Number(req.body.area) || 1000,
            floors: Number(req.body.floors) || 1,
            rooms: Number(req.body.rooms) || 3,
            style: req.body.style || 'modern',
            budget: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 5000000,
            location: req.body.location || 'urban',
            quality_level: req.body.qualityLevel || req.body.quality_level || 'standard',
            thumbnail: req.body.thumbnail || `https://placehold.co/400x300/1a1a2e/00d4ff?text=${encodeURIComponent(req.body.name || 'New')}`,
            status: 'draft',
            created_at: new Date().toISOString(),
        };

        const result = await tryFirestore(async () => {
            await db.collection('projects').doc(projectId).set(project);
            return project;
        });

        if (result !== null) {
            return res.json({ success: true, project: result });
        }

        // In-memory fallback
        memoryStore.set(project.id, project);
        res.json({ success: true, project });
    } catch (err) {
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// ─── GET project by ID ───────────────────────────────────
router.get('/projects/:id', async (req, res) => {
    try {
        const result = await tryFirestore(async () => {
            const doc = await db.collection('projects').doc(req.params.id).get();
            if (!doc.exists) return undefined;
            return { id: doc.id, ...doc.data() };
        });

        if (result !== null) {
            if (!result) return res.status(404).json({ error: 'Project not found' });
            return res.json({ success: true, project: result });
        }

        const project = memoryStore.get(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, project });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get project' });
    }
});

// ─── UPDATE project ──────────────────────────────────────
router.put('/projects/:id', async (req, res) => {
    try {
        const result = await tryFirestore(async () => {
            const ref = db.collection('projects').doc(req.params.id);
            const doc = await ref.get();
            if (!doc.exists) return undefined;
            const updateData = { ...req.body, updated_at: new Date().toISOString() };
            await ref.update(updateData);
            const updated = await ref.get();
            return { id: updated.id, ...updated.data() };
        });

        if (result !== null) {
            if (!result) return res.status(404).json({ error: 'Project not found' });
            return res.json({ success: true, project: result });
        }

        const project = memoryStore.get(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        Object.assign(project, req.body, { updated_at: new Date().toISOString() });
        memoryStore.set(req.params.id, project);
        res.json({ success: true, project });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// ─── DELETE project ──────────────────────────────────────
router.delete('/projects/:id', async (req, res) => {
    try {
        const result = await tryFirestore(async () => {
            const ref = db.collection('projects').doc(req.params.id);
            const doc = await ref.get();
            if (!doc.exists) return undefined;
            await ref.delete();
            // Also delete related designs and chat history
            const designSnap = await db.collection('designs')
                .where('project_id', '==', req.params.id).get();
            const batch = db.batch();
            designSnap.docs.forEach(d => batch.delete(d.ref));
            const chatRef = db.collection('chat_history').doc(req.params.id);
            batch.delete(chatRef);
            await batch.commit();
            return true;
        });

        if (result !== null) {
            if (!result) return res.status(404).json({ error: 'Project not found' });
            return res.json({ success: true, message: 'Project deleted' });
        }

        if (!memoryStore.has(req.params.id)) {
            return res.status(404).json({ error: 'Project not found' });
        }
        memoryStore.delete(req.params.id);
        res.json({ success: true, message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

module.exports = router;
