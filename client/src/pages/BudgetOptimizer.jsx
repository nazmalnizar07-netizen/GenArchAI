import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlineLightningBolt, HiOutlineTrendingDown, HiOutlineCheckCircle } from 'react-icons/hi';
import toast from 'react-hot-toast';
import GlassCard from '../components/GlassCard';
import CostChart from '../components/CostChart';
import ScoreRadar from '../components/ScoreRadar';
import api from '../api/apiClient';
import './BudgetOptimizer.css';

export default function BudgetOptimizer({ project: propProject, embedded }) {
    const location = useLocation();
    const incoming = location.state || {};
    const projData = propProject || {};

    const [config, setConfig] = useState({
        area: incoming.config?.area || projData.area || 1500,
        floors: incoming.config?.floors || projData.floors || 2,
        rooms: incoming.config?.rooms || projData.rooms || 4,
        qualityLevel: incoming.config?.qualityLevel || projData.quality_level || 'standard',
        location: 'urban',
        style: incoming.config?.style || projData.style || 'modern',
        budget: incoming.config?.budget || projData.budget || 1500000,
    });

    const [estimate, setEstimate] = useState(null);
    const [scores, setScores] = useState(null);
    const [optimization, setOptimization] = useState(null);
    const [targetBudget, setTargetBudget] = useState(config.budget);
    const debounceTimer = useRef(null);

    // Debounced fetch — waits 500ms after last config change
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchEstimate();
        }, 500);
        return () => clearTimeout(debounceTimer.current);
    }, [config]);

    const fetchEstimate = async () => {
        try {
            const data = await api.post('/estimate-cost', { ...config, budget: config.budget });
            setEstimate(data.estimate);
            setScores(data.scores);
        } catch (err) {
            console.error('Cost estimate error:', err);
            toast.error('Failed to fetch cost estimate');
        }
    };

    const fetchOptimization = async () => {
        try {
            const data = await api.post('/optimize-budget', { ...config, targetBudget });
            setOptimization(data.optimization);
            toast.success('Budget optimization complete!');
        } catch (err) {
            console.error('Optimization error:', err);
            toast.error('Failed to optimize budget');
        }
    };

    const formatCost = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

    // Human-readable short format for slider labels
    const formatShort = (val) => {
        if (!val) return '₹0';
        if (val >= 10000000) return '₹' + (val / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
        if (val >= 100000) return '₹' + (val / 100000).toFixed(0) + 'L';
        return '₹' + val.toLocaleString('en-IN');
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Budget Optimizer</h1>
                    <p>Analyze costs and find intelligent ways to reduce your construction budget</p>
                </div>

                <div className="budget-layout">
                    {/* Left — Controls */}
                    <div className="budget-controls">
                        <div className="card">
                            <h3 className="panel-title">Project Parameters</h3>
                            <div className="budget-form-grid">
                                <div className="form-group">
                                    <label className="label">Area (sq ft)</label>
                                    <input className="input" type="number" value={config.area}
                                        onChange={e => setConfig({ ...config, area: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Floors</label>
                                    <input className="input" type="number" min="1" max="10" value={config.floors}
                                        onChange={e => setConfig({ ...config, floors: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Rooms</label>
                                    <input className="input" type="number" min="1" value={config.rooms}
                                        onChange={e => setConfig({ ...config, rooms: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Quality</label>
                                    <select className="input" value={config.qualityLevel}
                                        onChange={e => setConfig({ ...config, qualityLevel: e.target.value })}>
                                        <option value="economy">Economy</option>
                                        <option value="standard">Standard</option>
                                        <option value="premium">Premium</option>
                                        <option value="luxury">Luxury</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Location</label>
                                    <select className="input" value={config.location}
                                        onChange={e => setConfig({ ...config, location: e.target.value })}>
                                        <option value="rural">Rural</option>
                                        <option value="suburban">Suburban</option>
                                        <option value="urban">Urban</option>
                                        <option value="metro">Metro</option>
                                        <option value="downtown">Downtown</option>
                                        <option value="coastal">Coastal</option>
                                        <option value="mountain">Mountain</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Style</label>
                                    <select className="input" value={config.style}
                                        onChange={e => setConfig({ ...config, style: e.target.value })}>
                                        <option value="modern">Modern</option>
                                        <option value="minimalist">Minimalist</option>
                                        <option value="luxury">Luxury</option>
                                        <option value="industrial">Industrial</option>
                                        <option value="traditional">Traditional</option>
                                        <option value="futuristic">Futuristic</option>
                                        <option value="mediterranean">Mediterranean</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Budget Slider */}
                        <div className="card">
                            <h3 className="panel-title">
                                <HiOutlineTrendingDown style={{ color: 'var(--accent-primary)' }} />
                                Budget Target
                            </h3>
                            <div className="budget-slider-section">
                                <div className="budget-display">
                                    <span className="budget-label">Target Budget</span>
                                    <span className="budget-amount">{formatCost(targetBudget)}</span>
                                </div>
                                <input
                                    type="range" className="range-slider" min="1000000" max="100000000" step="100000"
                                    value={targetBudget}
                                    onChange={e => setTargetBudget(Number(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span>₹10L</span>
                                    <span>₹10Cr</span>
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={fetchOptimization}>
                                    <HiOutlineLightningBolt size={16} />
                                    Optimize Budget
                                </button>
                            </div>
                        </div>

                        {/* Optimization Results */}
                        {optimization && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="card">
                                    <h3 className="panel-title">
                                        <HiOutlineLightningBolt style={{ color: 'var(--accent-tertiary)' }} />
                                        Optimization Suggestions
                                    </h3>
                                    {optimization.gap > 0 && (
                                        <div className="optimization-gap">
                                            <span>Budget gap:</span>
                                            <span className="gap-amount">{formatCost(optimization.gap)}</span>
                                        </div>
                                    )}
                                    <ul className="suggestions-list">
                                        {optimization.suggestions?.map((s, i) => (
                                            <motion.li
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                className="suggestion-item"
                                            >
                                                {s}
                                            </motion.li>
                                        ))}
                                    </ul>
                                    {optimization.savings > 0 && (
                                        <div className="savings-badge">
                                            <HiOutlineCheckCircle size={18} />
                                            Potential savings: {formatCost(optimization.savings)}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Right — Charts */}
                    <div className="budget-charts">
                        {estimate && (
                            <>
                                <div className="card">
                                    <h3>Cost Breakdown</h3>
                                    <div className="total-cost">{formatCost(estimate.totalCost)}</div>
                                    <div className="cost-meta">
                                        <span>Rate: {formatCost(estimate.ratePerSqFt)}/sq ft</span>
                                        <span>Materials: {formatCost(estimate.materialCost)}</span>
                                        <span>Labor: {formatCost(estimate.laborCost)}</span>
                                    </div>
                                    <CostChart breakdown={estimate.breakdown} totalCost={estimate.totalCost} />
                                </div>

                                {scores && (
                                    <div className="card">
                                        <h3>Design Scores</h3>
                                        <ScoreRadar scores={scores} />
                                    </div>
                                )}

                                {/* Detailed Breakdown Table */}
                                <div className="card">
                                    <h3>Detailed Breakdown</h3>
                                    <table className="breakdown-table">
                                        <thead>
                                            <tr>
                                                <th>Category</th>
                                                <th>Amount</th>
                                                <th>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(estimate.breakdown || {}).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([key, val]) => (
                                                <tr key={key}>
                                                    <td>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                                                    <td>{formatCost(val)}</td>
                                                    <td>{((val / estimate.totalCost) * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
