
import React, { useState } from 'react';
import { Article } from '../types';
import { MoreHorizontal, Share2, Heart, ArrowUpRight } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onOpen: (article: Article) => void;
  onSave?: (article: Article) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onOpen, onSave }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [liked, setLiked] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSave) onSave(article);
  };

  return (
    <div 
      className="mb-6 relative break-inside-avoid group cursor-zoom-in"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpen(article)}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/5">
        <img 
          src={article.imageUrl} 
          alt={article.title}
          className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Hover Overlay Actions */}
        <div 
          className={`absolute inset-0 bg-black/10 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="absolute top-3 right-3 flex gap-2">
            <button 
              onClick={handleSave}
              className="bg-primary text-white px-4 py-3 rounded-full font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm"
            >
              Save
            </button>
          </div>

          <div className="absolute bottom-3 right-3 flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); window.open(article.doi, '_blank'); }}
              className="bg-white p-2 rounded-full hover:bg-gray-100 shadow-sm text-gray-800"
              title="Open Source"
            >
              <ArrowUpRight size={18} />
            </button>
            <button 
              className="bg-white p-2 rounded-full hover:bg-gray-100 shadow-sm text-gray-800"
            >
              <Share2 size={18} />
            </button>
            <button 
              className="bg-white p-2 rounded-full hover:bg-gray-100 shadow-sm text-gray-800"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Article Meta Info */}
      <div className="mt-2 px-1">
        <h3 className="font-semibold text-gray-900 dark:text-white leading-tight mb-1 line-clamp-2 text-sm md:text-base">
          {article.title}
        </h3>
        <div className="flex justify-between items-center mt-1">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
             <span className="font-medium">{article.source}</span>
             <span>•</span>
             <span>{new Date(article.publishedAt).getFullYear()}</span>
          </div>
          <button onClick={handleLike} className="group/like p-1">
            <Heart 
              size={14} 
              className={`transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500 group-hover/like:text-gray-600 dark:group-hover/like:text-gray-300'}`} 
            />
          </button>
        </div>
      </div>
    </div>
  );
};