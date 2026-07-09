import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlinePaperAirplane, HiOutlineTrash, HiOutlineLightningBolt } from 'react-icons/hi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from '../components/GlassCard';
import api from '../api/apiClient';
import './ArchitectChat.css';

const quickActions = [
    { label: '💰 Reduce Cost', prompt: 'How can I reduce the construction cost of my building?' },
    { label: '✨ Add Luxury', prompt: 'What luxury features can I add to enhance my design?' },
    { label: '🌿 Make Eco-Friendly', prompt: 'How can I make my design more sustainable and eco-friendly?' },
    { label: '📐 Expand Space', prompt: 'How can I maximize and expand usable space in my building?' },
    { label: '🧱 Materials', prompt: 'What materials do you recommend for my building style and budget?' },
    { label: '🏗️ Design Tips', prompt: 'What design best practices should I follow for my project?' },
];

export default function ArchitectChat({ projectId: propProjectId, project: propProject, embedded }) {
    const location = useLocation();
    const incoming = location.state || {};
    const [searchParams] = useSearchParams();
    const projectId = propProjectId || searchParams.get('project');

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `## 👋 Welcome to GenArchAI Chat!

I'm your AI architectural assistant. I can help you with:

- **Design suggestions** and recommendations
- **Cost estimation** and budget optimization
- **Material selection** and comparisons
- **Renovation ideas** and style guidance
- **Sustainability** features and green building

What would you like to discuss today?`
        }
    ]);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showContext, setShowContext] = useState(false); // default collapsed for more chat space
    const [context, setContext] = useState({
        projectName: propProject?.name || incoming.config?.name || 'My Project',
        area: propProject?.area || incoming.config?.area || 1500,
        floors: propProject?.floors || incoming.config?.floors || 2,
        style: propProject?.style || incoming.config?.style || 'modern',
        budget: propProject?.budget || incoming.config?.budget || 1500000,
        qualityLevel: propProject?.quality_level || incoming.config?.qualityLevel || 'standard',
        rooms: propProject?.rooms || incoming.config?.rooms || 4,
    });

    useEffect(() => {
        if (projectId && !propProject) {
            api.get(`/projects/${projectId}`).then(data => {
                if (data.project) {
                    setContext({
                        projectName: data.project.name,
                        area: data.project.area,
                        floors: data.project.floors,
                        style: data.project.style,
                        budget: data.project.budget,
                        qualityLevel: data.project.quality_level || 'standard',
                        rooms: data.project.rooms
                    });
                }
            }).catch(e => console.error(e));
        }
    }, [projectId]);

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text = input) => {
        if (!text.trim() || loading) return;

        const userMsg = { role: 'user', content: text.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const data = await api.post('/chat', {
                message: text.trim(),
                context,
            });

            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = async () => {
        setMessages([{
            role: 'assistant',
            content: '## 🔄 Chat cleared!\n\nHow can I help you with your architectural project?'
        }]);
        try { await api.delete('/chat/default'); } catch { }
    };

    return (
        <div className="page chat-page">
            <div className="chat-layout">
                {/* Main Chat */}
                <div className="chat-main">
                    <div className="chat-header">
                        <div className="chat-header-info" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="ai-avatar">🏗️</div>
                            <div>
                                <h2>AI Architect</h2>
                                <p className={`chat-status ${loading ? 'typing' : 'online'}`}>
                                    {loading ? 'Thinking...' : 'Online'}
                                </p>
                            </div>
                        </div>
                        <div className="chat-header-actions">
                            <button className="context-toggle-btn" onClick={() => setShowContext(!showContext)}>
                                <HiOutlineLightningBolt size={16} />
                                {showContext ? 'Hide Context' : 'Show Context'}
                            </button>
                            <button className="btn btn-primary" onClick={clearChat} style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HiOutlineTrash size={16} /> Clear
                            </button>
                        </div>
                    </div>

                    <div className="chat-messages">
                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    className={`message ${msg.role}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {msg.role === 'assistant' && <div className="message-avatar">🏗️</div>}
                                    <div className="message-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                    {msg.role === 'user' && <div className="message-avatar user-avatar">👤</div>}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {loading && (
                            <motion.div className="message assistant" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div className="message-avatar">🏗️</div>
                                <div className="message-content typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </motion.div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Quick Actions */}
                    <div className="quick-actions" style={{ display: 'flex', gap: '8px', padding: '16px 24px', overflowX: 'auto', borderTop: 'var(--border-width) solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                        {quickActions.map(action => (
                            <button
                                key={action.label}
                                className="btn btn-secondary"
                                onClick={() => sendMessage(action.prompt)}
                                disabled={loading}
                                style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '6px 12px' }}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="chat-input-area">
                        <div className="chat-form">
                            <textarea
                                ref={inputRef}
                                className="chat-input"
                                placeholder="Ask your AI architect anything..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                disabled={loading}
                            />
                            <button
                                className="chat-submit"
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                            >
                                <HiOutlinePaperAirplane size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel — Context */}
                <div className={`context-sidebar ${showContext ? 'expanded' : 'collapsed'}`}>
                    <div className="context-header">
                        <h3>Project Context</h3>
                    </div>
                    <div className="context-details">
                        <div className="context-item">
                            <span className="context-label">Style</span>
                            <span className="context-value">{context.style}</span>
                        </div>
                        <div className="context-item">
                            <span className="context-label">Area</span>
                            <span className="context-value">{context.area} sq ft</span>
                        </div>
                        <div className="context-item">
                            <span className="context-label">Floors</span>
                            <span className="context-value">{context.floors}</span>
                        </div>
                        <div className="context-item">
                            <span className="context-label">Rooms</span>
                            <span className="context-value">{context.rooms}</span>
                        </div>
                        <div className="context-item">
                            <span className="context-label">Budget</span>
                            <span className="context-value">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(context.budget || 0)}</span>
                        </div>
                        <div className="context-item">
                            <span className="context-label">Quality</span>
                            <span className="context-value">{context.qualityLevel}</span>
                        </div>
                    </div>

                    <div className="context-header" style={{ borderTop: 'var(--border-width) solid var(--border-color)' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineLightningBolt />
                            AI Tips
                        </h3>
                    </div>
                    <div className="context-details">
                        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            <li>Ask about specific materials for cost savings</li>
                            <li>Request sustainability recommendations</li>
                            <li>Get room layout optimization ideas</li>
                            <li>Compare architectural styles</li>
                            <li>Ask about construction phases</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
