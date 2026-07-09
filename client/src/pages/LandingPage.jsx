import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlineSparkles, HiOutlinePhotograph, HiOutlineCurrencyDollar, HiOutlineChatAlt2, HiOutlineLightningBolt, HiOutlineCube } from 'react-icons/hi';
import GlassCard from '../components/GlassCard';
import './LandingPage.css';

const features = [
    { icon: HiOutlineSparkles, title: 'AI Design Generation', desc: 'Transform text prompts into stunning architectural designs with AI', color: '#00d4ff' },
    { icon: HiOutlinePhotograph, title: 'Room Renovation', desc: 'Upload a room photo and reimagine it in any style instantly', color: '#a855f7' },
    { icon: HiOutlineCurrencyDollar, title: 'Cost Estimation', desc: 'Get detailed construction cost breakdowns with optimization tips', color: '#f59e0b' },
    { icon: HiOutlineChatAlt2, title: 'AI Architect Chat', desc: 'Chat with an AI architect that understands your project context', color: '#10b981' },
    { icon: HiOutlineLightningBolt, title: 'Budget Optimizer', desc: 'Reduce costs intelligently without sacrificing design quality', color: '#ec4899' },
    { icon: HiOutlineCube, title: 'Design Comparison', desc: 'Compare multiple designs side-by-side on cost and efficiency', color: '#6366f1' },
];

const styles = [
    { name: 'Modern', img: 'https://placehold.co/300x200/1a1a2e/00d4ff?text=Modern' },
    { name: 'Minimalist', img: 'https://placehold.co/300x200/1a1a2e/a855f7?text=Minimalist' },
    { name: 'Luxury', img: 'https://placehold.co/300x200/1a1a2e/f59e0b?text=Luxury' },
    { name: 'Industrial', img: 'https://placehold.co/300x200/1a1a2e/10b981?text=Industrial' },
    { name: 'Mediterranean', img: 'https://placehold.co/300x200/1a1a2e/ec4899?text=Mediterranean' },
    { name: 'Futuristic', img: 'https://placehold.co/300x200/1a1a2e/6366f1?text=Futuristic' },
];

export default function LandingPage() {
    return (
        <div className="landing-page">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-graphic transition-graphic">
                    <div className="transition-graphic-inner">
                        <img src="/assets/hero-lineart.png" alt="Blueprint Sketch" className="img-blueprint" />
                        <img src="/assets/hero-3d.png" alt="3D Architectural Render" className="img-render" />
                    </div>
                </div>

                <div className="hero-content">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        GENARCHAI <br />
                        <span className="hero-highlight">AI ARCHITECTURE</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        A complete AI-powered architecture studio at your fingertips. Transform text prompts and simple sketches into stunning architectural designs.
                    </motion.p>

                    <motion.div
                        className="hero-actions"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <Link to="/dashboard" className="btn btn-primary btn-lg">START A PROJECT</Link>
                        <Link to="/dashboard" className="btn btn-secondary btn-lg">VIEW MY PROJECTS</Link>
                    </motion.div>

                    <motion.div
                        className="hero-stats"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <div className="stat-item">
                            <span className="stat-value">MES</span>
                            <span className="stat-label">College</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">4</span>
                            <span className="stat-label">Team Members</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">AI</span>
                            <span className="stat-label">Powered</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="container">
                    <div className="section-header">
                        <h2>SYSTEM MODULES</h2>
                        <p>A complete toolkit for generative floor planning, 3D visualization, and detailed cost analysis.</p>
                    </div>

                    <div className="features-grid">
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                className="feature-card"
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className="feature-icon">
                                    <feature.icon size={32} />
                                </div>
                                <h3>{feature.title}</h3>
                                <p>{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>BUILD YOUR DREAM DESIGN</h2>
                        <p>Stop imagining and start generating realistic architectural plans today.</p>
                        <Link to="/dashboard" className="btn btn-primary btn-lg">LAUNCH STUDIO NOW</Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <span className="logo-text"><h3>GENARCHAI</h3></span>
                            <p>An AI-powered platform for generative architectural design. Presented by Ameen Ali, Farah Fahmi, Fathima Sana, Gayathri Krishna.</p>
                            <p style={{ marginTop: '12px' }}>Guided By: Mr. Sherikh K K</p>
                        </div>
                        <div className="footer-links">
                            <h4>Platform</h4>
                            <ul>
                                <li><Link to="/dashboard">Dashboard</Link></li>
                                <li><Link to="/renovate">Renovation Studio</Link></li>
                                <li><Link to="/budget">Budget Optimizer</Link></li>
                            </ul>
                        </div>
                        <div className="footer-links">
                            <h4>System</h4>
                            <ul>
                                <li><a href="#">Status: Online</a></li>
                                <li><a href="#">Version 1.5</a></li>
                                <li><a href="#">Documentation</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>© 2026 GenArchAI. MES FINAL YEAR PROJECT.</p>
                        <div className="footer-portfolio">
                            Crafted by{' '}
                            <a href="https://naveenp7.vercel.app" target="_blank" rel="noopener noreferrer">------</a>
                            {' '} & {' '}
                            <a href="https://senin.in" target="_blank" rel="noopener noreferrer">----</a>
                        </div>
                        <p>BUILT WITH GUIDO_OS</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
