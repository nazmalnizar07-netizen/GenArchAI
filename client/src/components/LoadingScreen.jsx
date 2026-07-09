import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoadingScreen.css';

const statusMessages = [
    "INITIALIZING ARCHITECTURAL ENGINE...",
    "LOADING VOXEL GRID...",
    "MAPPING TOPOLOGY...",
    "GENERATING WIREFRAME MESH...",
    "CALIBRATING LIGHTING ENGINE...",
    "SYNCHRONIZING SYSTEM CLOCK...",
    "READY FOR ARCHITECTURAL COMMAND."
];

const LoadingScreen = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setTimeout(onComplete, 500);
                    return 100;
                }
                return prev + 1;
            });
        }, 30);

        const messageInterval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % statusMessages.length);
        }, 600);

        return () => {
            clearInterval(timer);
            clearInterval(messageInterval);
        };
    }, [onComplete]);

    return (
        <motion.div
            className="loading-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="loading-content">
                <div className="loading-icon-wrap">🏢</div>
                <h2>PROCESSING DESIGN</h2>

                <div className="loading-progress-container">
                    <motion.div
                        className="loading-progress-bar"
                        animate={{ width: `${progress}%` }}
                    />
                </div>

                <div className="loading-status">
                    [ {progress.toString().padStart(3, '0')} ] {statusMessages[messageIndex]}
                </div>
            </div>
        </motion.div>
    );
};

export default LoadingScreen;
