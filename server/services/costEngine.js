/**
 * Cost Estimation Engine — Indian Construction Market (2024-2026)
 * 
 * All costs are in Indian Rupees (₹).
 * Rates are calibrated to real Indian residential construction costs.
 * 
 * Reference: CPWD rates, Indian construction industry averages
 * - Economy (basic): ₹1,000–₹1,400/sqft
 * - Standard (good quality): ₹1,400–₹1,800/sqft
 * - Premium (high-end): ₹1,800–₹2,400/sqft
 * - Luxury (imported materials, architect-designed): ₹2,400–₹3,500/sqft
 */

// Base cost per sq ft by quality level (INR ₹)
// These are "all-inclusive" rates per sqft of built-up area
const BASE_RATES = {
    economy: { min: 1000, max: 1400 },
    standard: { min: 1400, max: 1800 },
    premium: { min: 1800, max: 2400 },
    luxury: { min: 2400, max: 3500 },
};

// Location cost multipliers (Indian cities/regions)
const LOCATION_MULTIPLIERS = {
    rural: 0.80,   // Villages, tier-3 towns
    suburban: 0.90,   // Outskirts of cities
    urban: 1.00,   // Tier-2 cities, standard
    metro: 1.15,   // Bangalore, Hyderabad, Pune, Chennai
    downtown: 1.25,   // Mumbai, Delhi central areas
    coastal: 1.10,   // Goa, Kochi, coastal Karnataka
    mountain: 1.12,   // Hill stations, difficult terrain
};

// Cost breakdown percentages (sum = 1.0, material portion only)
const BREAKDOWN_PERCENTAGES = {
    foundation: 0.12,
    structure: 0.22,
    roofing: 0.07,
    electrical: 0.08,
    plumbing: 0.08,
    flooring: 0.08,
    painting: 0.05,
    doors_windows: 0.08,
    kitchen: 0.05,
    bathroom: 0.05,
    exterior: 0.06,
    landscaping: 0.03,
    permits: 0.03,
};

// Labor cost as a percentage of material cost
const LABOR_RATES = {
    economy: 0.30,
    standard: 0.35,
    premium: 0.38,
    luxury: 0.42,
};

// Style multipliers (how much a style inflates/reduces cost vs. "traditional")
const STYLE_MULTIPLIERS = {
    modern: 1.05,
    minimalist: 0.95,
    luxury: 1.30,
    industrial: 1.02,
    traditional: 1.00,
    futuristic: 1.20,
    mediterranean: 1.10,
    colonial: 1.08,
};

class CostEngine {

    /**
     * Estimate total construction cost.
     * 
     * IMPORTANT: `area` = built-up area PER FLOOR.
     * totalArea = area × floors gives the total built-up area.
     * The base rate already accounts for single-story cost.
     * Multi-story adds a small structural premium (5% per additional floor),
     * but does NOT re-multiply the base rate.
     */
    estimate({ area = 1000, floors = 1, rooms = 3, qualityLevel = 'standard', location = 'urban', style = 'modern', budget = 0 }) {
        const locationMult = LOCATION_MULTIPLIERS[location] || 1.0;
        const styleMult = STYLE_MULTIPLIERS[style] || 1.0;

        // Total built-up area across all floors
        const totalArea = area * floors;

        // Multi-story structural premium: 5% extra per additional floor
        // (upper floors need stronger columns, more reinforcement)
        const floorPremium = 1 + (Math.max(0, floors - 1) * 0.05);

        // Room complexity: very minor factor (2% per room beyond 3)
        const roomFactor = 1 + Math.max(0, rooms - 3) * 0.02;

        // Cap the combined multiplier to prevent runaway inflation
        const combinedMult = Math.min(locationMult * styleMult * floorPremium * roomFactor, 1.6);

        // ── Budget-aware quality selection ──
        // When a budget is provided, determine the best quality level that fits
        // instead of blindly using the user-selected quality level.
        let effectiveQuality = qualityLevel;
        const parsedBudget = Number(budget);

        if (parsedBudget > 0 && totalArea > 0) {
            // Work backward: what rate per sqft does the budget allow?
            // totalCost ≈ totalArea × avgRate × combinedMult × 1.08 (contingency) × (1 + laborRate)
            // Solve for avgRate: avgRate = budget / (totalArea × combinedMult × 1.08 × 1.35)
            const approxLaborMult = 1 + (LABOR_RATES[qualityLevel] || 0.35);
            const affordableRate = parsedBudget / (totalArea * combinedMult * 1.08 * approxLaborMult);

            // Pick the highest quality level the budget can support
            const qualityOrder = ['economy', 'standard', 'premium', 'luxury'];
            let bestFit = 'economy';
            for (const q of qualityOrder) {
                const r = BASE_RATES[q];
                const avg = (r.min + r.max) / 2;
                if (avg <= affordableRate) {
                    bestFit = q;
                }
            }
            effectiveQuality = bestFit;
        }

        const baseRate = BASE_RATES[effectiveQuality] || BASE_RATES.standard;
        const avgRate = (baseRate.min + baseRate.max) / 2;

        // Material cost = totalArea × rate × combined multiplier
        const rawMaterialCost = totalArea * avgRate * combinedMult;

        // Calculate breakdown from material cost
        const breakdown = {};
        let materialTotal = 0;
        for (const [key, pct] of Object.entries(BREAKDOWN_PERCENTAGES)) {
            breakdown[key] = Math.round(rawMaterialCost * pct);
            materialTotal += breakdown[key];
        }

        // Contingency (8% of material cost)
        breakdown['contingency'] = Math.round(materialTotal * 0.08);
        materialTotal += breakdown['contingency'];

        // Labor
        const laborRate = LABOR_RATES[effectiveQuality] || 0.35;
        const laborCost = Math.round(materialTotal * laborRate);
        breakdown.labor = laborCost;

        let totalCost = materialTotal + laborCost;

        // ── Final budget cap ──
        // If budget is provided and estimate still exceeds it (e.g. even economy
        // is too expensive for the area), scale down proportionally so the user
        // sees a realistic estimate within their stated budget.
        let budgetScaled = false;
        if (parsedBudget > 0 && totalCost > parsedBudget) {
            const scaleFactor = parsedBudget / totalCost;
            for (const key of Object.keys(breakdown)) {
                breakdown[key] = Math.round(breakdown[key] * scaleFactor);
            }
            materialTotal = Math.round(materialTotal * scaleFactor);
            const scaledLabor = Math.round(laborCost * scaleFactor);
            breakdown.labor = scaledLabor;
            totalCost = parsedBudget;
            budgetScaled = true;
        }

        return {
            totalCost,
            materialCost: materialTotal,
            laborCost: breakdown.labor,
            breakdown,
            ratePerSqFt: Math.round(totalCost / totalArea),
            inputs: { area, floors, rooms, qualityLevel: effectiveQuality, location, style, budget: parsedBudget || 0 },
            budgetScaled,
        };
    }

    /**
     * Generate design scores
     */
    scoreDesign({ budget, qualityLevel = 'standard', style = 'modern', area = 1000, floors = 1, rooms = 3, estimatedCost, location = 'urban' }) {
        // Budget score: smooth sigmoid curve
        let budgetScore = 100;
        if (estimatedCost && budget) {
            const ratio = estimatedCost / budget;
            if (ratio <= 1) {
                budgetScore = Math.round(85 + (1 - ratio) * 15);
            } else {
                budgetScore = Math.round(85 / (1 + Math.exp(3 * (ratio - 1.3))));
                budgetScore = Math.max(5, budgetScore);
            }
        }

        // Luxury score
        const luxuryScores = { economy: 25, standard: 50, premium: 75, luxury: 95 };
        const luxuryScore = luxuryScores[qualityLevel] || 50;

        // Sustainability score
        const styleSustainability = { minimalist: 30, futuristic: 35, modern: 15, traditional: 0, industrial: -5, luxury: -15 };
        const locationSustainability = { rural: 10, mountain: 8, coastal: 5, suburban: 0, urban: -5, metro: -8, downtown: -10 };
        let sustainabilityScore = 50
            + (styleSustainability[style] || 0)
            + (locationSustainability[location] || 0);

        // Space efficiency
        const sqFtPerRoom = area / rooms;
        const optimalSqFt = 300;
        const efficiencyScore = Math.round(100 - Math.min(55, Math.abs(sqFtPerRoom - optimalSqFt) * 0.25));

        return {
            budget: Math.min(100, Math.max(0, budgetScore)),
            luxury: Math.min(100, Math.max(0, luxuryScore)),
            sustainability: Math.min(100, Math.max(0, sustainabilityScore)),
            spaceEfficiency: Math.min(100, Math.max(0, efficiencyScore)),
        };
    }

    /**
     * Budget optimization suggestions (INR-aware)
     */
    optimizeBudget(currentEstimate, targetBudget) {
        const suggestions = [];
        const diff = currentEstimate.totalCost - targetBudget;

        if (diff <= 0) {
            suggestions.push('✅ Your design is within budget! You have ₹' + Math.abs(diff).toLocaleString('en-IN') + ' remaining.');
            return { suggestions, optimizedCost: currentEstimate.totalCost, savings: 0 };
        }

        const savingsItems = [];

        // Location-based savings
        if (currentEstimate.inputs.location === 'metro' || currentEstimate.inputs.location === 'downtown') {
            savingsItems.push({
                text: '📍 Consider suburban area — labor & materials cost 15-25% less outside metro',
                savings: currentEstimate.totalCost * 0.18,
            });
        }

        // Quality level reduction
        if (currentEstimate.inputs.qualityLevel === 'luxury') {
            savingsItems.push({
                text: '🔧 Switch from luxury to premium finishes — save 25-35% while maintaining quality',
                savings: currentEstimate.totalCost * 0.30,
            });
        } else if (currentEstimate.inputs.qualityLevel === 'premium') {
            savingsItems.push({
                text: '🔧 Use standard materials with premium accents in key areas — save 15-25%',
                savings: currentEstimate.totalCost * 0.20,
            });
        }

        // Floor reduction
        if (currentEstimate.inputs.floors > 1) {
            savingsItems.push({
                text: `🏢 Reduce from ${currentEstimate.inputs.floors} to ${currentEstimate.inputs.floors - 1} floors — save 15-20%`,
                savings: currentEstimate.totalCost * 0.17,
            });
        }

        // Area reduction
        savingsItems.push({
            text: '📐 Reduce area by 10% with efficient space planning — save proportionally',
            savings: currentEstimate.totalCost * 0.10,
        });

        // Prefab components
        savingsItems.push({
            text: '🏭 Use prefabricated components for walls and roofing — save 10-15%',
            savings: currentEstimate.totalCost * 0.12,
        });

        // Phase construction
        savingsItems.push({
            text: '📅 Phase construction over 2-3 stages to manage cash flow better',
            savings: 0,
        });

        // Alternative design styles
        if (currentEstimate.inputs.style === 'luxury' || currentEstimate.inputs.style === 'futuristic') {
            savingsItems.push({
                text: '🎨 Switch to modern or minimalist style — simpler designs cost 15-25% less',
                savings: currentEstimate.totalCost * 0.18,
            });
        }

        // Sort by savings descending
        savingsItems.sort((a, b) => b.savings - a.savings);

        let cumulativeSavings = 0;
        for (const item of savingsItems) {
            suggestions.push(item.text + (item.savings > 0 ? ` (~₹${Math.round(item.savings).toLocaleString('en-IN')})` : ''));
            cumulativeSavings += item.savings;
        }

        return {
            suggestions,
            optimizedCost: Math.max(targetBudget, currentEstimate.totalCost - cumulativeSavings),
            savings: Math.min(diff, cumulativeSavings),
            targetBudget,
            currentCost: currentEstimate.totalCost,
            gap: diff,
        };
    }

    /**
     * Compare two designs
     */
    compareDesigns(design1, design2) {
        return {
            design1: {
                label: design1.label || 'Design A',
                cost: design1.costEstimate?.total || 0,
                scores: design1.scores || {},
                style: design1.style,
            },
            design2: {
                label: design2.label || 'Design B',
                cost: design2.costEstimate?.total || 0,
                scores: design2.scores || {},
                style: design2.style,
            },
            comparison: {
                costDifference: Math.abs((design1.costEstimate?.total || 0) - (design2.costEstimate?.total || 0)),
                cheaper: (design1.costEstimate?.total || 0) <= (design2.costEstimate?.total || 0) ? 'Design A' : 'Design B',
                moreEfficient: (design1.scores?.spaceEfficiency || 0) >= (design2.scores?.spaceEfficiency || 0) ? 'Design A' : 'Design B',
                moreSustainable: (design1.scores?.sustainability || 0) >= (design2.scores?.sustainability || 0) ? 'Design A' : 'Design B',
                moreLuxurious: (design1.scores?.luxury || 0) >= (design2.scores?.luxury || 0) ? 'Design A' : 'Design B',
            }
        };
    }

    /**
     * Format INR amount in Indian notation (lakhs/crores).
     * e.g., 8000000 → "₹80,00,000" or "80 Lakhs"
     */
    static formatINR(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);
    }

    /**
     * Format INR in human-readable short form.
     * e.g., 8000000 → "₹80L", 15000000 → "₹1.5Cr"
     */
    static formatINRShort(amount) {
        if (!amount) return '₹0';
        if (amount >= 10000000) {
            return '₹' + (amount / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
        } else if (amount >= 100000) {
            return '₹' + (amount / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
        } else if (amount >= 1000) {
            return '₹' + (amount / 1000).toFixed(0) + 'K';
        }
        return '₹' + amount;
    }
}

module.exports = new CostEngine();
