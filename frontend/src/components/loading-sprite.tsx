/** The same animated mouth serves page loading and compact dock feedback. */
export function LoadingSprite({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox={compact ? '0 0 32 32' : '0 0 112 64'}
      className={`preview-sprite shrink-0 ${compact ? 'h-5 w-5' : 'h-10 w-20'}`}
      aria-hidden="true"
      data-loading-sprite
    >
      <g transform={compact ? undefined : 'translate(16 8) scale(1.5)'}>
        <g className="preview-sprite-jaw">
          <path d="M16 16 L16 4 A12 12 0 0 1 28 16 Z" fill="#a78bfa" />
          <path d="M16 16 L28 16 A12 12 0 0 1 16 28 Z" fill="#7c3aed" />
          <path d="M16 16 L16 28 A12 12 0 0 1 4 16 Z" fill="#5b21b6" />
          <path d="M16 16 L4 16 A12 12 0 0 1 16 4 Z" fill="#8b5cf6" />
        </g>
      </g>
      {!compact &&
        [0, 1, 2].map((index) => (
          <circle
            key={index}
            className="preview-sprite-dot"
            cx="102"
            cy="32"
            r="2.5"
            fill="#a78bfa"
            style={{ animationDelay: `${index * -0.6}s` }}
          />
        ))}
    </svg>
  );
}
