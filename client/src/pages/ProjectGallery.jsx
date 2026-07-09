import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlinePlus, HiOutlineSparkles, HiOutlineHome, HiOutlineChat } from 'react-icons/hi';
import GlassCard from '../components/GlassCard';
import LoadingOverlay from '../components/LoadingOverlay';
import api from '../api/apiClient';

export default function ProjectGallery() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjectData();
    }, [id]);

    const loadProjectData = async () => {
        try {
            setLoading(true);
            const [projRes, desRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/designs?projectId=${id}`)
            ]);
            if (projRes.project) setProject(projRes.project);
            if (desRes.designs) setDesigns(desRes.designs);
        } catch (err) {
            console.error('Failed to load project data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingOverlay visible={true} message="Loading project history..." />;
    }

    if (!project) {
        return (
            <div className="page">
                <div className="container" style={{ textAlign: 'center', paddingTop: 100 }}>
                    <h2>Project Not Found</h2>
                    <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 24 }}>Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

    const openDesignDetail = (design) => {
        if (design.type === 'renovation') return;

        navigate('/design', {
            state: {
                design: {
                    imageUrl: design.image_url,
                    prompt: design.prompt,
                    style: design.style,
                    scores: design.scores,
                    costEstimate: design.cost_estimate,
                    metadata: design.metadata,
                    breakdown: {}, // Default empty breakdown as it's not fully persisted
                },
                config: {
                    name: project.name,
                    style: design.style || project.style,
                    area: design.area || project.area,
                    budget: design.budget || project.budget,
                    floors: project.floors,
                    rooms: project.rooms,
                    qualityLevel: project.quality_level || 'standard'
                }
            }
        });
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h1>{project.name}</h1>
                        <p>{project.description || `${project.style} style • ${project.area} sq ft • ${project.floors} floors`}</p>
                        <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                            Budget: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{formatCurrency(project.budget)}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Link to={`/upload?project=${id}`} className="btn btn-primary">
                            <HiOutlineSparkles size={18} />
                            Generate Design
                        </Link>
                        <Link to={`/renovate?project=${id}`} className="btn btn-secondary">
                            <HiOutlineHome size={18} />
                            Renovate Room
                        </Link>
                        <Link to={`/chat?project=${id}`} className="btn btn-secondary" style={{ borderColor: 'var(--accent-tertiary)', color: 'var(--accent-tertiary)' }}>
                            <HiOutlineChat size={18} />
                            AI Chat
                        </Link>
                    </div>
                </div>

                {designs.length === 0 ? (
                    <GlassCard className="empty-state" style={{ textAlign: 'center', padding: '64px 24px', marginTop: 32 }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', background: 'rgba(0, 212, 255, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
                        }}>
                            <HiOutlineSparkles size={40} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <h3 style={{ fontSize: 24, marginBottom: 12 }}>No designs yet</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
                            Get started by generating your first AI architectural design or room renovation for this project.
                        </p>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                            <Link to={`/upload?project=${id}`} className="btn btn-primary">Generate Initial Design</Link>
                            <Link to={`/renovate?project=${id}`} className="btn btn-secondary">Renovate Room</Link>
                            <Link to={`/chat?project=${id}`} className="btn btn-secondary" style={{ borderColor: 'var(--accent-tertiary)', color: 'var(--accent-tertiary)' }}>Ask AI Architect</Link>
                        </div>
                    </GlassCard>
                ) : (
                    <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24, marginTop: 32 }}>
                        {designs.map((design, i) => (
                            <motion.div
                                key={design.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <GlassCard
                                    hover={true}
                                    className="gallery-card"
                                    style={{
                                        padding: 12, height: '100%', display: 'flex', flexDirection: 'column',
                                        cursor: design.type === 'design' ? 'pointer' : 'default'
                                    }}
                                    onClick={() => design.type === 'design' && openDesignDetail(design)}
                                >
                                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                                        {design.image_url ? (
                                            <img
                                                src={design.image_url}
                                                alt={design.prompt || 'Generated Design'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <HiOutlineHome size={40} style={{ color: 'var(--text-tertiary)' }} />
                                            </div>
                                        )}
                                        <div style={{
                                            position: 'absolute', top: 12, right: 12,
                                            background: design.type === 'renovation' ? 'rgba(168, 85, 247, 0.8)' : 'rgba(0, 212, 255, 0.8)',
                                            padding: '4px 12px', borderRadius: 20, fontSize: 11,
                                            backdropFilter: 'blur(4px)', textTransform: 'uppercase', letterSpacing: '0.5px',
                                            fontWeight: 600, color: '#fff'
                                        }}>
                                            {design.type || 'Design'}
                                        </div>
                                    </div>

                                    <div style={{ padding: '16px 8px 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 style={{ fontSize: 18, marginBottom: 8, textTransform: 'capitalize' }}>
                                            {design.style} Style
                                        </h3>
                                        <p style={{
                                            fontSize: 14, color: 'var(--text-secondary)',
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            flex: 1
                                        }}>
                                            {design.prompt || 'No description provided.'}
                                        </p>
                                    </div>

                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '16px 8px 4px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Created</span>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                {new Date(design.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {design.type === 'design' && design.cost_estimate && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Est. Cost</span>
                                                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    {formatCurrency(design.cost_estimate?.total)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </GlassCard>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
