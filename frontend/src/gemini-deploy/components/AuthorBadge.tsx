import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';

interface AuthorBadgeProps {
  name: string;
  identifier?: string;
  className?: string;
}

/**
 * Small reusable author badge used in explore cards and the home preview header.
 * Renders a user icon and a name; when identifier is provided, the name is
 * clickable and navigates to /u/:identifier.
 */
export const AuthorBadge: React.FC<AuthorBadgeProps> = ({
  name,
  identifier,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (!identifier) return;
    e.stopPropagation();
    navigate(`/u/${encodeURIComponent(identifier)}`);
  };

  return (
    <div
      className={
        'text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate ' +
        className
      }
    >
      <User className="w-3 h-3" />
      {identifier ? (
        <button
          type="button"
          onClick={handleClick}
          className="truncate hover:underline text-left"
        >
          {name}
        </button>
      ) : (
        <span className="truncate">{name}</span>
      )}
    </div>
  );
};

