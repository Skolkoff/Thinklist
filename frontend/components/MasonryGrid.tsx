import React from 'react';

interface MasonryGridProps {
  children: React.ReactNode;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({ children }) => {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 px-4 md:px-8 pb-10 mx-auto max-w-[2000px]">
      {children}
    </div>
  );
};