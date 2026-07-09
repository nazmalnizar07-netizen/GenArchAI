const express = require('express');
const router = express.Router();
const costEngine = require('../services/costEngine');

// Estimate cost
router.post('/estimate-cost', async (req, res) => {
    try {
        const { area, floors, rooms, qualityLevel, location, style, budget } = req.body;

        const estimate = costEngine.estimate({
            area: Number(area) || 1000,
            floors: Number(floors) || 1,
            rooms: Number(rooms) || 3,
            qualityLevel: qualityLevel || 'standard',
            location: location || 'urban',
            style: style || 'modern',
            budget: Number(budget) || 0,
        });

        const scores = costEngine.scoreDesign({
            budget: req.body.budget || 50000,
            qualityLevel: qualityLevel || 'standard',
            style: style || 'modern',
            area: Number(area) || 1000,
            floors: Number(floors) || 1,
            rooms: Number(rooms) || 3,
            estimatedCost: estimate.totalCost,
        });

        res.json({
            success: true,
            estimate,
            scores,
        });
    } catch (err) {
        console.error('Cost estimation error:', err);
        res.status(500).json({ error: 'Failed to estimate cost' });
    }
});

// Optimize budget
router.post('/optimize-budget', async (req, res) => {
    try {
        const { area, floors, rooms, qualityLevel, location, style, targetBudget } = req.body;

        const estimate = costEngine.estimate({
            area: Number(area) || 1000,
            floors: Number(floors) || 1,
            rooms: Number(rooms) || 3,
            qualityLevel: qualityLevel || 'standard',
            location: location || 'urban',
            style: style || 'modern',
        });

        const optimization = costEngine.optimizeBudget(estimate, Number(targetBudget) || 50000);

        res.json({
            success: true,
            currentEstimate: estimate,
            optimization,
        });
    } catch (err) {
        console.error('Budget optimization error:', err);
        res.status(500).json({ error: 'Failed to optimize budget' });
    }
});

module.exports = router;
