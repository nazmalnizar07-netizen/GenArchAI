import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlineDownload, HiOutlineArrowLeft, HiOutlineSparkles, HiOutlineEye, HiOutlinePhotograph, HiOutlineCube } from 'react-icons/hi';
import toast from 'react-hot-toast';
import GlassCard from '../components/GlassCard';
import ScoreRadar from '../components/ScoreRadar';
import CostChart from '../components/CostChart';
import AICritique from '../components/AICritique';
import LoadingOverlay from '../components/LoadingOverlay';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../api/apiClient';
import './DesignView.css';

const VIEW_ANGLES = [
    { id: 'front', label: 'Front View', icon: '🏠' },
    { id: 'left', label: 'Left Side', icon: '◀️' },
    { id: 'right', label: 'Right Side', icon: '▶️' },
    { id: 'rear', label: 'Rear View', icon: '🔙' },
    { id: 'aerial', label: "Bird's Eye", icon: '🦅' },
];

export default function DesignView() {
    const location = useLocation();
    const navigate = useNavigate();
    const { design, config, sketchUrl, projectId } = location.state || {};
    const reportRef = useRef(null);

    const [savingMsg, setSavingMsg] = useState('');
    const [generatingView, setGeneratingView] = useState(null);
    const [allViews, setAllViews] = useState({});
    const [activeAngle, setActiveAngle] = useState(design?.viewAngle || 'front');
    const [pdfProgress, setPdfProgress] = useState(0);
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const [pdfMsg, setPdfMsg] = useState('');

    // Initialize with the primary view
    useEffect(() => {
        if (design) {
            setAllViews({
                [design.viewAngle || 'front']: {
                    imageUrl: design.imageUrl,
                    metadata: design.metadata,
                }
            });

            // Load other views if plan exists
            if (design.planId) {
                loadPlanViews(design.planId);
            }
        }
    }, [design]);

    const loadPlanViews = async (planId) => {
        try {
            const data = await api.get(`/plan/${planId}/views`);
            if (data.views && data.views.length > 0) {
                const viewMap = {};
                data.views.forEach(v => {
                    viewMap[v.view_angle || 'front'] = {
                        imageUrl: v.image_url,
                        metadata: v.metadata,
                    };
                });
                setAllViews(viewMap);
            }
        } catch (err) {
            console.warn('Could not load plan views:', err);
        }
    };

    const generateView = async (viewAngle) => {
        setGeneratingView(viewAngle);
        try {
            const data = await api.post('/generate-view', {
                planId: design.planId,
                projectId,
                viewAngle,
                prompt: config?.prompt || '',
                style: config?.style || 'modern',
                area: config?.area || 1000,
                floors: config?.floors || 1,
                rooms: config?.rooms || 3,
                qualityLevel: config?.qualityLevel || 'standard',
                budget: config?.budget ?? 5000000,
                sketchUrl: design.sketchUrl || sketchUrl,
            });

            if (data.success) {
                setAllViews(prev => ({
                    ...prev,
                    [viewAngle]: {
                        imageUrl: data.view.imageUrl,
                        metadata: data.view.metadata,
                    }
                }));
            }
        } catch (err) {
            console.error('Failed to generate view:', err);
        } finally {
            setGeneratingView(null);
        }
    };

    const downloadPDF = async () => {
        if (!reportRef.current) return;
        setPdfGenerating(true);
        setPdfProgress(0);
        setPdfMsg('Initializing brochure engine...');

        try {
            // Helper: load image with rounded corners via canvas clipping
            const roundImage = async (src, cornerPx = 30) => {
                const img = document.createElement('img');
                img.crossOrigin = 'anonymous';
                img.src = src;
                await new Promise(r => { img.onload = r; img.onerror = r; });
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                const ctx = c.getContext('2d');
                const rd = cornerPx;
                ctx.beginPath();
                ctx.moveTo(rd, 0); ctx.lineTo(c.width - rd, 0);
                ctx.quadraticCurveTo(c.width, 0, c.width, rd);
                ctx.lineTo(c.width, c.height - rd);
                ctx.quadraticCurveTo(c.width, c.height, c.width - rd, c.height);
                ctx.lineTo(rd, c.height);
                ctx.quadraticCurveTo(0, c.height, 0, c.height - rd);
                ctx.lineTo(0, rd);
                ctx.quadraticCurveTo(0, 0, rd, 0);
                ctx.closePath(); ctx.clip();
                ctx.drawImage(img, 0, 0);
                return { data: c.toDataURL('image/png'), w: c.width, h: c.height };
            };

            // 1. Fetch structured AI descriptions (summary + bullet points)
            setPdfProgress(5);
            setPdfMsg('Generating AI descriptions...');
            const viewKeys = Object.keys(allViews);
            const viewLabels = viewKeys.map(k => VIEW_ANGLES.find(v => v.id === k)?.label || k);
            let brochureData = {};
            try {
                const res = await api.post('/chat/brochure', {
                    style: config?.style || 'Modern', area: config?.area || 1000,
                    floors: config?.floors || 1, views: viewLabels,
                });
                if (res.brochureText) brochureData = res.brochureText;
            } catch (e) { console.warn('AI brochure text unavailable', e); }

            setPdfProgress(20);
            setPdfMsg('Loading cost data...');

            // 2. Ensure breakdown data exists (recalculate via API if missing)
            let bdData = design.breakdown || {};
            if (!bdData || Object.keys(bdData).length === 0) {
                try {
                    const bdRes = await api.post('/estimate', {
                        area: config?.area || 1000, floors: config?.floors || 1,
                        rooms: config?.rooms || 3, qualityLevel: config?.qualityLevel || 'standard',
                        style: config?.style || 'modern',
                    });
                    if (bdRes.breakdown) bdData = bdRes.breakdown;
                } catch (e) { console.warn('Could not fetch breakdown', e); }
            }

            setPdfProgress(30);
            setPdfMsg('Building cover page...');
            await new Promise(r => setTimeout(r, 200));

            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const dark = '#111827';
            const blue = '#3b82f6';
            const gold = '#facc15';
            const lite = '#f3f4f6';
            const pdfCost = (v) => formatCost(v).replace(/\u20b9/g, 'Rs.');

            // COVER PAGE
            pdf.setFillColor(dark);
            pdf.rect(0, 0, pageW * 0.38, pageH, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(32);
            pdf.setFont('helvetica', 'bold');
            pdf.text(config?.name?.toUpperCase() || 'DESIGN PLAN', 18, 50, { maxWidth: pageW * 0.33, lineHeightFactor: 1.2 });

            pdf.setFillColor(gold);
            pdf.rect(18, 65, 45, 3, 'F');

            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            pdf.text('ARCHITECTURAL PROPOSAL', 18, 82);

            pdf.setFontSize(10);
            let sy = 95;
            ['Style: ' + (config?.style || 'Modern'), 'Area: ' + (config?.area || 1000) + ' sq ft', 'Floors: ' + (config?.floors || 1),
            'Budget: ' + pdfCost(config?.budget || design.costEstimate?.total), 'Date: ' + new Date().toLocaleDateString()
            ].forEach(s => { pdf.text(s, 18, sy); sy += 8; });

            // Sketch thumbnail on cover
            const sUrl = design.sketchUrl || sketchUrl;
            if (sUrl) {
                try {
                    const sk = await roundImage(sUrl, 20);
                    const skW = pageW * 0.25;
                    const skH = Math.min((sk.h * skW) / sk.w, 55);
                    pdf.setFontSize(9);
                    pdf.text('ORIGINAL SKETCH', 18, pageH - skH - 22);
                    pdf.addImage(sk.data, 'PNG', 18, pageH - skH - 15, skW, skH);
                } catch { /* skip */ }
            }

            // Primary image with rounded corners
            const primaryImg = allViews[activeAngle]?.imageUrl || design.imageUrl;
            if (primaryImg) {
                try {
                    const pi = await roundImage(primaryImg, 40);
                    const piW = pageW * 0.55;
                    const piH = (pi.h * piW) / pi.w;
                    pdf.addImage(pi.data, 'PNG', pageW * 0.42, Math.max((pageH - piH) / 2, 15), piW, piH);
                } catch { /* skip */ }
            }

            // VIEW PAGES
            const viewEntries = Object.entries(allViews);
            for (let vi = 0; vi < viewEntries.length; vi++) {
                const [angle, vd] = viewEntries[vi];
                const vLabel = VIEW_ANGLES.find(v => v.id === angle)?.label || angle.toUpperCase();

                // Progress: views span 30% - 80%
                const viewPct = 30 + Math.round(((vi + 1) / viewEntries.length) * 50);
                setPdfProgress(viewPct);
                setPdfMsg('Rendering ' + vLabel + '...');

                pdf.addPage();

                // Header strip
                pdf.setFillColor(dark);
                pdf.rect(0, 0, pageW, 22, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text(vLabel.toUpperCase(), 20, 15);
                pdf.setFillColor(gold);
                pdf.rect(20, 22, 50, 2, 'F');

                const isLeft = vi % 2 === 0;
                try {
                    const vImg = await roundImage(vd.imageUrl, 30);
                    const vW = pageW * 0.52;
                    const vH = Math.min((vImg.h * vW) / vImg.w, pageH - 50);
                    const vX = isLeft ? 15 : pageW - vW - 15;
                    pdf.addImage(vImg.data, 'PNG', vX, 34, vW, vH);

                    // Text column
                    const tpX = isLeft ? vX + vW + 12 : 15;
                    const tpW = pageW - vW - 42;

                    // Find matching AI data
                    const lk = vLabel.toLowerCase();
                    const dk = Object.keys(brochureData).find(k => lk.includes(k) || k.includes(lk));
                    const aiD = brochureData[dk];

                    let summary, points;
                    if (aiD && typeof aiD === 'object' && aiD.summary) {
                        summary = aiD.summary; points = aiD.points || [];
                    } else if (typeof aiD === 'string') {
                        summary = aiD; points = [];
                    } else {
                        summary = 'This ' + vLabel + ' showcases the ' + (config?.style || 'modern') + ' architectural language with balanced proportions and refined detailing.';
                        points = ['Clean structural lines with contemporary finishes', 'Optimized fenestration for natural light', 'Harmonious landscape integration'];
                    }

                    pdf.setTextColor(dark);
                    pdf.setFontSize(16);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Design Features', tpX, 42);
                    pdf.setFillColor(blue);
                    pdf.rect(tpX, 46, 30, 1.5, 'F');

                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(summary, tpX, 56, { maxWidth: tpW, lineHeightFactor: 1.5 });
                    const sLines = pdf.splitTextToSize(summary, tpW).length;
                    let tpY = 56 + sLines * 6 + 8;

                    // Bullet points
                    pdf.setFontSize(10);
                    points.forEach(pt => {
                        pdf.setFont('helvetica', 'bold');
                        pdf.setTextColor(blue);
                        pdf.text('>', tpX, tpY);
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(dark);
                        pdf.text(pt, tpX + 5, tpY, { maxWidth: tpW - 5, lineHeightFactor: 1.4 });
                        const pL = pdf.splitTextToSize(pt, tpW - 5).length;
                        tpY += pL * 5 + 4;
                    });
                } catch { /* skip */ }
            }

            // BUDGET PAGE
            setPdfProgress(85);
            setPdfMsg('Building budget analysis...');
            pdf.addPage();
            pdf.setFillColor(dark);
            pdf.rect(0, 0, pageW, 22, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('BUDGET ANALYSIS', 20, 15);
            pdf.setFillColor(gold);
            pdf.rect(20, 22, 50, 2, 'F');

            // Total
            pdf.setTextColor(dark);
            pdf.setFontSize(13);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Total Construction Estimate', 20, 36);
            pdf.setFontSize(28);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(blue);
            pdf.text(pdfCost(design.costEstimate?.total), 20, 50);

            // Cost cards
            const cardY = 60;
            const cardH = 22;
            const cardGap = 6;
            const cardW = (pageW - 40 - cardGap * 3) / 4;
            [
                { l: 'Material Cost', v: pdfCost(design.costEstimate?.materials) },
                { l: 'Labor Cost', v: pdfCost(design.costEstimate?.labor) },
                { l: 'Quality', v: (config?.qualityLevel || 'Standard').toUpperCase() },
                { l: 'Rate / sqft', v: pdfCost((design.costEstimate?.total || 0) / (config?.area || 1000)) },
            ].forEach((item, idx) => {
                const cx = 20 + idx * (cardW + cardGap);
                pdf.setFillColor(lite);
                pdf.roundedRect(cx, cardY, cardW, cardH, 2, 2, 'F');
                pdf.setTextColor(120, 120, 120);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text(item.l, cx + 4, cardY + 9);
                pdf.setTextColor(dark);
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'bold');
                pdf.text(item.v, cx + 4, cardY + 17);
            });

            // Breakdown table
            const tblX = 20;
            const tblW = pageW - 40;
            let tblY = cardY + cardH + 16;
            pdf.setTextColor(dark);
            pdf.setFontSize(13);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Detailed Cost Breakdown', tblX, tblY);
            tblY += 10;

            // Table header
            pdf.setFillColor(dark);
            pdf.rect(tblX, tblY - 5, tblW, 10, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Category', tblX + 5, tblY + 1);
            pdf.text('Amount', tblX + tblW * 0.55, tblY + 1);
            pdf.text('%', tblX + tblW * 0.78, tblY + 1);
            pdf.text('Share', tblX + tblW * 0.88, tblY + 1);
            tblY += 10;

            const totalCost = design.costEstimate?.total || 1;
            const bdEntries = bdData ? Object.entries(bdData).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a) : [];

            if (bdEntries.length > 0) {
                bdEntries.forEach(([key, val], idx) => {
                    if (tblY + 9 > pageH - 20) { pdf.addPage(); tblY = 20; }
                    const cat = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const pct = ((val / totalCost) * 100).toFixed(1);
                    if (idx % 2 === 0) { pdf.setFillColor(lite); pdf.rect(tblX, tblY - 5, tblW, 9, 'F'); }

                    // Percentage bar
                    const barW = Math.max((val / totalCost) * tblW * 0.10, 1);
                    pdf.setFillColor(blue);
                    pdf.roundedRect(tblX + tblW * 0.88, tblY - 3, barW, 5, 1, 1, 'F');

                    pdf.setTextColor(dark);
                    pdf.setFontSize(9);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(cat, tblX + 5, tblY);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(pdfCost(val), tblX + tblW * 0.55, tblY);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(pct + '%', tblX + tblW * 0.78, tblY);
                    tblY += 9;
                });

                // Total row
                tblY += 2;
                pdf.setFillColor(dark);
                pdf.rect(tblX, tblY - 5, tblW, 10, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('TOTAL', tblX + 5, tblY + 1);
                pdf.text(pdfCost(totalCost), tblX + tblW * 0.55, tblY + 1);
                pdf.text('100%', tblX + tblW * 0.78, tblY + 1);
            } else {
                pdf.setTextColor(150, 150, 150);
                pdf.setFontSize(10);
                pdf.text('Detailed breakdown not available. Generate a new design to populate.', tblX, tblY);
            }

            // Footer
            const totalPages = pdf.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                pdf.setFontSize(8);
                pdf.setTextColor(160, 160, 160);
                pdf.text('GenArchAI Brochure  |  Page ' + p + ' of ' + totalPages, pageW / 2, pageH - 8, { align: 'center' });
            }

            setPdfProgress(95);
            setPdfMsg('Saving PDF...');
            pdf.save((config?.name || 'GenArchAI').replace(/\s+/g, '_') + '_Brochure.pdf');
            setPdfProgress(100);
            setPdfMsg('Done!');
            toast.success('Brochure PDF saved!');
            setTimeout(() => { setPdfGenerating(false); setPdfProgress(0); }, 800);
        } catch (error) {
            console.error('Failed to generate PDF', error);
            toast.error('Failed to generate PDF');
            setPdfGenerating(false);
            setPdfProgress(0);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                downloadPDF();
            }
            if (e.key === 'Escape') {
                navigate(-1);
            }
            // Arrow keys to navigate views
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const angles = VIEW_ANGLES.map(v => v.id);
                const currentIdx = angles.indexOf(activeAngle);
                if (e.key === 'ArrowLeft' && currentIdx > 0) {
                    const prev = angles[currentIdx - 1];
                    if (allViews[prev]) setActiveAngle(prev);
                }
                if (e.key === 'ArrowRight' && currentIdx < angles.length - 1) {
                    const next = angles[currentIdx + 1];
                    if (allViews[next]) setActiveAngle(next);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeAngle, allViews]);

    if (!design) {
        return (
            <div className="page">
                <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
                    <h2>No Design Generated</h2>
                    <p style={{ marginTop: 12 }}>Open a project and generate a design from the workspace.</p>
                    <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: 24 }}>Go to Dashboard</Link>
                </div>
            </div>
        );
    }

    const formatCost = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);
    const primaryAngleInfo = VIEW_ANGLES.find(v => v.id === activeAngle);
    const generatedViewCount = Object.keys(allViews).length;

    return (
        <div className="page">
            <LoadingOverlay visible={!!generatingView} message={`Generating ${VIEW_ANGLES.find(v => v.id === generatingView)?.label || 'view'}...`} />
            <LoadingOverlay visible={pdfGenerating} progress={pdfProgress} message={pdfMsg} />
            <div className="container">
                <div ref={reportRef} style={{ padding: '20px', margin: '-20px', borderRadius: '16px', background: 'var(--bg-primary)' }}>
                    {/* Header */}
                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <button
                                className="btn btn-ghost"
                                style={{ marginBottom: 16, gap: 6 }}
                                onClick={() => navigate(-1)}
                                data-html2canvas-ignore="true"
                            >
                                <HiOutlineArrowLeft size={16} /> Back to Project
                            </button>
                            <h1 className="tech-title" style={{ fontSize: '3rem' }}>{config?.name || 'Your Generated Design'}</h1>
                            <p className="tech-subtitle">{config?.style || 'Modern'} style • {config?.area || 1000} sq ft • {config?.floors || 1} floors</p>
                            <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Generated on {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="design-actions-header" data-html2canvas-ignore="true" style={{ display: 'flex', gap: '12px', marginTop: '32px', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn btn-primary hover-pop" onClick={() => navigate(-1)}>
                                    <HiOutlineArrowLeft size={16} /> Back
                                </button>
                                <button className="btn btn-secondary hover-pop" onClick={downloadPDF} disabled={!!savingMsg}>
                                    <HiOutlineDownload size={16} /> {savingMsg || 'Save as PDF'}
                                </button>
                            </div>
                            <div className="design-shortcuts-hint">
                                <span className="shortcut-key">Ctrl+S Save</span>
                                <span className="shortcut-key">Esc Back</span>
                                <span className="shortcut-key">← → Views</span>
                            </div>
                        </div>
                    </div>

                    {/* Sketch + Primary View Hero */}
                    <div className="design-hero-section">
                        {/* Sketch side */}
                        {(design.sketchUrl || sketchUrl) && (
                            <div className="design-hero-sketch">
                                <div className="card sketch-card">
                                    <div className="sketch-card-header">
                                        <HiOutlinePhotograph size={18} />
                                        <span>Original Sketch</span>
                                    </div>
                                    <img src={design.sketchUrl || sketchUrl} alt="Original Sketch" className="sketch-image" />
                                </div>
                            </div>
                        )}

                        {/* Primary generated view */}
                        <div className="design-hero-primary">
                            <div className="card card-flush primary-view-card">
                                <div className="primary-view-header">
                                    <HiOutlineEye size={18} />
                                    <span>{primaryAngleInfo?.label || 'Generated View'}</span>
                                    <span className="view-badge">{primaryAngleInfo?.icon}</span>
                                </div>
                                <motion.img
                                    key={activeAngle} // Re-animate when changing angle
                                    src={allViews[activeAngle]?.imageUrl || design.imageUrl}
                                    alt={`${primaryAngleInfo?.label} Design`}
                                    className="design-image"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5 }}
                                />
                                {design.metadata?.isMock && (
                                    <div className="mock-badge">
                                        <span className="badge">SYS_DEMO_MODE — Add API key for real generation</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>



                    {/* Multi-View Grid */}
                    <div className="multi-view-section">
                        <div className="multi-view-header">
                            <h2>All Views <span className="view-count">{generatedViewCount} / {VIEW_ANGLES.length}</span></h2>
                            <p>Generate different perspectives of your architectural plan</p>
                        </div>
                        <div className="multi-view-grid">
                            {VIEW_ANGLES.map(angle => {
                                const viewData = allViews[angle.id];
                                const isGenerating = generatingView === angle.id;

                                return (
                                    <motion.div
                                        key={angle.id}
                                        className={`multi-view-card hover-pop ${viewData ? 'generated' : 'empty'} ${activeAngle === angle.id ? 'active' : ''}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: VIEW_ANGLES.indexOf(angle) * 0.05 }}
                                        onClick={() => viewData && setActiveAngle(angle.id)}
                                        style={{ cursor: viewData ? 'pointer' : 'default' }}
                                    >
                                        <div className="multi-view-card-header">
                                            <span className="multi-view-icon">{angle.icon}</span>
                                            <span className="multi-view-label">{angle.label}</span>
                                            {viewData && <span className="multi-view-check">✓</span>}
                                        </div>
                                        <div className="multi-view-card-body">
                                            {viewData ? (
                                                <img src={viewData.imageUrl} alt={angle.label} className="multi-view-image" />
                                            ) : (
                                                <div className="multi-view-placeholder">
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => generateView(angle.id)}
                                                        disabled={!!generatingView}
                                                    >
                                                        <HiOutlineSparkles size={14} />
                                                        {isGenerating ? 'Generating...' : `Generate ${angle.label}`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Design Details */}
                    <div className="design-layout">
                        {/* Left — Insights */}
                        <div className="design-main">
                            <div className="card tech-card insights-card">
                                <div className="tech-marker tech-marker-tl tech-marker-h tech-marker-v"></div>
                                <div className="tech-marker tech-marker-tr tech-marker-h tech-marker-v"></div>
                                <div className="tech-marker tech-marker-bl tech-marker-h tech-marker-v"></div>
                                <div className="tech-marker tech-marker-br tech-marker-h tech-marker-v"></div>

                                <div className="panel-header-alt">
                                    <span className="tech-id">[SYS_DATA_IN]</span>
                                    <h3 className="panel-title-alt">Design Insights</h3>
                                </div>
                                <div className="insights-grid">
                                    <div className="insight tech-box">
                                        <span className="insight-label">Rate per sq ft</span>
                                        <span className="insight-value">{formatCost(design.costEstimate?.total / ((config?.area || 1000) * (config?.floors || 1)))}</span>
                                    </div>
                                    <div className="insight tech-box">
                                        <span className="insight-label">Material Cost</span>
                                        <span className="insight-value">{formatCost(design.costEstimate?.materials)}</span>
                                    </div>
                                    <div className="insight tech-box">
                                        <span className="insight-label">Labor Cost</span>
                                        <span className="insight-value">{formatCost(design.costEstimate?.labor)}</span>
                                    </div>
                                    <div className="insight tech-box">
                                        <span className="insight-label">Generation Time</span>
                                        <span className="insight-value">{((design.metadata?.generationTime || 0) / 1000).toFixed(1)}s</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Critique Panel moved to left column to fill empty space */}
                            <div style={{ marginTop: 24 }} data-html2canvas-ignore="true">
                                <AICritique design={design} />
                            </div>
                        </div>

                        {/* Right — Cost + Scores */}
                        <div className="design-sidebar">
                            <div className="card tech-card" style={{ marginBottom: '24px' }}>
                                <div className="panel-header-alt">
                                    <span className="tech-id">[SYS_COST_EST]</span>
                                    <h3 className="panel-title-alt">Cost Estimate</h3>
                                </div>
                                <div className="total-cost">{formatCost(design.costEstimate?.total)}</div>
                                <CostChart breakdown={design.breakdown || {}} totalCost={design.costEstimate?.total || 0} />
                            </div>

                            <div className="card tech-card">
                                <div className="tech-marker tech-marker-tl tech-marker-h tech-marker-v"></div>
                                <div className="tech-marker tech-marker-tr tech-marker-h tech-marker-v"></div>
                                <div className="panel-header-alt">
                                    <span className="tech-id">[SYS_SCORE_RAD]</span>
                                    <h3 className="panel-title-alt">Design Scores</h3>
                                </div>
                                <div className="radar-container-tech">
                                    <ScoreRadar scores={design.scores || {}} />
                                </div>
                                <div className="scores-list">
                                    {Object.entries(design.scores || {}).map(([key, val]) => (
                                        <div key={key} className="score-row">
                                            <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                                            <div className="score-bar-wrap">
                                                <motion.div
                                                    className="score-bar"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${val}%` }}
                                                    transition={{ duration: 0.8, delay: 0.3 }}
                                                    style={{
                                                        background: val >= 70 ? 'var(--accent-vibrant-blue)' : val >= 40 ? 'var(--accent-vibrant-yellow)' : 'var(--accent-vibrant-red)',
                                                    }}
                                                />
                                            </div>
                                            <span className="tech-score-val">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
