import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineX, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlinePause, HiOutlinePlay } from 'react-icons/hi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/apiClient';
import './PresentationMode.css';

const quickActions = [
    { label: '💰 Reduce Cost', prompt: 'How can I reduce the construction cost?' },
    { label: '✨ Add Luxury', prompt: 'What luxury features can I add?' },
    { label: '🌿 Eco-Friendly', prompt: 'How can I make this more sustainable?' },
    { label: '📐 Expand Space', prompt: 'How can I maximize usable space?' },
    { label: '🧱 Materials', prompt: 'What materials do you recommend?' },
    { label: '🏗️ Best Practices', prompt: 'What design best practices apply here?' },
];

export default function PresentationMode({ designs, project, projectId, onClose }) {
    const [currentDesignIndex, setCurrentDesignIndex] = useState(0);
    const [isAutoPlay, setIsAutoPlay] = useState(true);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `## 👋 Welcome to GenArchAI Consultation!

I'm your AI architectural consultant. Ask me anything about:
- Design suggestions & recommendations
- Cost optimization & budget breakdown
- Materials & sustainability
- Renovation ideas & styling

What would you like to know about this project?`
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState({
        projectName: project?.name || 'My Project',
        area: project?.area || 1500,
        floors: project?.floors || 2,
        style: project?.style || 'modern',
        budget: project?.budget || 1500000,
        qualityLevel: project?.quality_level || 'standard',
        rooms: project?.rooms || 4,
    });

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const autoPlayTimer = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-advance slides
    useEffect(() => {
        if (isAutoPlay && designs.length > 0) {
            autoPlayTimer.current = setInterval(() => {
                setCurrentDesignIndex(prev => (prev + 1) % designs.length);
            }, 5000);
        }
        return () => clearInterval(autoPlayTimer.current);
    }, [isAutoPlay, designs.length]);

    const currentDesign = designs[currentDesignIndex];

    const nextDesign = () => {
        setCurrentDesignIndex(prev => (prev + 1) % designs.length);
    };

    const prevDesign = () => {
        setCurrentDesignIndex(prev => (prev - 1 + designs.length) % designs.length);
    };

    const sendMessage = async (text = input) => {
        if (!text.trim() || loading) return;

        const userMsg = { role: 'user', content: text.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const data = await api.post('/chat', {
                message: text.trim(),
                projectId,
                context: {
                    ...context,
                    currentDesignStyle: currentDesign?.style || context.style,
                    currentDesignPrompt: currentDesign?.prompt,
                },
            });

            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (err) {
            console.error('Chat error:', err);
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleQuickAction = (prompt) => {
        sendMessage(prompt);
    };

    if (designs.length === 0) {
        return (
            <div className="presentation-mode">
                <div className="presentation-empty">
                    <div className="empty-content">
                        <h2>No Designs Yet</h2>
                        <p>Generate some designs to showcase them in presentation mode.</p>
                    </div>
                    <button className="presentation-close" onClick={onClose}>
                        <HiOutlineX size={24} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="presentation-mode">
            {/* Main Slideshow Area */}
            <div className="presentation-main">
                {/* Header with Project Info */}
                <div className="presentation-header">
                    <motion.div
                        className="presentation-project-info"
                        key={`header-${currentDesignIndex}`}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1>{project.name}</h1>
                        <p>{project.description || `${project.style} style • ${project.area} sq ft • ${project.floors} floors`}</p>
                    </motion.div>

                    <div className="presentation-controls-top">
                        <button
                            className="presentation-btn presentation-play-btn"
                            onClick={() => setIsAutoPlay(!isAutoPlay)}
                            title={isAutoPlay ? 'Pause' : 'Play'}
                        >
                            {isAutoPlay ? <HiOutlinePause size={20} /> : <HiOutlinePlay size={20} />}
                        </button>
                        <button className="presentation-close" onClick={onClose}>
                            <HiOutlineX size={24} />
                        </button>
                    </div>
                </div>

                {/* Slideshow Area */}
                <div className="presentation-slideshow">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`design-${currentDesignIndex}`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.6 }}
                            className="presentation-slide"
                        >
                            {currentDesign?.image_url ? (
                                <img
                                    src={currentDesign.image_url}
                                    alt={currentDesign.prompt || 'Design'}
                                    className="presentation-image"
                                />
                            ) : (
                                <div className="presentation-placeholder">
                                    <span>No Image Available</span>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <button
                        className="presentation-nav-btn presentation-prev"
                        onClick={prevDesign}
                        aria-label="Previous design"
                    >
                        <HiOutlineChevronLeft size={32} />
                    </button>
                    <button
                        className="presentation-nav-btn presentation-next"
                        onClick={nextDesign}
                        aria-label="Next design"
                    >
                        <HiOutlineChevronRight size={32} />
                    </button>

                    {/* Slide Counter & Info */}
                    <div className="presentation-slide-info">
                        <motion.div
                            className="presentation-slide-details"
                            key={`details-${currentDesignIndex}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <h2>{currentDesign?.style || 'Design'} Style</h2>
                            <p>{currentDesign?.prompt || 'Professional architectural rendering'}</p>
                        </motion.div>

                        <div className="presentation-slide-counter">
                            <span>{currentDesignIndex + 1}</span>
                            <span>/</span>
                            <span>{designs.length}</span>
                        </div>
                    </div>

                    {/* Slide Dots */}
                    <div className="presentation-dots">
                        {designs.map((_, idx) => (
                            <button
                                key={idx}
                                className={`presentation-dot ${idx === currentDesignIndex ? 'active' : ''}`}
                                onClick={() => setCurrentDesignIndex(idx)}
                                aria-label={`Go to design ${idx + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Panel */}
            <div className="presentation-chat-panel">
                <div className="presentation-chat-header">
                    <h3>Ask GenArchAI</h3>
                </div>

                {/* Messages */}
                <div className="presentation-messages">
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className={`presentation-message ${msg.role}`}
                        >
                            <div className="presentation-message-content">
                                {msg.role === 'assistant' ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                ) : (
                                    <p>{msg.content}</p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="presentation-message assistant"
                        >
                            <div className="presentation-message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length === 1 && !loading && (
                    <div className="presentation-quick-actions">
                        {quickActions.map((action, idx) => (
                            <button
                                key={idx}
                                className="presentation-quick-btn"
                                onClick={() => handleQuickAction(action.prompt)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="presentation-input-area">
                    <div className="presentation-input-wrapper">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && !loading && sendMessage()}
                            placeholder="Ask about this design..."
                            disabled={loading}
                            className="presentation-input"
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={loading || !input.trim()}
                            className="presentation-send-btn"
                        >
                            →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
