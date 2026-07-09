import { motion } from 'framer-motion';

export default function GlassCard({ children, className = '', hover = true, glow = false, onClick, style }) {
    return (
        <motion.div
            className={`glass-card ${className}`}
            style={{
                padding: '24px',
                ...(glow && { boxShadow: 'var(--shadow-glow)' }),
                ...style,
            }}
            whileHover={hover ? { y: -4, borderColor: 'rgba(0, 212, 255, 0.3)' } : {}}
            whileTap={onClick ? { scale: 0.98 } : {}}
            onClick={onClick}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {children}
        </motion.div>
    );
}
