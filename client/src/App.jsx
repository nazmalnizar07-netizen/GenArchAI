import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import DesignView from './pages/DesignView';
import ProjectWorkspace from './pages/ProjectWorkspace';
import UploadDesign from './pages/UploadDesign';
import RenovationStudio from './pages/RenovationStudio';
import ArchitectChat from './pages/ArchitectChat';

function App() {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <Router>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: 'rgba(15, 15, 30, 0.95)',
                        color: '#e0e0e0',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                    },
                    success: { iconTheme: { primary: '#00d4ff', secondary: '#0f0f1e' } },
                    error: { iconTheme: { primary: '#ff4757', secondary: '#0f0f1e' }, duration: 5000 },
                }}
            />
            <AnimatePresence mode="wait">
                {isLoading && (
                    <LoadingScreen onComplete={() => setIsLoading(false)} />
                )}
            </AnimatePresence>

            {!isLoading && (
                <>
                    <Navbar />
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/design" element={<DesignView />} />
                        <Route path="/upload" element={<UploadDesign />} />
                        <Route path="/renovate" element={<RenovationStudio />} />
                        <Route path="/chat" element={<ArchitectChat />} />
                        <Route path="/project/:id" element={<ProjectWorkspace />} />
                    </Routes>
                </>
            )}
        </Router>
    );
}

export default App;
