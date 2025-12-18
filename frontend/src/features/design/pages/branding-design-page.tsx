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
        <div className={`bg-white dark:bg-slate-900 border ${isTop ? 'border-violet-500 shadow-violet-500/10 shadow-xl' : 'border-slate-200 dark:border-slate-800'} rounded-xl aspect-[4/3] flex items-center justify-center relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-700 hover:-translate-y-1`}>
            <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">{id}</span>
                {isTop && <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-[9px] font-bold text-violet-600 dark:text-violet-300 uppercase tracking-wider">Top Pick</span>}
            </div>
            <div className={`transition-transform duration-500 group-hover:scale-110 ${isTop ? 'scale-125' : 'scale-110'}`}>
                {children}
            </div>
        </div>
        <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors flex items-center gap-2">
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

// --- HELPERS ---
const Sector = ({ start, end, color = "currentColor" }: { start: number; end: number; color?: string }) => {
    const r = 12, cx = 16, cy = 16;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArcFlag = (end - start) > 180 ? 1 : 0;
    return <path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`} fill={color} stroke="none" />;
};

const RadialLeg = ({ angle, strokeWidth = 3, color = "currentColor" }: { angle: number; strokeWidth?: number; color?: string }) => {
    const r = 12, cx = 16, cy = 16;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x = cx + r * Math.cos(toRad(angle));
    const y = cy + r * Math.sin(toRad(angle));
    return <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />;
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

// 7. Letter K (The Creature - Standard)
const LogoLetterK = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" fill="currentColor" />
            <RadialLeg angle={-45} />
            <RadialLeg angle={45} />
        </svg>
    </LogoContainer>
);


// --- NEW PURPLE VARIANTS (Creature & Sectors) ---

// 8. Deep Space K (Dark Violet)
const LogoK_Deep = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" fill="#4c1d95" />
            <RadialLeg angle={-45} color="#c4b5fd" strokeWidth={3.5} />
            <RadialLeg angle={45} color="#c4b5fd" strokeWidth={3.5} />
        </svg>
    </LogoContainer>
);

// 9. Neon K (Glowing Outline)
const LogoK_Neon = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" stroke="#a78bfa" strokeWidth="2" fill="none" />
            <path d="M16 4 v 24" stroke="#a78bfa" strokeWidth="2" />
            <RadialLeg angle={-45} color="#a78bfa" strokeWidth={2} />
            <RadialLeg angle={45} color="#a78bfa" strokeWidth={2} />
        </svg>
    </LogoContainer>
);

// 10. Accent K (Teal Leg)
const LogoK_Accent = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" fill="#6d28d9" />
            <RadialLeg angle={-45} color="#2dd4bf" strokeWidth={3} />
            <RadialLeg angle={45} color="#a78bfa" strokeWidth={3} />
        </svg>
    </LogoContainer>
);

// 11. Soft K (Gradient)
const LogoK_Gradient = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <defs>
                <linearGradient id="gradK" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#7e22ce" />
                </linearGradient>
            </defs>
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" fill="url(#gradK)" />
            <RadialLeg angle={-45} color="#a855f7" strokeWidth={3} />
            <RadialLeg angle={45} color="#a855f7" strokeWidth={3} />
        </svg>
    </LogoContainer>
);

// 12. Wide K (Wider Stance)
const LogoK_Wide = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4 A12 12 0 0 0 16 28 V16 Z" fill="#5b21b6" />
            <RadialLeg angle={-30} color="#8b5cf6" strokeWidth={3} />
            <RadialLeg angle={90} color="#8b5cf6" strokeWidth={3} />
        </svg>
    </LogoContainer>
);

// 13. Midnight Sectors (Dark)
const LogoSector_Dark = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <Sector start={-90} end={-30} color="#4c1d95" />
            <Sector start={0} end={90} color="#2e1065" />
            <Sector start={90} end={180} color="#0f172a" />
            <Sector start={180} end={270} color="#581c87" />
        </svg>
    </LogoContainer>
);

// 14. Vivid Sectors (Pink)
const LogoSector_Vivid = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <Sector start={-90} end={-30} color="#e879f9" />
            <Sector start={0} end={90} color="#7c3aed" />
            <Sector start={90} end={180} color="#4c1d95" />
            <Sector start={180} end={270} color="#8b5cf6" />
        </svg>
    </LogoContainer>
);

// 15. Exploded Purple
const LogoSector_ExplodedPurple = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <g transform="translate(0.5, -0.5)"><Sector start={-90} end={-30} color="#a78bfa" /></g>
            <g transform="translate(0.5, 0.5)"><Sector start={0} end={90} color="#7c3aed" /></g>
            <g transform="translate(-0.5, 0.5)"><Sector start={90} end={180} color="#4c1d95" /></g>
            <g transform="translate(-0.5, -0.5)"><Sector start={180} end={270} color="#c4b5fd" /></g>
        </svg>
    </LogoContainer>
);

// 16. Precise 30 Purple
const LogoSector_Precise = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <Sector start={-90} end={-30} color="#a78bfa" />
            <Sector start={0} end={90} color="#7c3aed" />
            <Sector start={90} end={180} color="#5b21b6" />
            <Sector start={180} end={270} color="#8b5cf6" />
        </svg>
    </LogoContainer>
);

// 17. Cyan Splash
const LogoSector_Splash = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <Sector start={-90} end={-30} color="#22d3ee" />
            <Sector start={0} end={90} color="#7c3aed" />
            <Sector start={90} end={180} color="#4c1d95" />
            <Sector start={180} end={270} color="#8b5cf6" />
        </svg>
    </LogoContainer>
);


export const BrandingDesignPage = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 md:p-12 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-12">

                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        The Purple Convergence
                    </h1>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Preserved finalists + exploration of "Letter K" and "Data Sectors" in Violet.
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

                {/* SECTION 2: LETTER K (PURPLE) */}
                <section>
                    <SectionHeader title="Letter K: Purple Creature" reset="Personality driven in Violet" />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-12">
                        <CandidateCard id="K1" label="Deep Space" description="Dark violet contrast"><LogoK_Deep /></CandidateCard>
                        <CandidateCard id="K2" label="Neon Outline" description="Glowing wireframe"><LogoK_Neon /></CandidateCard>
                        <CandidateCard id="K3" label="Teal Accent" description="Pop of color"><LogoK_Accent /></CandidateCard>
                        <CandidateCard id="K4" label="Soft Gradient" description="Smooth transition"><LogoK_Gradient /></CandidateCard>
                        <CandidateCard id="K5" label="Wide Stance" description="Grounded posture"><LogoK_Wide /></CandidateCard>
                    </div>
                </section>

                {/* SECTION 3: SECTOR (PURPLE) */}
                <section>
                    <SectionHeader title="Sectors: Purple Data" reset="Structure driven in Violet" />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-12">
                        <CandidateCard id="S1" label="Midnight" description="Deepest darks"><LogoSector_Dark /></CandidateCard>
                        <CandidateCard id="S2" label="Vivid Pink" description="High energy accent"><LogoSector_Vivid /></CandidateCard>
                        <CandidateCard id="S3" label="Exploded" description="Separated blocks"><LogoSector_ExplodedPurple /></CandidateCard>
                        <CandidateCard id="S4" label="Precise 30" description="Optimal 'G' shape"><LogoSector_Precise /></CandidateCard>
                        <CandidateCard id="S5" label="Cyan Splash" description="Electric contrast"><LogoSector_Splash /></CandidateCard>
                    </div>
                </section>

            </div>
        </div>
    );
};
