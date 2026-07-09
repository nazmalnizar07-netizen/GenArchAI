import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineHeart, HiHeart, HiOutlineScale, HiOutlineEye, HiOutlineClock } from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../api/apiClient';
import './VersionHistory.css';

export default function VersionHistory({ designs, project, openDesignDetail, onRefresh }) {
    const [filter, setFilter] = useState('all'); // all | favorites
    const [compareMode, setCompareMode] = useState(false);
    const [selected, setSelected] = useState([]);
    const [comparison, setComparison] = useState(null);

    // Group designs by plan_id for version grouping
    const plans = {};
    designs.forEach(d => {
        const pid = d.plan_id || d.id;
        if (!plans[pid]) plans[pid] = { planId: pid, views: [], created: d.created_at };
        plans[pid].views.push(d);
    });
    const planGroups = Object.values(plans).sort((a, b) => new Date(b.created) - new Date(a.created));

    const filteredDesigns = filter === 'favorites'
        ? designs.filter(d => d.favorite)
        : designs;

    const toggleFavorite = async (designId, e) => {
        e.stopPropagation();
        try {
            const data = await api.post(`/design/${designId}/favorite`);
            if (data.success) {
                toast.success(data.favorite ? 'Added to favorites' : 'Removed from favorites');
                if (onRefresh) onRefresh();
            }
        } catch {
            toast.error('Failed to toggle favorite');
        }
    };

    const toggleSelect = (design) => {
        if (!compareMode) return;
        setSelected(prev => {
            const exists = prev.find(d => d.id === design.id);
            if (exists) return prev.filter(d => d.id !== design.id);
            if (prev.length >= 2) return [prev[1], design]; // replace oldest
            return [...prev, design];
        });
    };

    const runComparison = async () => {
        if (selected.length !== 2) {
            toast.error('Select exactly 2 designs to compare');
            return;
        }
        try {
            const data = await api.post('/designs/compare', {
                design1: {
                    label: `${selected[0].view_angle || 'front'} view`,
                    costEstimate: selected[0].cost_estimate,
                    scores: selected[0].scores,
                    style: selected[0].style,
                },
                design2: {
                    label: `${selected[1].view_angle || 'front'} view`,
                    costEstimate: selected[1].cost_estimate,
                    scores: selected[1].scores,
                    style: selected[1].style,
                },
            });
            if (data.success) setComparison(data.comparison);
        } catch {
            toast.error('Failed to compare designs');
        }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="version-history">
            {/* Controls */}
            <div className="vh-controls">
                <div className="vh-filters">
                    <button className={`vh-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                        All ({designs.length})
                    </button>
                    <button className={`vh-filter ${filter === 'favorites' ? 'active' : ''}`} onClick={() => setFilter('favorites')}>
                        <HiHeart size={14} /> Favorites
                    </button>
                </div>
                <div className="vh-actions">
                    <button
                        className={`btn btn-sm ${compareMode ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setCompareMode(!compareMode); setSelected([]); setComparison(null); }}
                    >
                        <HiOutlineScale size={14} />
                        {compareMode ? 'Exit Compare' : 'Compare'}
                    </button>
                </div>
            </div>

            {/* Compare Mode Selection */}
            {compareMode && (
                <motion.div className="vh-compare-bar" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                    <p>Select 2 designs to compare ({selected.length}/2 selected)</p>
                    {selected.length === 2 && (
                        <button className="btn btn-sm btn-primary" onClick={runComparison}>Run Comparison</button>
                    )}
                </motion.div>
            )}

            {/* Comparison Result */}
            {comparison && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="card vh-comparison-card">
                        <h3 className="comparison-title"><HiOutlineScale /> Side-by-Side Comparison</h3>
                        <div className="comparison-grid">
                            <div className="comparison-col">
                                <img src={selected[0]?.image_url} alt="Design A" className="comparison-thumb" />
                                <h4>{comparison.design1.label}</h4>
                                <p className="comparison-cost">{formatCurrency(comparison.design1.cost)}</p>
                            </div>
                            <div className="comparison-vs">VS</div>
                            <div className="comparison-col">
                                <img src={selected[1]?.image_url} alt="Design B" className="comparison-thumb" />
                                <h4>{comparison.design2.label}</h4>
                                <p className="comparison-cost">{formatCurrency(comparison.design2.cost)}</p>
                            </div>
                        </div>
                        <div className="comparison-stats">
                            <div className="stat-row">
                                <span>💰 Cheaper</span>
                                <span className="stat-winner">{comparison.comparison.cheaper}</span>
                            </div>
                            <div className="stat-row">
                                <span>📐 More Efficient</span>
                                <span className="stat-winner">{comparison.comparison.moreEfficient}</span>
                            </div>
                            <div className="stat-row">
                                <span>🌿 Sustainable</span>
                                <span className="stat-winner">{comparison.comparison.moreSustainable}</span>
                            </div>
                            <div className="stat-row">
                                <span>✨ Luxurious</span>
                                <span className="stat-winner">{comparison.comparison.moreLuxurious}</span>
                            </div>
                            <div className="stat-row">
                                <span>💸 Cost Diff</span>
                                <span className="stat-value">{formatCurrency(comparison.comparison.costDifference)}</span>
                            </div>
                        </div>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setComparison(null); setSelected([]); }} style={{ marginTop: '20px' }}>
                            Clear Comparison
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Timeline / Version Groups */}
            <div className="vh-timeline">
                {planGroups.map((group, gi) => (
                    <div key={group.planId} className="vh-plan-group">
                        <div className="vh-plan-header">
                            <HiOutlineClock size={14} />
                            <span className="vh-plan-label">Plan #{gi + 1}</span>
                            <span className="vh-plan-date">{formatDate(group.created)}</span>
                            <span className="vh-plan-count">{group.views.length} view{group.views.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="vh-grid">
                            {group.views
                                .filter(d => filter === 'all' || d.favorite)
                                .map((design, i) => (
                                    <motion.div
                                        key={design.id}
                                        className={`vh-card ${compareMode && selected.find(s => s.id === design.id) ? 'vh-selected' : ''}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        onClick={() => compareMode ? toggleSelect(design) : openDesignDetail(design)}
                                    >
                                        <div className="vh-card-image">
                                            <img src={design.image_url} alt={design.view_angle} />
                                            <span className="vh-card-angle">{design.view_angle || 'front'}</span>
                                            <button
                                                className={`vh-fav-btn ${design.favorite ? 'active' : ''}`}
                                                onClick={(e) => toggleFavorite(design.id, e)}
                                            >
                                                {design.favorite ? <HiHeart size={16} /> : <HiOutlineHeart size={16} />}
                                            </button>
                                            {compareMode && (
                                                <div className={`vh-select-badge ${selected.find(s => s.id === design.id) ? 'active' : ''}`}>
                                                    {selected.findIndex(s => s.id === design.id) + 1 || ''}
                                                </div>
                                            )}
                                        </div>
                                        <div className="vh-card-info">
                                            <span className="vh-card-style">{design.style}</span>
                                            <span className="vh-card-time">{formatDate(design.created_at)}</span>
                                        </div>
                                    </motion.div>
                                ))}
                        </div>
                    </div>
                ))}
            </div>

            {filteredDesigns.length === 0 && (
                <div className="vh-empty">
                    <p>{filter === 'favorites' ? 'No favorites yet — click ♡ on a design' : 'No designs generated yet'}</p>
                </div>
            )}
        </div>
    );
}
