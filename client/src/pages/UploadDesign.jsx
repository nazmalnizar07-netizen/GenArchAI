import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineUpload, HiOutlineSparkles, HiOutlinePhotograph, HiOutlineExclamation } from 'react-icons/hi';
import toast from 'react-hot-toast';
import GlassCard from '../components/GlassCard';
import LoadingOverlay from '../components/LoadingOverlay';
import api from '../api/apiClient';
import './UploadDesign.css';

const MIN_RATE_PER_SQFT = 1400;
const formatINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const materialPalettes = [
    { id: 'default', label: 'Auto Detect', colors: ['#888', '#aaa', '#ccc'], desc: 'AI picks materials based on style' },
    { id: 'wood-concrete-glass', label: 'Wood + Concrete + Glass', colors: ['#8B6914', '#808080', '#87CEEB'], desc: 'Warm natural tones' },
    { id: 'brick-metal-slate', label: 'Brick + Metal + Slate', colors: ['#B22222', '#4A4A4A', '#708090'], desc: 'Industrial warmth' },
    { id: 'white-marble-gold', label: 'White Marble + Gold', colors: ['#FAFAFA', '#E8E0D0', '#D4AF37'], desc: 'Luxury elegance' },
    { id: 'concrete-timber-green', label: 'Concrete + Timber + Green', colors: ['#A0A0A0', '#DEB887', '#228B22'], desc: 'Eco-friendly modern' },
    { id: 'glass-steel-black', label: 'Glass + Steel + Black', colors: ['#87CEEB', '#C0C0C0', '#1a1a1a'], desc: 'Ultra-modern' },
];

const styleOptions = [
    { id: 'modern', label: 'Modern', emoji: '🏢' },
    { id: 'minimalist', label: 'Minimalist', emoji: '◻️' },
    { id: 'luxury', label: 'Luxury', emoji: '🏛️' },
    { id: 'industrial', label: 'Industrial', emoji: '🏭' },
    { id: 'traditional', label: 'Traditional', emoji: '🏠' },
    { id: 'futuristic', label: 'Futuristic', emoji: '🚀' },
    { id: 'mediterranean', label: 'Mediterranean', emoji: '🌊' },
    { id: 'colonial', label: 'Colonial', emoji: '🏡' },
];

const viewAngles = [
    { id: 'front', label: 'Front View', icon: '🏠', desc: 'Front elevation of the building' },
    { id: 'left', label: 'Left Side', icon: '◀️', desc: 'Left side elevation' },
    { id: 'right', label: 'Right Side', icon: '▶️', desc: 'Right side elevation' },
    { id: 'rear', label: 'Rear View', icon: '🔙', desc: 'Back of the building' },
    { id: 'aerial', label: "Bird's Eye", icon: '🦅', desc: 'Aerial top-down view' },
];

export default function UploadDesign({ projectId: propProjectId, project, embedded }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const projectId = propProjectId || searchParams.get('project');

    const [loading, setLoading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [generatedDesign, setGeneratedDesign] = useState(null);
    const [projectData, setProjectData] = useState(project || null);
    const [config, setConfig] = useState({
        prompt: '',
        style: 'modern',
        viewAngle: 'front',
        area: 1500,
        floors: 2,
        rooms: 4,
        qualityLevel: 'standard',
        budget: 5000000,
        luxuryLevel: 50,
        ecoLevel: 50,
        materialPalette: 'default',
    });

    // ─── Budget feasibility check ───
    const budgetCheck = useMemo(() => {
        const totalArea = (config.area || 0) * (config.floors || 1);
        const minCostForArea = totalArea * MIN_RATE_PER_SQFT;
        const maxAffordableArea = Math.floor((config.budget || 0) / (MIN_RATE_PER_SQFT * (config.floors || 1)));
        const isOverBudget = config.budget > 0 && totalArea > 0 && minCostForArea > config.budget;
        return { isOverBudget, maxAffordableArea, minCostForArea, totalArea };
    }, [config.area, config.floors, config.budget]);

    // Load project when opened with a project query if no project prop is provided
    useEffect(() => {
        if (!project && projectId) {
            const fetchProject = async () => {
                try {
                    const res = await api.get(`/projects/${projectId}`);
                    if (res.project) setProjectData(res.project);
                } catch (err) {
                    console.warn('Unable to load project for UploadDesign:', err);
                }
            };
            fetchProject();
        }
    }, [project, projectId]);

    // Sync config defaults from the loaded project
    useEffect(() => {
        const activeProject = project || projectData;
        if (!activeProject) return;

        setConfig(prev => ({
            ...prev,
            style: activeProject.style || prev.style,
            area: activeProject.area || prev.area,
            floors: activeProject.floors || prev.floors,
            rooms: activeProject.rooms || prev.rooms,
            qualityLevel: activeProject.quality_level || prev.qualityLevel,
            budget: Number(activeProject.budget) || prev.budget,
            prompt: prev.prompt || `${activeProject.style || 'modern'} building design`,
        }));
    }, [project, projectData]);

    // Keyboard shortcut: Ctrl+Enter to generate
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === 'Enter' && !loading) {
                e.preventDefault();
                handleGenerate();
            }
            if (e.key === 'Escape') {
                navigate(-1);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [loading, config]);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            let data;

            if (uploadedImage) {
                const formData = new FormData();
                formData.append('image', uploadedImage);
                const materialSuffix = config.materialPalette !== 'default'
                    ? `, using ${materialPalettes.find(m => m.id === config.materialPalette)?.label} materials`
                    : '';
                formData.append('prompt', (config.prompt || `${config.style} building design`) + materialSuffix);
                formData.append('style', config.style);
                formData.append('viewAngle', config.viewAngle);
                formData.append('area', config.area);
                formData.append('floors', config.floors);
                formData.append('rooms', config.rooms);
                formData.append('qualityLevel', config.qualityLevel);
                formData.append('budget', config.budget);
                if (projectId) formData.append('projectId', projectId);

                data = await api.post('/generate-design', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                data = await api.post('/generate-design', {
                    prompt: (config.prompt || `${config.style} building design`) +
                        (config.materialPalette !== 'default' ? `, using ${materialPalettes.find(m => m.id === config.materialPalette)?.label} materials` : ''),
                    style: config.style,
                    viewAngle: config.viewAngle,
                    area: config.area,
                    floors: config.floors,
                    rooms: config.rooms,
                    qualityLevel: config.qualityLevel,
                    budget: config.budget,
                    projectId: projectId || undefined,
                });
            }

            if (data.success) {
                setGeneratedDesign(data.design);
                toast.success('Design generated successfully!');
                navigate('/design', {
                    state: {
                        design: data.design,
                        config: { ...config, name: project?.name || 'Design' },
                        sketchUrl: previewUrl || null,
                        projectId,
                    }
                });
            }
        } catch (err) {
            console.error('Generation error:', err);
            toast.error('Design generation failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <LoadingOverlay visible={loading} message="Generating your architectural design..." />
            <div className="container">
                <div className="page-header">
                    <h1 className="tech-title">Generate Design <span className="tech-version">v2.0</span></h1>
                    <p className="tech-subtitle">SYS_INIT: multi_view_architectural_engine</p>
                </div>

                <div className="upload-layout">
                    {/* Left Panel — Controls */}
                    <div className="upload-controls">
                        <div className="card tech-card">
                            <div className="tech-marker tech-marker-tl tech-marker-h tech-marker-v"></div>
                            <div className="tech-marker tech-marker-tr tech-marker-h tech-marker-v"></div>
                            <div className="tech-marker tech-marker-bl tech-marker-h tech-marker-v"></div>
                            <div className="tech-marker tech-marker-br tech-marker-h tech-marker-v"></div>

                            <div className="panel-header-alt">
                                <span className="tech-id">[SYS_PARAM_A1]</span>
                                <h3 className="panel-title-alt">Design Parameters</h3>
                            </div>

                            {/* Upload Sketch */}
                            <div className="form-group">
                                <label className="label-tech">[ UPLOAD_SKETCH ]</label>
                                <label className="upload-zone" htmlFor="sketch-upload">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Sketch" className="upload-preview" />
                                    ) : (
                                        <>
                                            <HiOutlineUpload size={32} className="upload-icon" />
                                            <span>Drop sketch or click to upload</span>
                                        </>
                                    )}
                                    <input id="sketch-upload" type="file" accept="image/*" hidden onChange={handleImageUpload} />
                                </label>
                            </div>

                            {/* View Angle Selection */}
                            <div className="form-group">
                                <label className="label-tech">[ VIEW_ANGLE ]</label>
                                <div className="view-angle-grid">
                                    {viewAngles.map(v => (
                                        <button
                                            key={v.id}
                                            className={`view-angle-option ${config.viewAngle === v.id ? 'active' : ''}`}
                                            onClick={() => setConfig({ ...config, viewAngle: v.id })}
                                            title={v.desc}
                                        >
                                            <span className="view-angle-icon">{v.icon}</span>
                                            <span className="view-angle-label">{v.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Prompt */}
                            <div className="form-group">
                                <label className="label-tech">[ DESIGN_DESCRIPTION ]</label>
                                <textarea
                                    className="input"
                                    placeholder="Describe your dream building... e.g. 'A two-story modern house with large windows and a rooftop garden'"
                                    value={config.prompt}
                                    onChange={e => setConfig({ ...config, prompt: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            {/* Style Selection */}
                            <div className="form-group">
                                <label className="label-tech">[ ARCHITECTURAL_STYLE ]</label>
                                <div className="style-grid">
                                    {styleOptions.map(s => (
                                        <button
                                            key={s.id}
                                            className={`style-option hover-pop ${config.style === s.id ? 'active' : ''}`}
                                            onClick={() => setConfig({ ...config, style: s.id })}
                                        >
                                            <span className="style-emoji">{s.emoji}</span>
                                            <span>{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Numeric inputs */}
                            <div className="input-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="label-tech">[ AREA_SQFT ] {budgetCheck.isOverBudget && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>⚠ Max {budgetCheck.maxAffordableArea}</span>}</label>
                                    <input className={`input ${budgetCheck.isOverBudget ? 'input-error' : ''}`} type="number" value={config.area}
                                        onChange={e => setConfig({ ...config, area: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label-tech">[ FLOORS ]</label>
                                    <input className="input" type="number" min="1" max="10" value={config.floors}
                                        onChange={e => setConfig({ ...config, floors: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="label-tech">[ ROOMS ]</label>
                                    <input className="input" type="number" min="1" max="20" value={config.rooms}
                                        onChange={e => setConfig({ ...config, rooms: Number(e.target.value) })} />
                                </div>
                            </div>

                            {/* Budget feasibility warning */}
                            {budgetCheck.isOverBudget && (
                                <div className="budget-warning" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '8px', marginBottom: '16px' }}>
                                    <HiOutlineExclamation size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                                        <strong>Budget too low for this area</strong>
                                        <p style={{ margin: '4px 0 0' }}>A {config.area} sq ft × {config.floors} floor home needs at least <strong>{formatINR(budgetCheck.minCostForArea)}</strong>. Max affordable area: <strong>{budgetCheck.maxAffordableArea} sq ft</strong> per floor.</p>
                                    </div>
                                </div>
                            )}

                            {/* Quality */}
                            <div className="form-group">
                                <label className="label-tech">[ QUALITY_TARGET ]</label>
                                <select className="input" value={config.qualityLevel}
                                    onChange={e => setConfig({ ...config, qualityLevel: e.target.value })}>
                                    <option value="economy">Economy</option>
                                    <option value="standard">Standard</option>
                                    <option value="premium">Premium</option>
                                    <option value="luxury">Luxury</option>
                                </select>
                            </div>

                            {/* Budget */}
                            <div className="form-group">
                                <label className="label-tech">[ BUDGET_ALLOCATION : {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(config.budget)} ]</label>
                                <input type="range" className="range-slider" min="500000" max="50000000" step="100000"
                                    value={config.budget} onChange={e => setConfig({ ...config, budget: Number(e.target.value) })} />
                            </div>

                            {/* Luxury Slider */}
                            <div className="form-group">
                                <label className="label-tech">[ LUXURY_COEFFICIENT : {config.luxuryLevel}% ]</label>
                                <input type="range" className="range-slider" min="0" max="100"
                                    value={config.luxuryLevel} onChange={e => setConfig({ ...config, luxuryLevel: Number(e.target.value) })} />
                            </div>

                            {/* Eco Slider */}
                            <div className="form-group">
                                <label className="label-tech">[ ECO_RATING : {config.ecoLevel}% ]</label>
                                <input type="range" className="range-slider" min="0" max="100"
                                    value={config.ecoLevel} onChange={e => setConfig({ ...config, ecoLevel: Number(e.target.value) })} style={{ accentColor: 'var(--accent-green)' }} />
                            </div>

                            {/* Material Palette */}
                            <div className="form-group">
                                <label className="label-tech">[ MATERIAL_PALETTE ]</label>
                                <div className="palette-grid">
                                    {materialPalettes.map(p => (
                                        <button
                                            key={p.id}
                                            className={`palette-option ${config.materialPalette === p.id ? 'active' : ''}`}
                                            onClick={() => setConfig({ ...config, materialPalette: p.id })}
                                            title={p.desc}
                                        >
                                            <div className="palette-colors">
                                                {p.colors.map((c, i) => (
                                                    <span key={i} className="palette-dot" style={{ backgroundColor: c }} />
                                                ))}
                                            </div>
                                            <span className="palette-label">{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel — Preview */}
                    <div className="upload-preview-panel">
                        <div className="card preview-card tech-card">
                            <div className="tech-marker tech-marker-tl tech-marker-h tech-marker-v"></div>
                            <div className="tech-marker tech-marker-tr tech-marker-h tech-marker-v"></div>
                            <div className="tech-marker tech-marker-bl tech-marker-h tech-marker-v"></div>
                            <div className="tech-marker tech-marker-br tech-marker-h tech-marker-v"></div>

                            <div className="panel-header-alt">
                                <span className="tech-id">[SYS_PREV_G2]</span>
                                <h3 className="panel-title-alt">Preview</h3>
                            </div>
                            <div className="preview-container">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Sketch Preview" />
                                ) : (
                                    <div className="preview-placeholder">
                                        <HiOutlinePhotograph size={64} />
                                        <p>Your design will appear here</p>
                                        <span>Upload a sketch or click generate</span>
                                    </div>
                                )}
                            </div>

                            <div className="config-summary">
                                <div className="summary-row">
                                    <span>Style</span>
                                    <span className="summary-value">{config.style}</span>
                                </div>
                                <div className="summary-row">
                                    <span>View</span>
                                    <span className="summary-value">{viewAngles.find(v => v.id === config.viewAngle)?.label || 'Front View'}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Area</span>
                                    <span className="summary-value">{config.area} sq ft</span>
                                </div>
                                <div className="summary-row">
                                    <span>Floors × Rooms</span>
                                    <span className="summary-value">{config.floors} × {config.rooms}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Budget</span>
                                    <span className="summary-value">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(config.budget)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Quality</span>
                                    <span className="summary-value">{config.qualityLevel}</span>
                                </div>
                            </div>

                            <motion.button
                                className="btn btn-primary btn-lg generate-btn hover-pop hover-vibrant-blue"
                                onClick={handleGenerate}
                                whileHover={budgetCheck.isOverBudget ? {} : { scale: 1.05 }}
                                whileTap={budgetCheck.isOverBudget ? {} : { scale: 0.95 }}
                                title={budgetCheck.isOverBudget ? 'Adjust area or budget first' : 'Ctrl+Enter'}
                                disabled={budgetCheck.isOverBudget}
                                style={budgetCheck.isOverBudget ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                                <HiOutlineSparkles size={24} />
                                {budgetCheck.isOverBudget ? 'Adjust Area or Budget' : `Generate ${viewAngles.find(v => v.id === config.viewAngle)?.label || 'Design'}`}
                                {!budgetCheck.isOverBudget && <span className="shortcut-hint">Ctrl+Enter</span>}
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
