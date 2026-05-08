
import React, { useState, useMemo } from 'react';
import { Article, FilterState } from '../types';
import { Tag } from './Tag';
import { MasonryGrid } from './MasonryGrid';
import { ArticleCard } from './ArticleCard';
import { ChevronDown, ChevronUp, Cloud } from 'lucide-react';
import { getTopicChipLabel, Locale, t } from '../i18n';

interface HomeFeedProps {
  articles: Article[];
  availableTags: string[];
  locale: Locale;
  loading: boolean;
  filters: FilterState;
  onTagToggle: (tag: string) => void;
  onClearFilters: () => void;
  onOpenArticle: (article: Article) => void;
  onSaveArticle: (article: Article) => void;
  canInteract?: boolean;
  onRequireAuth?: () => void;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({
  articles,
  availableTags,
  locale,
  loading,
  filters,
  onTagToggle,
  onClearFilters,
  onOpenArticle,
  onSaveArticle,
  canInteract = true,
  onRequireAuth
}) => {
  const [isCloudOpen, setIsCloudOpen] = useState(false);

  // Calculate tag weights based on frequency in current articles
  const tagData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count occurrences
    articles.forEach(article => {
      article.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    const maxCount = Math.max(...Object.values(counts), 1);

    const tags = availableTags.length
      ? availableTags
      : Array.from(new Set(articles.flatMap(article => article.tags))).sort();

    return tags
      .map(tag => {
        const count = counts[tag] || 0;
        let size: 'sm' | 'md' | 'lg' = 'sm';
        
        // Dynamic sizing logic relative to the most frequent tag
        const ratio = count / maxCount;
        if (ratio > 0.6) size = 'lg';
        else if (ratio > 0.3) size = 'md';
        
        return { tag, count, size };
      })
      // Only show tags that appear in the results or are currently selected
      .filter(t => t.count > 0 || filters.selectedTags.includes(t.tag))
      // Sort by frequency (desc), then alphabetically
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
      });
  }, [articles, availableTags, filters.selectedTags]);

  return (
    <>
      {/* Topics / Tag Cloud Section */}
      <div className="sticky top-[73px] z-30 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-sm border-b border-gray-100 dark:border-dark-border transition-all duration-300 md:top-[81px]">
         <div className="max-w-[2000px] mx-auto px-4 md:px-8 pt-0.5">
            
            {/* Header / Toggle Bar */}
            <div className="flex items-center justify-between py-4">
               <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Cloud size={18} className={filters.selectedTags.length > 0 ? "text-primary" : "text-gray-400 dark:text-gray-500"} />
                  <span className="font-bold text-sm tracking-wide uppercase">
                    {filters.selectedTags.length > 0
                      ? t(locale, 'topics.selected', { count: filters.selectedTags.length })
                      : t(locale, 'topics.explore')}
                  </span>
               </div>
               
               <button 
                 onClick={() => setIsCloudOpen(!isCloudOpen)}
                 className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors bg-gray-50 dark:bg-white/5 px-3 py-1.5 rounded-full"
               >
                 {isCloudOpen ? t(locale, 'topics.collapse') : t(locale, 'topics.viewCloud')}
                 {isCloudOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
               </button>
            </div>

            {/* Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isCloudOpen ? 'max-h-[500px] pb-6 opacity-100' : 'max-h-[150px] opacity-100'}`}>
              {isCloudOpen ? (
                // Full Cloud View
                <div className="flex flex-wrap gap-3 items-center justify-center py-2 animate-in fade-in zoom-in-95 duration-300">
                   {tagData.length > 0 ? tagData.map(({ tag, count, size }) => (
                      <Tag 
                        key={tag} 
                        label={getTopicChipLabel(tag, locale)} 
                        size={size}
                        count={count}
                        selected={filters.selectedTags.includes(tag)}
                        onClick={() => onTagToggle(tag)}
                      />
                   )) : (
                     <p className="text-sm text-gray-500 italic">{t(locale, 'topics.noMatches')}</p>
                   )}
                </div>
              ) : (
                // Compact Horizontal Scroll View
                <div className="flex shrink-0 items-center gap-2 overflow-x-auto no-scrollbar pb-4">
                  {tagData.map(({ tag }) => (
                    <Tag 
                      key={tag} 
                      label={getTopicChipLabel(tag, locale)} 
                      selected={filters.selectedTags.includes(tag)}
                      onClick={() => onTagToggle(tag)}
                    />
                  ))}
                </div>
              )}
            </div>
         </div>
      </div>

      {/* Grid */}
      <div className="pt-6">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-400">
             <div className="animate-pulse flex flex-col items-center">
               <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-full mb-4"></div>
               <p>{t(locale, 'feed.loading')}</p>
             </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl">{t(locale, 'feed.empty')}</p>
            <button 
              onClick={onClearFilters}
              className="mt-4 text-primary font-medium hover:underline"
            >
              {t(locale, 'feed.clearFilters')}
            </button>
          </div>
        ) : (
          <MasonryGrid>
              {articles.map(article => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  onOpen={onOpenArticle}
                  onSave={onSaveArticle}
                  locale={locale}
                  canInteract={canInteract}
                  onRequireAuth={onRequireAuth}
                />
              ))}
            </MasonryGrid>
        )}
      </div>
    </>
  );
};
