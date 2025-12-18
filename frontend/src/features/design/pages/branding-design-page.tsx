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

// --- HELPER: SECTOR DRAWING (For Retained Candidates) ---
const Sector = ({ start, end, color = "currentColor", r = 12, cx = 16, cy = 16 }: { start: number; end: number; color?: string; r?: number, cx?: number, cy?: number }) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const largeArcFlag = (end - start) > 180 ? 1 : 0;
    return <path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`} fill={color} stroke="none" />;
};


// --- RETAINED CANDIDATES (TOP 6) ---

const LogoOriginal = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="currentColor" />
            <path d="M16 4a12 12 0 0 1 0 24V4z" stroke="currentColor" strokeWidth="2" />
        </svg>
    </LogoContainer>
);

const LogoSliceG = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
            <path d="M16 4a12 12 0 0 0 0 24" fill="currentColor" />
            <path d="M16 16h12" stroke="white" strokeWidth="4" className="dark:stroke-slate-900" />
        </svg>
    </LogoContainer>
);

const LogoTerminalSplit = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="currentColor" />
            <path d="M20 12l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" />
        </svg>
    </LogoContainer>
);

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


// --- TERMINAL SPLIT VIBRANT EVOLUTION ---

// 1. Neon Terminal
// Vibrant Green on Black, Glowing
const LogoTS_Neon = () => (
    <LogoContainer>
        <div className="w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center relative overflow-hidden shadow-lg shadow-emerald-500/20">
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-slate-900 border-r border-emerald-500/50"></div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-[0_0_3px_rgba(52,211,153,0.8)]">
                <path d="M13 8l4 4-4 4" />
                <line x1="12" y1="4" x2="12" y2="20" className="text-slate-700" strokeWidth="1" /> {/* Subtle split line */}
            </svg>
        </div>
    </LogoContainer>
);

// 2. Syntax Highlight
// Multi-colored: Blue structure, Pink bracket, Yellow prompt
const LogoTS_Syntax = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="#1e293b" /> {/* Dark background side */}
            <path d="M16 4a12 12 0 0 1 0 24V4z" stroke="#cbd5e1" strokeWidth="2" />
            <path d="M20 12l4 4-4 4" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> {/* Pink Prompt */}
            <line x1="16" y1="4" x2="16" y2="28" stroke="#3b82f6" strokeWidth="2" /> {/* Blue Split */}
        </svg>
    </LogoContainer>
);

// 3. Glitch Split
// Offset colors (Cyan/Magenta) like a screen glitch
const LogoTS_Glitch = () => (
    <LogoContainer>
        <div className="relative">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute left-[1px] top-0 opacity-70 mix-blend-screen">
                <path d="M16 4a12 12 0 0 0 0 24V4z" fill="#06b6d4" /> {/* Cyan */}
            </svg>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="absolute -left-[1px] top-0 opacity-70 mix-blend-screen">
                <path d="M16 4a12 12 0 0 0 0 24V4z" fill="#db2777" /> {/* Magenta */}
            </svg>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="relative z-10">
                <path d="M16 4a12 12 0 0 1 0 24V4z" stroke="currentColor" strokeWidth="2" />
                <path d="M20 12l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" />
            </svg>
        </div>
    </LogoContainer>
);

// 4. Gradient Slash
// The split is a diagonal vibrant gradient cut
const LogoTS_GradientSlash = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <defs>
                <linearGradient id="gradSlash" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#ec4899" /></linearGradient>
            </defs>
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="currentColor" className="text-slate-800 dark:text-white" />
            <line x1="16" y1="4" x2="16" y2="28" stroke="url(#gradSlash)" strokeWidth="3" />
            <path d="M21 12l4 4-4 4" stroke="url(#gradSlash)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </LogoContainer>
);

// 5. Code Block Container
// The split circle inside a [ ] or code box
const LogoTS_Container = () => (
    <LogoContainer>
        <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-blue-50 dark:bg-blue-900/20"></div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <line x1="12" y1="4" x2="12" y2="20" stroke="#3b82f6" strokeWidth="2" />
                <path d="M14 10l3 2-3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        </div>
    </LogoContainer>
);

// 6. Energetic Arrow (G-Prompt)
// The prompt arrow IS the crossbar of the G
const LogoTS_PromptG = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 4a12 12 0 0 0 0 24V4z" fill="currentColor" />
            <path d="M16 4a12 12 0 0 1 0 24" stroke="currentColor" strokeWidth="2" />
            {/* The Prompt Arrow forming the G crossbar */}
            <path d="M16 16 h 6" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" /> {/* Red Line */}
            <path d="M24 14 l 2 2 -2 2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </LogoContainer>
);

// 7. Bold & Blue
// Thick, confident strokes, primary brand blue
const LogoTS_Bold = () => (
    <LogoContainer>
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M16 6a10 10 0 0 0 0 20V6z" fill="#1e40af" />
            <path d="M16 6a10 10 0 0 1 0 20V6z" stroke="#3b82f6" strokeWidth="3" />
            <path d="M21 13l3 3-3 3" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    </LogoContainer>
);

// 8. Warning/Action (Yellow/Black)
// High contrast construction style
const LogoTS_Action = () => (
    <LogoContainer>
        <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 overflow-hidden relative border-2 border-slate-900">
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-slate-900"></div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <line x1="12" y1="2" x2="12" y2="22" stroke="white" strokeWidth="2" />
                <path d="M15 9l3 3-3 3" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        </div>
    </LogoContainer>
);


export const BrandingDesignPage = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 md:p-12 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-12">

                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Dynamic Evolution
                    </h1>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Refining favorites and injecting energy into the "Terminal Split" concept.
                    </p>
                </header>

                {/* SECTION 1: THE PRESERVED SIX */}
                <section>
                    <SectionHeader title="Preserved Candidates" reset="The chosen foundation" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
                        <CandidateCard id="T1" label="Original" isTop description="Pure geometry"><LogoOriginal /></CandidateCard>
                        <CandidateCard id="T2" label="Slice G" isTop description="Negative space"><LogoSliceG /></CandidateCard>
                        <CandidateCard id="T3" label="Terminal Split" isTop description="Tech native"><LogoTerminalSplit /></CandidateCard>
                        <CandidateCard id="T4" label="Quarter Cut" isTop description="Modular"><LogoQuarter /></CandidateCard>
                        <CandidateCard id="T5" label="Exploded" isTop description="Separated blocks"><LogoExploded /></CandidateCard>
                        <CandidateCard id="T6" label="Mono Blue" isTop description="Tonal palette"><LogoMonoColor /></CandidateCard>
                    </div>
                </section>

                {/* SECTION 2: VIBRANT TERMINAL SPLIT */}
                <section>
                    <SectionHeader title="Terminal Split: Vibrant Mode" reset="High energy variants" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        <CandidateCard id="V1" label="Neon Terminal" description="Hacker green glow"><LogoTS_Neon /></CandidateCard>
                        <CandidateCard id="V2" label="Syntax Highlight" description="Pink/Blue/Dark"><LogoTS_Syntax /></CandidateCard>
                        <CandidateCard id="V3" label="Glitch Split" description="Cyan/Magenta offset"><LogoTS_Glitch /></CandidateCard>
                        <CandidateCard id="V4" label="Gradient Slash" description="Vivid spectrum cut"><LogoTS_GradientSlash /></CandidateCard>

                        <CandidateCard id="V5" label="Prompt G" description="Red arrow crossbar"><LogoTS_PromptG /></CandidateCard>
                        <CandidateCard id="V6" label="Container Box" description="UI abstraction"><LogoTS_Container /></CandidateCard>
                        <CandidateCard id="V7" label="Bold Blue" description="Thick strokes"><LogoTS_Bold /></CandidateCard>
                        <CandidateCard id="V8" label="Construction" description="High contrast visual"><LogoTS_Action /></CandidateCard>
                    </div>
                </section>

            </div>
        </div>
    );
};
