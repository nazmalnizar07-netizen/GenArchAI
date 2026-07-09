import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineEye, HiOutlineTemplate, HiOutlineExclamation } from 'react-icons/hi';
import toast from 'react-hot-toast';
import GlassCard from '../components/GlassCard';
import api from '../api/apiClient';
import './Dashboard.css';

// ─── Budget Validation ───
// Minimum realistic construction rate in India: ~₹1,000/sqft (economy)
// With labor (30%) + contingency (8%): ~₹1,400/sqft all-in minimum
const MIN_RATE_PER_SQFT = 1400;
const formatINR = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// ─── Design Templates / Presets ───
const designTemplates = [
    { id: 'modern-villa', label: '🏡 Modern Villa', name: 'Modern Villa', style: 'modern', area: 2500, floors: 2, rooms: 5, budget: 8000000, description: 'Spacious modern villa with open layouts' },
    { id: '2bhk-apartment', label: '🏢 2BHK Apartment', name: '2BHK Modern Apartment', style: 'minimalist', area: 900, floors: 1, rooms: 3, budget: 2000000, description: 'Compact 2BHK with efficient space usage' },
    { id: 'farmhouse', label: '🌾 Farmhouse Villa', name: 'Farmhouse Villa', style: 'traditional', area: 3500, floors: 1, rooms: 6, budget: 6000000, description: 'Traditional farmhouse with large outdoor areas' },
    { id: 'luxury-penthouse', label: '✨ Luxury Penthouse', name: 'Luxury Penthouse', style: 'luxury', area: 2000, floors: 1, rooms: 4, budget: 12000000, description: 'High-end penthouse with premium finishes' },
    { id: 'eco-home', label: '🌿 Eco-Friendly Home', name: 'Sustainable Eco Home', style: 'futuristic', area: 1800, floors: 2, rooms: 4, budget: 7000000, description: 'Sustainable design with green building practices' },
    { id: 'studio', label: '🎨 Studio Apartment', name: 'Creative Studio', style: 'industrial', area: 600, floors: 1, rooms: 2, budget: 1500000, description: 'Open-plan industrial studio space' },
];

export default function Dashboard() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newProject, setNewProject] = useState({
        name: '', description: '', area: 1000, floors: 1, rooms: 3, style: 'modern', budget: 5000000
    });

    // ─── Budget feasibility check ───
    const budgetCheck = useMemo(() => {
        const totalArea = (newProject.area || 0) * (newProject.floors || 1);
        const minCostForArea = totalArea * MIN_RATE_PER_SQFT;
        const maxAffordableArea = Math.floor((newProject.budget || 0) / (MIN_RATE_PER_SQFT * (newProject.floors || 1)));
        const isOverBudget = newProject.budget > 0 && totalArea > 0 && minCostForArea > newProject.budget;
        return { isOverBudget, maxAffordableArea, minCostForArea, totalArea };
    }, [newProject.area, newProject.floors, newProject.budget]);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const data = await api.get('/projects');
            setProjects(data.projects || []);
        } catch (err) {
            console.error('Failed to load projects:', err);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const createProject = async () => {
        if (!newProject.name.trim()) {
            toast.error('Please enter a project name');
            return;
        }
        if (budgetCheck.isOverBudget) {
            toast.error(`Area too large for this budget. Max ${budgetCheck.maxAffordableArea} sq ft per floor.`);
            return;
        }
        try {
            const data = await api.post('/projects', newProject);
            setProjects([data.project, ...projects]);
            setShowCreate(false);
            setNewProject({ name: '', description: '', area: 1000, floors: 1, rooms: 3, style: 'modern', budget: 5000000 });
            toast.success(`Project "${data.project.name}" created!`);
        } catch (err) {
            console.error('Failed to create project:', err);
            toast.error('Failed to create project');
        }
    };

    const applyTemplate = (template) => {
        setNewProject({
            name: template.name,
            description: template.description,
            area: template.area,
            floors: template.floors,
            rooms: template.rooms,
            style: template.style,
            budget: template.budget,
        });
        setShowCreate(true);
        toast.success(`Template "${template.label}" applied!`);
    };

    const deleteProject = async (id) => {
        try {
            await api.delete(`/projects/${id}`);
            setProjects(projects.filter(p => p.id !== id));
            toast.success('Project deleted');
        } catch (err) {
            console.error('Failed to delete project:', err);
            toast.error('Failed to delete project');
        }
    };

    return (
        <div className="page dashboard-page">
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <div>
                        <h1>MY PROJECTS</h1>
                        <p>Manage your architectural designs and projects</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
                        <HiOutlinePlus size={18} />
                        NEW PROJECT
                    </button>
                </div>

                {/* Design Templates */}
                {!showCreate && (
                    <div className="templates-section">
                        <h3 className="section-title">
                            <HiOutlineTemplate size={20} />
                            QUICK START TEMPLATES
                        </h3>
                        <div className="templates-grid">
                            {designTemplates.map(t => (
                                <motion.button
                                    key={t.id}
                                    className="template-card"
                                    onClick={() => applyTemplate(t)}
                                    whileHover={{ y: -4, boxShadow: '6px 6px 0 0 #000' }}
                                    whileTap={{ y: 0, boxShadow: '2px 2px 0 0 #000' }}
                                >
                                    <span className="template-emoji">{t.label.split(' ')[0]}</span>
                                    <span className="template-name">{t.label.split(' ').slice(1).join(' ')}</span>
                                    <span className="template-desc">{t.area} sqft • {t.rooms} rooms</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Create Project Form */}
                {showCreate && (
                    <motion.div
                        className="create-form-container"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <div className="create-form">
                            <h3>INITIALIZE PROJECT</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Project Name</label>
                                    <input className="input" placeholder="e.g. Modern Lake House" value={newProject.name}
                                        onChange={e => setNewProject({ ...newProject, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Style</label>
                                    <select className="input" value={newProject.style}
                                        onChange={e => setNewProject({ ...newProject, style: e.target.value })}>
                                        <option value="modern">Modern</option>
                                        <option value="minimalist">Minimalist</option>
                                        <option value="luxury">Luxury</option>
                                        <option value="industrial">Industrial</option>
                                        <option value="traditional">Traditional</option>
                                        <option value="futuristic">Futuristic</option>
                                        <option value="mediterranean">Mediterranean</option>
                                        <option value="colonial">Colonial</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Area (sq ft) {budgetCheck.isOverBudget && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>⚠ Max {budgetCheck.maxAffordableArea} sq ft</span>}</label>
                                    <input className={`input ${budgetCheck.isOverBudget ? 'input-error' : ''}`} type="number" value={newProject.area}
                                        onChange={e => setNewProject({ ...newProject, area: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Budget (₹)</label>
                                    <input className="input" type="number" value={newProject.budget}
                                        onChange={e => setNewProject({ ...newProject, budget: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Floors</label>
                                    <input className="input" type="number" min="1" max="10" value={newProject.floors}
                                        onChange={e => setNewProject({ ...newProject, floors: Number(e.target.value) })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Rooms</label>
                                    <input className="input" type="number" min="1" max="20" value={newProject.rooms}
                                        onChange={e => setNewProject({ ...newProject, rooms: Number(e.target.value) })} />
                                </div>
                            </div>

                            {/* Budget feasibility warning */}
                            {budgetCheck.isOverBudget && (
                                <div className="budget-warning">
                                    <HiOutlineExclamation size={20} />
                                    <div>
                                        <strong>Budget too low for this area</strong>
                                        <p>A {newProject.area} sq ft × {newProject.floors} floor home needs at least <strong>{formatINR(budgetCheck.minCostForArea)}</strong> (economy). Reduce area to <strong>{budgetCheck.maxAffordableArea} sq ft</strong> per floor, or increase budget.</p>
                                    </div>
                                </div>
                            )}

                            <div className="form-actions">
                                <button className="btn btn-primary" onClick={createProject} disabled={budgetCheck.isOverBudget}>
                                    {budgetCheck.isOverBudget ? 'ADJUST AREA OR BUDGET' : 'CREATE PROJECT'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>CANCEL</button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Projects Grid */}
                {loading ? (
                    <div className="projects-grid">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton" style={{ height: 280, background: '#fff', border: '3px solid #000' }} />
                        ))}
                    </div>
                ) : (
                    <div className="projects-grid">
                        {projects.map((project, i) => (
                            <motion.div
                                key={project.id}
                                className="project-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className="project-thumbnail">
                                    <img src={project.thumbnail} alt={project.name} />
                                    <span className={`badge ${project.status === 'active' ? 'badge-green' : 'badge-orange'}`} style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                        {project.status || 'DRAFT'}
                                    </span>
                                </div>
                                <div className="project-info">
                                    <h3>{project.name}</h3>
                                    <p>{project.description || `${project.style} style • ${project.area} sq ft • ${project.floors} floors`}</p>
                                    <div className="project-meta">
                                        <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(project.budget || 0)}</span>
                                        <span>{project.rooms} rooms</span>
                                    </div>
                                </div>
                                <div className="project-actions">
                                    <Link to={`/project/${project.id}`} className="btn btn-primary" style={{ flex: 1 }}>
                                        <HiOutlineEye size={18} /> OPEN
                                    </Link>
                                    <button className="btn btn-secondary" onClick={() => deleteProject(project.id)} style={{ flex: '0 0 48px' }}>
                                        <HiOutlineTrash size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
