import React from 'react';

// --- LAYOUT COMPONENTS ---

const SectionHeader = ({ title, reset }: { title: string; reset?: string }) => (
    <div className="flex items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
        {reset && <span className="text-sm text-slate-500 mb-1">{reset}</span>}
    </div>
);

const CandidateCard = ({ children, id, label, description, isTop = false }: { children: React.ReactNode; id: string; label: string; description?: string; isTop?: boolean }) => (
    <div className={`flex flex-col gap-3 group ${isTop ? 'scale-105' : ''}`}>
        <div className={`bg-white dark:bg-slate-900 border ${isTop ? 'border-brand-500 shadow-brand-500/10 shadow-xl' : 'border-slate-200 dark:border-slate-800'} rounded-xl aspect-[4/3] flex items-center justify-center relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-700 hover:-translate-y-1`}>
            <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">{id}</span>
                {isTop && <span className="px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900 text-[9px] font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider">Top Pick</span>}
            </div>
            <div className={`transition-transform duration-500 group-hover:scale-110 ${isTop ? 'scale-125' : 'scale-110'}`}>
                {children}
            </div>
        </div>
        <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors flex items-center gap-2">
                {label}
            </div>
            {description && <div className="text-[11px] text-slate-500 leading-tight mt-1">{description}</div>}
        </div>
    </div>
);

const LogoContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="w-16 h-16 flex items-center justify-center text-slate-900 dark:text-white">
        {children}
    </div>
);

// --- HELPER: SECTOR DRAWING ---
const Sector = ({ start, end, color = "currentColor", r = 12, cx = 16, cy = 16 }: { start: number; end: number; color?: string; r?: number, cx?: number, cy?: number }) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArcFlag = (end - start) > 180 ? 1 : 0;
    return <path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`} fill={color} stroke="none" />;
};
// --- HELPER: RADIAL LEG (For Letter K) ---
const RadialLeg = ({ angle, strokeWidth = 3 }: { angle: number; strokeWidth?: number }) => {
    const r = 12, cx = 16, cy = 16;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x = cx + r * Math.cos(toRad(angle));
    const y = cy + r * Math.sin(toRad(angle));
    return <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />;
};


// --- RETAINED CANDIDATES (TOP 7) ---
// 1. Original
const LogoOriginal = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="currentColor" />
            <path d="M16 4a12 12 0 0 1 0 24V4z" stroke="currentColor" strokeWidth="2" />
        </svg>
    </LogoContainer>
);

// 2. Slice G
const LogoSliceG = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
            <path d="M16 4a12 12 0 0 0 0 24" fill="currentColor" />
            <path d="M16 16h12" stroke="white" strokeWidth="4" className="dark:stroke-slate-900" />
        </svg>
    </LogoContainer>
);

// 3. Terminal Split
const LogoTerminalSplit = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="currentColor" />
            <path d="M20 12l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" />
        </svg>
    </LogoContainer>
);

// 4. Quarter Cut
const LogoQuarter = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 16H28A12 12 0 0 0 16 4V16Z" fill="currentColor" className="opacity-90" />
            <path d="M16 16V28A12 12 0 0 0 28 16H16Z" fill="currentColor" className="text-brand-600 dark:text-brand-400" />
            <path d="M16 16H4A12 12 0 0 0 16 28V16Z" fill="currentColor" className="opacity-40" />
            <path d="M16 16V4A12 12 0 0 0 4 16H16Z" fill="currentColor" className="opacity-70" />
        </svg>
    </LogoContainer>
);

// 5. Exploded
const LogoExploded = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <g transform="translate(0.5, -0.5)"><Sector start={-90} end={-30} color="#60a5fa" /></g>
            <g transform="translate(0.5, 0.5)"><Sector start={0} end={90} color="#2563eb" /></g>
            <g transform="translate(-0.5, 0.5)"><Sector start={90} end={180} color="#0f172a" /></g>
            <g transform="translate(-0.5, -0.5)"><Sector start={180} end={270} color="#64748b" /></g>
        </svg>
    </LogoContainer>
);

// 6. Mono Blue
const LogoMonoColor = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <Sector start={-90} end={-30} color="#93c5fd" />
            <Sector start={0} end={90} color="#3b82f6" />
            <Sector start={90} end={180} color="#1d4ed8" />
            <Sector start={180} end={270} color="#60a5fa" />
        </svg>
    </LogoContainer>
);

// 7. Letter K (The Pacman Walker)
const LogoLetterK = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" fill="currentColor" />
            <RadialLeg angle={-45} />
            <RadialLeg angle={45} />
        </svg>
    </LogoContainer>
);


// --- CREATIVE INNOVATION EXPLORATION ---

// 1. The Aperture (Focus)
// Interlocking blades forming a G/Circle.
const LogoAperture = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            {/* 3 blades for simplicity */}
            <path d="M16 16 L 16 4 A 12 12 0 0 1 27.5 12 Z" fill="#60a5fa" />
            <path d="M16 16 L 27.5 12 A 12 12 0 0 1 18 27.8 Z" fill="#3b82f6" />
            <path d="M16 16 L 18 27.8 A 12 12 0 0 1 4.5 20 Z" fill="#2563eb" />
            <path d="M16 16 L 4.5 20 A 12 12 0 0 1 16 4 Z" fill="#1d4ed8" />
            <circle cx="16" cy="16" r="3" fill="white" className="dark:fill-slate-900" />
        </svg>
    </LogoContainer>
);

// 2. The Circuit (Connection)
// Lines resembling a PCB trace forming a G.
const LogoCircuit = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M22 6 h-4 v 4 h -6 v 12 h 8 v -6 h -2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="20" cy="16" r="2" fill="currentColor" />
            <circle cx="18" cy="6" r="2" fill="currentColor" />
        </svg>
    </LogoContainer>
);

// 3. The Orbit (Cloud)
// A central planet with a satellite 'G' orbit.
const LogoOrbit = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="6" fill="currentColor" />
            <path d="M16 4 a 12 12 0 0 0 0 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="4" r="2.5" fill="#3b82f6" />
        </svg>
    </LogoContainer>
);

// 4. The Fold (Origami)
// A folded ribbon creating a 3D G effect.
const LogoFold = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M20 6 L 12 6 L 12 26 L 22 26 L 22 16 L 16 16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-700" />
            <path d="M20 6 L 12 6 L 12 26 L 22 26 L 22 16 L 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    </LogoContainer>
);

// 5. The Beam (Laser)
// A scanning beam cutting through the darkness.
const LogoBeam = () => (
    <LogoContainer>
        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-[45%] w-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)]"></div>
            <div className="text-white font-bold text-xl relative z-10 mix-blend-overlay">G</div>
        </div>
    </LogoContainer>
);

// 6. The Mosaic (Data)
// Small squares building up a G.
const LogoMosaic = () => (
    <LogoContainer>
        <div className="grid grid-cols-3 gap-1 w-8 h-8">
            <div className="bg-current rounded-[1px]"></div><div className="bg-current rounded-[1px]"></div><div className="bg-current rounded-[1px]"></div>
            <div className="bg-current rounded-[1px]"></div><div className="opacity-0"></div><div className="opacity-0"></div>
            <div className="bg-current rounded-[1px]"></div><div className="bg-current rounded-[1px]"></div><div className="bg-current rounded-[1px] bg-blue-500"></div>
        </div>
    </LogoContainer>
);

// 7. The Prism (Refraction)
// Triangle G with light splitting.
const LogoPrism = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 6 L 6 26 h 20 Z" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16 L 26 26" stroke="#3b82f6" strokeWidth="2" />
            <path d="M16 16 L 6 26" stroke="#ec4899" strokeWidth="2" />
        </svg>
    </LogoContainer>
);

// 8. The Loop (Infinity)
// Continuous line G.
const LogoLoop = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M18 10 c-6 0 -8 4 -8 8 s 2 8 8 8 h 2 c 4 0 6 -2 6 -6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="26" cy="20" r="2" fill="#3b82f6" />
        </svg>
    </LogoContainer>
);


export const BrandingDesignPage = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 md:p-12 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-12">

                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Creative Divergence
                    </h1>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Preserving the best, while exploring completely new geometric and metaphoric directions.
                    </p>
                </header>

                {/* SECTION 1: THE PRESERVED SEVEN */}
                <section>
                    <SectionHeader title="Preserved Candidates" reset="The Finalist Collection" />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 mb-12">
                        <CandidateCard id="F1" label="Original" isTop description="Pure geometry"><LogoOriginal /></CandidateCard>
                        <CandidateCard id="F2" label="Slice G" isTop description="Negative space"><LogoSliceG /></CandidateCard>
                        <CandidateCard id="F3" label="Terminal Split" isTop description="Tech native"><LogoTerminalSplit /></CandidateCard>
                        <CandidateCard id="F4" label="Quarter Cut" isTop description="Modular"><LogoQuarter /></CandidateCard>
                        <CandidateCard id="F5" label="Exploded" isTop description="Separated blocks"><LogoExploded /></CandidateCard>
                        <CandidateCard id="F6" label="Mono Blue" isTop description="Tonal palette"><LogoMonoColor /></CandidateCard>
                        <CandidateCard id="F7" label="Letter K" isTop description="-45° & 45° Radii"><LogoLetterK /></CandidateCard>
                    </div>
                </section>

                {/* SECTION 2: CREATIVE DIVERGENCE */}
                <section>
                    <SectionHeader title="Creative Divergence" reset="New Metaphors & Geometries" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        <CandidateCard id="D1" label="The Aperture" description="Focus & Lens"><LogoAperture /></CandidateCard>
                        <CandidateCard id="D2" label="The Circuit" description="PCB Connectivity"><LogoCircuit /></CandidateCard>
                        <CandidateCard id="D3" label="The Orbit" description="Planetary Cloud"><LogoOrbit /></CandidateCard>
                        <CandidateCard id="D4" label="The Fold" description="Structural Depth"><LogoFold /></CandidateCard>

                        <CandidateCard id="D5" label="The Beam" description="Laser Scan"><LogoBeam /></CandidateCard>
                        <CandidateCard id="D6" label="The Mosaic" description="Data Blocks"><LogoMosaic /></CandidateCard>
                        <CandidateCard id="D7" label="The Prism" description="Light Refraction"><LogoPrism /></CandidateCard>
                        <CandidateCard id="D8" label="The Loop" description="Continuous Flow"><LogoLoop /></CandidateCard>
                    </div>
                </section>

            </div>
        </div>
    );
};
