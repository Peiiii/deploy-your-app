import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ExploreAppCard } from '@/components/explore-app-card';

// --- BRAND LOGO HELPER ---
const Sector = ({ start, end, color }: { start: number; end: number; color: string }) => {
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

const BrandLogo = ({ className }: { className?: string }) => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className={className}>
        <Sector start={-90} end={-30} color="#60a5fa" />
        <Sector start={0} end={90} color="#3b82f6" />
        <Sector start={90} end={180} color="#2563eb" />
        <Sector start={180} end={270} color="#1d4ed8" />
    </svg>
);

interface PreviewFloatingDockProps {
    app: ExploreAppCard;
    onClose: () => void;
    onOpenInNewTab: (url: string) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
}

export const PreviewFloatingDock: React.FC<PreviewFloatingDockProps> = ({
    app,
    onClose,
    onOpenInNewTab,
    onDragStart,
    onDragEnd
}) => {
    const { t } = useTranslation();
    const [position, setPosition] = useState({ x: 0, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [isRightSide, setIsRightSide] = useState(false);

    // Drag Refs
    const dragRef = useRef<{ startX: number, startY: number, initX: number, initY: number, currentX: number, currentY: number } | null>(null);
    const nodeRef = useRef<HTMLDivElement>(null);

    // Initial Position (Center-Left)
    useEffect(() => {
        setPosition({ x: 0, y: window.innerHeight / 2 - 100 });
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        onDragStart();
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initX: position.x,
            initY: position.y,
            currentX: position.x,
            currentY: position.y
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;

        let newX = dragRef.current.initX + dx;
        let newY = dragRef.current.initY + dy;

        // Bounded Y
        const maxHeight = window.innerHeight - (nodeRef.current?.offsetHeight || 100);
        newY = Math.max(0, Math.min(newY, maxHeight));

        // Update ref
        dragRef.current.currentX = newX;
        dragRef.current.currentY = newY;

        // Unbounded X (during drag)
        setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        if (!dragRef.current || !nodeRef.current) return;

        // Snapping Logic
        // We use window width as the reference since the panel is typically full width.
        // Or strictly use the offsetParent if available.
        const parentWidth = nodeRef.current.offsetParent?.clientWidth || window.innerWidth;
        const widgetWidth = nodeRef.current.offsetWidth;
        const currentCenter = dragRef.current.currentX + widgetWidth / 2;

        let finalX = 0;
        let rightSide = false;

        if (currentCenter > parentWidth / 2) {
            finalX = parentWidth - widgetWidth;
            rightSide = true;
        } else {
            finalX = 0;
            rightSide = false;
        }

        // ensure Y is still valid
        const maxHeight = (nodeRef.current.offsetParent?.clientHeight || window.innerHeight) - nodeRef.current.offsetHeight;
        const finalY = Math.max(0, Math.min(dragRef.current.currentY, maxHeight));

        setPosition({ x: finalX, y: finalY });
        setIsRightSide(rightSide);
        setIsDragging(false);
        onDragEnd(); // notify parent

        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={nodeRef}
            onMouseDown={handleMouseDown}
            style={{ left: position.x, top: position.y }}
            className={`
                absolute z-50 select-none
                ${isDragging ? 'cursor-grabbing' : 'transition-[left,top] duration-500 linear cursor-grab'}
            `}
        >
            {/* Unified Capsule Container */}
            <div className={`
                flex flex-col items-center
                bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl
                border border-slate-200/60 dark:border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.15)]
                transition-all duration-300 ease-out overflow-hidden
                group/dock
                ${isRightSide
                    ? 'rounded-l-2xl rounded-r-none border-r-0'
                    : 'rounded-r-2xl rounded-l-none border-l-0'}
            `}>

                {/* 1. Main Icon (Always Visible) - Serves as Handle */}
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative z-20">
                    <BrandLogo className="w-6 h-6" />
                </div>

                {/* 2. Expanded Action Area (Hidden by default, slides down) */}
                <div className={`
                    flex flex-col items-center gap-3 w-full
                    transition-all duration-300 ease-in-out origin-top px-1.5
                    ${isDragging
                        ? 'max-h-[120px] pb-3 opacity-100' // Auto-expand when dragging so you see what you're holding? Or collapse?
                        // User said: "Hover shows actions". Dragging usually implies moving, so maybe keep compact?
                        // But user might want to see it. Let's keep it Expanded on Drag for clarity, OR Collapsed?
                        // User said "Icon is disconnected".
                        // Let's Collapse on Drag to make it a small handle, Expand on Hover.
                        : 'max-h-0 opacity-0 pb-0 group-hover/dock:max-h-[120px] group-hover/dock:pb-3 group-hover/dock:opacity-100'}
                `}>

                    {/* Divider */}
                    <div className="w-4 h-px bg-slate-200 dark:bg-slate-700"></div>

                    {/* Actions */}
                    {app.url && (
                        <button
                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag start
                            onClick={() => onOpenInNewTab(app.url!)}
                            className="p-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-600 text-slate-500 dark:text-slate-400 transition-colors"
                            title={t('common.openInNewTab')}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onMouseDown={(e) => e.stopPropagation()} // Prevent drag start
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-500 dark:text-slate-400 transition-colors"
                        title={t('common.close')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
