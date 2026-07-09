import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineHome, HiOutlineViewGrid, HiOutlineUpload, HiOutlineSparkles, HiOutlineChatAlt2, HiOutlineCurrencyDollar, HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import './Navbar.css';

const navLinks = [
    { path: '/', label: 'Home', icon: HiOutlineHome },
    { path: '/dashboard', label: 'My Projects', icon: HiOutlineViewGrid },
];

export default function Navbar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Hide navbar completely when inside the workspace (sidebar acts as nav)
    if (location.pathname.startsWith('/project/')) return null;

    return (
        <nav className="navbar">
            <div className="navbar-inner">
                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <div className="logo-icon">
                        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="2" y="14" width="28" height="16" rx="2" stroke="#000" strokeWidth="2" />
                            <path d="M6 14V8L16 2L26 8V14" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
                            <rect x="12" y="20" width="8" height="10" rx="1" stroke="#000" strokeWidth="1.5" />
                            <line x1="6" y1="18" x2="26" y2="18" stroke="#000" strokeWidth="1" opacity="0.5" />
                        </svg>
                    </div>
                    <span className="logo-text">GenArch<span className="logo-ai">AI</span></span>
                </Link>

                {/* Desktop Nav */}
                <div className="navbar-links">
                    {navLinks.map(({ path, label, icon: Icon }) => (
                        <Link
                            key={path}
                            to={path}
                            className={`nav-link ${location.pathname === path ? 'active' : ''}`}
                        >
                            <span className="bracket">[</span>
                            <span>{label.toUpperCase()}</span>
                            <span className="bracket">]</span>
                        </Link>
                    ))}
                </div>

                {/* System Status */}
                <div className="system-status">
                    <span className="status-dot"></span>
                    <span className="status-text">SYS: ONLINE</span>
                </div>

                {/* CTA */}
                <div className="navbar-cta">
                    <Link to="/dashboard" className="btn btn-primary btn-sm">
                        START PROJECT
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
                    {mobileOpen ? <HiOutlineX size={24} /> : <HiOutlineMenu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        className="mobile-menu"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        {navLinks.map(({ path, label, icon: Icon }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`mobile-link ${location.pathname === path ? 'active' : ''}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                <Icon size={20} />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
