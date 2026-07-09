import React from 'react';
import './Logo3D.css';

const Logo3D = ({ className = "" }) => {
    return (
        <div className={`logo-3d-container ${className}`}>
            <div className="wireframe-drawing">
                {/* Building Block 1 */}
                <div className="block b1">
                    <div className="side front"></div>
                    <div className="side back"></div>
                    <div className="side left"></div>
                    <div className="side right"></div>
                    <div className="side top"></div>
                </div>
                {/* Building Block 2 - Taller */}
                <div className="block b2">
                    <div className="side front"></div>
                    <div className="side back"></div>
                    <div className="side left"></div>
                    <div className="side right"></div>
                    <div className="side top"></div>
                </div>
                {/* Building Block 3 - Wide */}
                <div className="block b3">
                    <div className="side front"></div>
                    <div className="side back"></div>
                    <div className="side left"></div>
                    <div className="side right"></div>
                    <div className="side top"></div>
                </div>
                {/* Technical Annotation Line */}
                <div className="tech-line-h"></div>
                <div className="tech-line-v"></div>
                <div className="tech-label-mini">AXON_VIEW_v2</div>
            </div>
        </div>
    );
};

export default Logo3D;
