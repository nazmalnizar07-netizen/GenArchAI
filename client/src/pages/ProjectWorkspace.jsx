import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiOutlinePhotograph,
    HiOutlineSparkles,
    HiOutlineHome,
    HiOutlineCurrencyDollar,
    HiOutlineChatAlt2,
    HiOutlineArrowLeft,
    HiOutlineClock,
    HiOutlinePlay
} from 'react-icons/hi';
import GlassCard from '../components/GlassCard';
import LoadingOverlay from '../components/LoadingOverlay';
import api from '../api/apiClient';
import { useSocket } from '../hooks/useSocket';

// Lazy-load tab content pages
import UploadDesign from './UploadDesign';
import RenovationStudio from './RenovationStudio';
import BudgetOptimizer from './BudgetOptimizer';
import ArchitectChat from './ArchitectChat';
import VersionHistory from './VersionHistory';
import PresentationMode from './PresentationMode';

import './ProjectWorkspace.css';

const TABS = [
    { id: 'gallery', label: 'Gallery', icon: HiOutlinePhotograph },
    { id: 'versions', label: 'Versions', icon: HiOutlineClock },
    { id: 'generate', label: 'Generate', icon: HiOutlineSparkles },
    { id: 'renovate', label: 'Renovate', icon: HiOutlineHome },
    { id: 'budget', label: 'Budget', icon: HiOutlineCurrencyDollar },
    { id: 'chat', label: 'AI Chat', icon: HiOutlineChatAlt2 },
];

export default function ProjectWorkspace() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'gallery';
    const [isPresentationMode, setIsPresentationMode] = useState(false);

    const [project, setProject] = useState(null);
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const { joinProject } = useSocket();

    useEffect(() => {
        loadProjectData();
        // Join socket room for real-time updates
        if (id) joinProject(id);
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

    const switchTab = (tabId) => {
        setSearchParams({ tab: tabId });
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

    const openDesignDetail = (design) => {
        if (design.type === 'renovation') return;
        navigate('/design', {
            state: {
                design: {
                    imageUrl: design.image_url,
                    sketchUrl: design.sketch_url || null,
                    viewAngle: design.view_angle || 'front',
                    planId: design.plan_id || null,
                    prompt: design.prompt,
                    style: design.style,
                    scores: design.scores,
                    costEstimate: design.cost_estimate,
                    metadata: design.metadata,
                    breakdown: {},
                },
                config: {
                    name: project.name,
                    prompt: design.original_prompt || design.prompt,
                    style: design.style || project.style,
                    area: design.area || project.area,
                    budget: design.budget || project.budget,
                    floors: design.floors || project.floors,
                    rooms: design.rooms || project.rooms,
                    qualityLevel: design.quality_level || project.quality_level || 'standard'
                },
                sketchUrl: design.sketch_url || null,
                projectId: id,
            }
        });
    };

    if (loading) {
        return <LoadingOverlay visible={true} message="Loading project workspace..." />;
    }

    if (!project) {
        return (
            <div className="page">
                <div className="container" style={{ textAlign: 'center', paddingTop: 100 }}>
                    <h2>Project Not Found</h2>
                    <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Render Presentation Mode when active
    if (isPresentationMode) {
        return (
            <PresentationMode
                designs={designs.filter(d => d.type === 'design')}
                project={project}
                projectId={id}
                onClose={() => setIsPresentationMode(false)}
            />
        );
    }

    return (
        <div className="workspace-page">
            {/* Sidebar */}
            <aside className="workspace-sidebar">
                <button className="sidebar-back" onClick={() => navigate('/dashboard')}>
                    <HiOutlineArrowLeft size={18} />
                    <span>All Projects</span>
                </button>

                <div className="sidebar-project-info">
                    <h2 className="sidebar-project-name">{project.name}</h2>
                    <p className="sidebar-project-meta">
                        {project.style} · {project.area} sqft · {project.floors}F
                    </p>
                    <p className="sidebar-project-budget">{formatCurrency(project.budget)}</p>
                </div>

                <nav className="sidebar-nav">
                    {TABS.map(({ id: tabId, label, icon: Icon }) => (
                        <button
                            key={tabId}
                            className={`sidebar-tab ${activeTab === tabId ? 'active' : ''}`}
                            onClick={() => switchTab(tabId)}
                        >
                            <Icon size={20} />
                            <span>{label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-stats">
                    <div className="sidebar-stat">
                        <span className="stat-num">{designs.filter(d => d.type === 'design').length}</span>
                        <span className="stat-label">Designs</span>
                    </div>
                    <div className="sidebar-stat">
                        <span className="stat-num">{designs.filter(d => d.type === 'renovation').length}</span>
                        <span className="stat-label">Renovations</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="workspace-main">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2 }}
                        className="workspace-content"
                    >
                        {activeTab === 'gallery' && (
                            <GalleryTab
                                designs={designs}
                                project={project}
                                formatCurrency={formatCurrency}
                                openDesignDetail={openDesignDetail}
                                switchTab={switchTab}
                                onPresentationMode={() => setIsPresentationMode(true)}
                            />
                        )}
                        {activeTab === 'versions' && (
                            <VersionHistory
                                designs={designs}
                                project={project}
                                openDesignDetail={openDesignDetail}
                                onRefresh={loadProjectData}
                            />
                        )}
                        {activeTab === 'generate' && (
                            <UploadDesign projectId={id} project={project} embedded />
                        )}
                        {activeTab === 'renovate' && (
                            <RenovationStudio projectId={id} project={project} embedded />
                        )}
                        {activeTab === 'budget' && (
                            <BudgetOptimizer project={project} embedded />
                        )}
                        {activeTab === 'chat' && (
                            <ArchitectChat projectId={id} project={project} embedded />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

/* ── Gallery Tab (inline) ────────────────────────── */
function GalleryTab({ designs, project, formatCurrency, openDesignDetail, switchTab, onPresentationMode }) {
    const designCount = designs.filter(d => d.type === 'design').length;

    if (designCount === 0) {
        return (
            <div className="gallery-empty">
                <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <div className="empty-icon-wrap">
                        <HiOutlineSparkles size={40} style={{ color: '#000' }} />
                    </div>
                    <h3 style={{ fontSize: 24, marginBottom: 12 }}>No designs yet</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 32px' }}>
                        Start by generating your first AI architectural design or renovating a room for this project.
                    </p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={() => switchTab('generate')}>Generate Design</button>
                        <button className="btn btn-secondary" onClick={() => switchTab('renovate')}>Renovate Room</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="gallery-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2>Project Gallery</h2>
                    <p>{designCount} generation{designCount !== 1 ? 's' : ''}</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={onPresentationMode}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
                    title="Enter presentation mode for client viewing"
                >
                    <HiOutlinePlay size={18} />
                    Client Presentation
                </button>
            </div>
            <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, marginTop: 24 }}>
                {designs.filter(d => d.type === 'design').map((design, i) => (
                    <motion.div
                        key={design.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                    >
                        <div
                            className="gallery-card"
                            style={{
                                background: '#fff',
                                border: 'var(--border-width) solid var(--border-color)',
                                boxShadow: 'var(--shadow-base)',
                                padding: 12, height: '100%', display: 'flex', flexDirection: 'column',
                                cursor: design.type === 'design' ? 'pointer' : 'default',
                                transition: 'all 0.1s'
                            }}
                            onClick={() => design.type === 'design' && openDesignDetail(design)}
                        >
                            <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3', backgroundColor: '#000', border: 'var(--border-width) solid var(--border-color)' }}>
                                {design.image_url ? (
                                    <img src={design.image_url} alt={design.prompt || 'Generated Design'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                        <HiOutlineHome size={40} style={{ color: '#000' }} />
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute', top: 12, right: 12,
                                    display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end'
                                }}>
                                    <span style={{
                                        background: design.type === 'renovation' ? 'var(--accent-indigo)' : 'var(--accent-blue)',
                                        padding: '4px 12px', fontSize: 11,
                                        border: '2px solid #000', textTransform: 'uppercase', letterSpacing: '0.5px',
                                        fontWeight: 800, color: '#fff', boxShadow: '2px 2px 0 0 #000'
                                    }}>
                                        {design.type || 'Design'}
                                    </span>
                                    {design.view_angle && design.type !== 'renovation' && (
                                        <span style={{
                                            background: '#000',
                                            padding: '4px 10px', fontSize: 10,
                                            border: '2px solid #000', textTransform: 'uppercase', letterSpacing: '0.5px',
                                            fontWeight: 800, color: '#fff', boxShadow: '2px 2px 0 0 rgba(255,255,255,0.2)'
                                        }}>
                                            {design.view_angle === 'front' ? 'HOME Front' :
                                                design.view_angle === 'left' ? 'LEFT' :
                                                    design.view_angle === 'right' ? 'RIGHT' :
                                                        design.view_angle === 'rear' ? 'REAR' :
                                                            design.view_angle === 'aerial' ? 'AERIAL' : design.view_angle}
                                        </span>
                                    )}
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
                                    {design.prompt || 'professional architectural rendering'}
                                </p>
                            </div>

                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '16px 8px 4px', borderTop: 'var(--border-width) solid var(--border-color)', marginTop: 8
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>CREATED</span>
                                    <span style={{ fontSize: 13, color: '#000', fontWeight: 800 }}>
                                        {new Date(design.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {design.type === 'design' && design.cost_estimate && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>EST. COST</span>
                                        <span style={{ fontSize: 13, color: '#000', fontWeight: 900 }}>
                                            {formatCurrency(design.cost_estimate?.total)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
