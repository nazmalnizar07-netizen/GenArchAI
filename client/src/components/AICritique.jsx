import { useState } from 'react';
import { motion } from 'framer-motion';
import { HiOutlineLightBulb, HiOutlineSparkles } from 'react-icons/hi';
import toast from 'react-hot-toast';
import GlassCard from '../components/GlassCard';
import api from '../api/apiClient';
import './AICritique.css';

export default function AICritique({ design }) {
    const [critique, setCritique] = useState(null);
    const [loading, setLoading] = useState(false);

    const requestCritique = async () => {
        if (!design?.imageUrl && !design?.image_url) {
            toast.error('No design image to analyze');
            return;
        }
        setLoading(true);
        try {
            const data = await api.post(`/design/${design.id || 'temp'}/critique`, {
                imageUrl: design.imageUrl || design.image_url,
                style: design.style || 'modern',
                viewAngle: design.viewAngle || design.view_angle || 'front',
            });
            if (data.success) {
                setCritique(data.critique);
                toast.success('AI critique complete!');
            }
        } catch (err) {
            toast.error('Failed to get AI critique');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const scoreColor = (score) => {
        if (score >= 80) return '#22c55e';
        if (score >= 60) return '#eab308';
        return '#ef4444';
    };

    if (!critique) {
        return (
            <div className="critique-section" data-html2canvas-ignore="true">
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, gap: 16 }}>
                    <button className="btn btn-primary hover-pop" onClick={requestCritique} disabled={loading} style={{ fontSize: '1.1rem', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <HiOutlineLightBulb size={24} />
                        {loading ? 'Analyzing Design...' : 'Get AI Design Critique'}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Powered by Gemma 3 Vision
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="card critique-panel">
            <div className="critique-header">
                <HiOutlineSparkles size={18} />
                <h3>AI Design Critique</h3>
            </div>

            {/* Score Bars */}
            <div className="critique-scores">
                {[
                    { label: 'Aesthetics', key: 'aesthetics' },
                    { label: 'Structural', key: 'structural' },
                    { label: 'Style Match', key: 'styleMatch' },
                    { label: 'Overall', key: 'overall' },
                ].map(({ label, key }) => {
                    const score = critique.scores?.[key] || 0;
                    return (
                        <div key={key} className="score-row">
                            <div className="score-label">
                                <span>{label}</span>
                                <span className="score-value" style={{ color: scoreColor(score) }}>{score}</span>
                            </div>
                            <div className="score-bar-bg">
                                <motion.div
                                    className="score-bar-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    style={{ backgroundColor: scoreColor(score) }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            {critique.summary && (
                <div className="critique-summary">
                    <p>{critique.summary}</p>
                </div>
            )}

            {/* Feedback Points */}
            {critique.feedback && critique.feedback.length > 0 && (
                <div className="critique-feedback">
                    <h4>Suggestions</h4>
                    <ul>
                        {critique.feedback.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
            )}

            <button className="btn btn-sm btn-ghost critique-retry" onClick={requestCritique} disabled={loading}>
                {loading ? 'Analyzing...' : '🔄 Re-analyze'}
            </button>
        </div>
    );
}
