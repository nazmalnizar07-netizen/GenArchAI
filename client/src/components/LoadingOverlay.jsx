import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoadingOverlay.css';

/**
 * Circular progress overlay with yellow fill, orbiting arrow, and percentage.
 *
 * @param {string}  message   – Status text below the circle
 * @param {boolean} visible   – Show / hide
 * @param {number}  progress  – 0-100 explicit progress (if provided, overrides auto-simulation)
 * @param {number}  duration  – Estimated duration in seconds (default 20). Used to simulate progress when no explicit progress is provided.
 */
export default function LoadingOverlay({
    message = 'Generating your design...',
    visible = true,
    progress: externalProgress,
    duration = 20,
}) {
    const [simulated, setSimulated] = useState(0);

    // Auto-simulate progress when no explicit progress value is given
    useEffect(() => {
        if (!visible) { setSimulated(0); return; }
        if (externalProgress !== undefined) return; // skip simulation when controlled

        setSimulated(0);
        const start = Date.now();
        const tick = setInterval(() => {
            const elapsed = (Date.now() - start) / 1000;
            // Ease out curve: fast at start, slows down near 92%
            const pct = Math.min(92, 92 * (1 - Math.exp(-2.5 * elapsed / duration)));
            setSimulated(Math.round(pct));
        }, 200);
        return () => clearInterval(tick);
    }, [visible, externalProgress, duration]);

    // Jump to 100 briefly when going invisible (complete feel)
    useEffect(() => {
        if (!visible && (simulated > 5 || (externalProgress !== undefined && externalProgress > 5))) {
            setSimulated(100);
            const t = setTimeout(() => setSimulated(0), 400);
            return () => clearTimeout(t);
        }
    }, [visible]);

    const pct = externalProgress !== undefined ? externalProgress : simulated;

    // SVG circle math
    const size = 180;
    const stroke = 10;
    const r = (size - stroke) / 2;
    const circumference = 2 * Math.PI * r;
    const fillOffset = circumference - (pct / 100) * circumference;

    // Arrow orbit angle (follows progress)
    const arrowAngle = (pct / 100) * 360 - 90; // -90 to start at top

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="cp-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="cp-container">
                        {/* Orbiting arrow ring */}
                        <svg className="cp-orbit-ring" viewBox={`0 0 ${size + 30} ${size + 30}`}>
                            <g
                                style={{
                                    transform: `rotate(${arrowAngle}deg)`,
                                    transformOrigin: '50% 50%',
                                    transition: 'transform 0.3s ease-out',
                                }}
                            >
                                {/* Orbit path (thin arc) */}
                                <circle
                                    cx={(size + 30) / 2}
                                    cy={(size + 30) / 2}
                                    r={r + 12}
                                    fill="none"
                                    stroke="rgba(0,0,0,0.15)"
                                    strokeWidth="2"
                                    strokeDasharray={`${circumference * 0.7} ${circumference * 0.3}`}
                                />
                                {/* Arrow head */}
                                <polygon
                                    points={`${(size + 30) / 2},${(size + 30) / 2 - r - 18} ${(size + 30) / 2 + 7},${(size + 30) / 2 - r - 8} ${(size + 30) / 2 - 1},${(size + 30) / 2 - r - 10}`}
                                    fill="#333"
                                />
                            </g>
                        </svg>

                        {/* Main circle */}
                        <svg className="cp-circle" viewBox={`0 0 ${size} ${size}`}>
                            {/* Background circle (light gray) */}
                            <circle
                                cx={size / 2} cy={size / 2}
                                r={r}
                                fill="#e8e8e8"
                                stroke="none"
                            />
                            {/* Yellow progress fill using clip path + arc */}
                            <defs>
                                <clipPath id="cp-clip">
                                    <circle cx={size / 2} cy={size / 2} r={r} />
                                </clipPath>
                            </defs>
                            {/* Yellow fill wedge */}
                            {pct > 0 && (
                                <path
                                    d={describeArc(size / 2, size / 2, r + 5, -90, -90 + (pct / 100) * 360)}
                                    fill="#f5c518"
                                    clipPath="url(#cp-clip)"
                                />
                            )}
                            {/* Subtle border */}
                            <circle
                                cx={size / 2} cy={size / 2}
                                r={r}
                                fill="none"
                                stroke="rgba(0,0,0,0.06)"
                                strokeWidth="2"
                            />
                        </svg>

                        {/* Percentage text */}
                        <div className="cp-pct">
                            <motion.span
                                key={pct}
                                initial={{ scale: 1.1, opacity: 0.7 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.15 }}
                            >
                                {pct}%
                            </motion.span>
                        </div>
                    </div>

                    <p className="cp-message">{message}</p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Create an SVG arc path that fills from startAngle to endAngle.
 * This draws a "pie wedge" from center to the arc.
 */
function describeArc(cx, cy, radius, startAngle, endAngle) {
    const clampedEnd = Math.min(endAngle, startAngle + 359.999);
    const start = polarToCartesian(cx, cy, radius, clampedEnd);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;

    return [
        'M', cx, cy,
        'L', start.x, start.y,
        'A', radius, radius, 0, largeArc, 0, end.x, end.y,
        'Z',
    ].join(' ');
}

function polarToCartesian(cx, cy, radius, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + radius * Math.cos(rad),
        y: cy + radius * Math.sin(rad),
    };
}
