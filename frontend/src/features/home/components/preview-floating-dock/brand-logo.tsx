import React from 'react';

// ============================================================================
// BRAND LOGO COMPONENT
// ============================================================================
// A pie-chart style logo using SVG sectors

interface SectorProps {
    start: number;
    end: number;
    color: string;
}

const Sector: React.FC<SectorProps> = ({ start, end, color }) => {
    const r = 12;
    const cx = 16;
    const cy = 16;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArcFlag = end - start > 180 ? 1 : 0;
    return <path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`} fill={color} />;
};

interface BrandLogoProps {
    className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className }) => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className={className}>
        <Sector start={-90} end={-30} color="#60a5fa" />
        <Sector start={0} end={90} color="#3b82f6" />
        <Sector start={90} end={180} color="#2563eb" />
        <Sector start={180} end={270} color="#1d4ed8" />
    </svg>
);
