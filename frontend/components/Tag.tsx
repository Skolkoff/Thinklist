
import React from 'react';

interface TagProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  count?: number; // Optional count to display
}

export const Tag: React.FC<TagProps> = ({ label, selected, onClick, size = 'md', count }) => {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-5 py-2'
  };

  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        rounded-full font-medium transition-all duration-200 flex max-w-[13rem] shrink-0 items-center gap-2
        ${sizeClasses[size]}
        ${selected 
          ? 'bg-secondary dark:bg-white text-white dark:text-black border-transparent shadow-md transform scale-105' 
          : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 border border-transparent hover:scale-105'}
      `}
    >
      <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`
          rounded-full flex h-4 min-w-4 items-center justify-center bg-black/10 px-1 text-[10px] dark:bg-white/20
          ${size === 'lg' ? 'h-6 min-w-6 text-xs' : ''}
        `}>
          {count}
        </span>
      )}
    </button>
  );
};
