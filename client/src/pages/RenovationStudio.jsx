import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlineUpload, HiOutlineSparkles, HiOutlineArrowRight } from 'react-icons/hi';
import GlassCard from '../components/GlassCard';
import LoadingOverlay from '../components/LoadingOverlay';
import api from '../api/apiClient';
import './RenovationStudio.css';

const renovationStyles = [
    { id: 'modern', label: 'Modern', emoji: '🏢', color: '#00d4ff' },
    { id: 'minimalist', label: 'Minimalist', emoji: '◻️', color: '#a855f7' },
    { id: 'luxury', label: 'Luxury', emoji: '✨', color: '#f59e0b' },
    { id: 'industrial', label: 'Industrial', emoji: '⚙️', color: '#10b981' },
    { id: 'traditional', label: 'Traditional', emoji: '🏡', color: '#ec4899' },
];

export default function RenovationStudio({ projectId: propProjectId, project, embedded }) {
    const [searchParams] = useSearchParams();
    const projectId = propProjectId || searchParams.get('project');

    const [originalImage, setOriginalImage] = useState(null);
    const [originalUrl, setOriginalUrl] = useState(null);
    const [renovatedUrl, setRenovatedUrl] = useState(null);
    const [style, setStyle] = useState('modern');
    const [loading, setLoading] = useState(false);
    const [sliderPos, setSliderPos] = useState(50);
    const [prompt, setPrompt] = useState('');
    const sliderRef = useRef(null);

    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setOriginalImage(file);
            setOriginalUrl(URL.createObjectURL(file));
            setRenovatedUrl(null);
        }
    };

    const handleRenovate = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            if (originalImage) formData.append('image', originalImage);
            formData.append('style', style);
            formData.append('prompt', prompt);
            if (projectId) formData.append('projectId', projectId);

            const response = await fetch('/api/renovate', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (data.success) {
                setRenovatedUrl(data.renovatedUrl);
            }
        } catch (err) {
            console.error('Renovation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSlider = (e) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const pos = ((e.clientX - rect.left) / rect.width) * 100;
        setSliderPos(Math.max(5, Math.min(95, pos)));
    };

    return (
        <div className="page">
            <LoadingOverlay visible={loading} message="Renovating your room with AI..." />
            <div className="container">
                <div className="page-header">
                    <h1>Renovation Studio</h1>
                    <p>Upload a room photo and reimagine it in any architectural style</p>
                </div>

                {/* Style Selection */}
                <div className="reno-styles">
                    {renovationStyles.map(s => (
                        <motion.button
                            key={s.id}
                            className={`reno-style-btn ${style === s.id ? 'active' : ''}`}
                            onClick={() => setStyle(s.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={style === s.id ? { borderColor: s.color, boxShadow: `0 0 20px ${s.color}30` } : {}}
                        >
                            <span className="style-emoji">{s.emoji}</span>
                            <span>{s.label}</span>
                        </motion.button>
                    ))}
                </div>

                {/* Optional prompt */}
                <div className="reno-prompt">
                    <input
                        className="input"
                        placeholder="Optional: Describe specific changes (e.g. 'add plants, blue accent wall')"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                </div>

                {/* Comparison Area */}
                <div className="comparison-section">
                    {originalUrl && renovatedUrl ? (
                        /* Split comparison slider */
                        <div className="card comparison-card">
                            <div
                                className="comparison-slider"
                                ref={sliderRef}
                                onMouseMove={(e) => e.buttons === 1 && handleSlider(e)}
                                onClick={handleSlider}
                            >
                                <div className="comp-original" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                                    <img src={originalUrl} alt="Original" />
                                    <span className="comp-label comp-label-left">Original</span>
                                </div>
                                <div className="comp-renovated">
                                    <img src={renovatedUrl} alt="Renovated" />
                                    <span className="comp-label comp-label-right">{style}</span>
                                </div>
                                <div className="slider-handle" style={{ left: `${sliderPos}%` }}>
                                    <div className="slider-line" />
                                    <div className="slider-knob">⟺</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="comparison-panels">
                            {/* Original panel */}
                            <div className="card panel-card">
                                <h3>Original Room</h3>
                                {originalUrl ? (
                                    <img src={originalUrl} alt="Original" className="panel-image" />
                                ) : (
                                    <label className="upload-zone" htmlFor="room-upload">
                                        <HiOutlineUpload size={40} className="upload-icon" />
                                        <span>Upload your room photo</span>
                                        <span style={{ fontSize: '0.75rem' }}>JPG, PNG up to 10MB</span>
                                        <input id="room-upload" type="file" accept="image/*" hidden onChange={handleUpload} />
                                    </label>
                                )}
                            </div>

                            {/* Arrow */}
                            <div className="comparison-arrow">
                                <HiOutlineArrowRight size={32} />
                            </div>

                            {/* Renovated panel */}
                            <div className="card panel-card">
                                <h3>AI Renovation</h3>
                                {renovatedUrl ? (
                                    <img src={renovatedUrl} alt="Renovated" className="panel-image" />
                                ) : (
                                    <div className="panel-placeholder">
                                        <HiOutlineSparkles size={40} />
                                        <span>Renovated room will appear here</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Generate Button */}
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <motion.button
                        className="btn btn-primary btn-lg"
                        onClick={handleRenovate}
                        disabled={!originalUrl || loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ opacity: originalUrl ? 1 : 0.5 }}
                    >
                        <HiOutlineSparkles size={20} />
                        Renovate in {style.charAt(0).toUpperCase() + style.slice(1)} Style
                    </motion.button>
                </div>
            </div>
        </div>
    );
}
