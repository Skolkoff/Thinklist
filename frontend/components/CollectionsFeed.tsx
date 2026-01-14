
import React, { useMemo } from 'react';
import { Article, Collection } from '../types';
import { Tag } from './Tag';
import { MasonryGrid } from './MasonryGrid';
import { ArticleCard } from './ArticleCard';
import { Sparkles } from 'lucide-react';

interface CollectionsFeedProps {
  articles: Article[];
  collections: Collection[];
  loading: boolean;
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onOpenArticle: (article: Article) => void;
  onSaveArticle: (article: Article) => void;
  onNavigateHome: () => void;
}

export const CollectionsFeed: React.FC<CollectionsFeedProps> = ({
  articles,
  collections,
  loading,
  selectedCollectionId,
  onSelectCollection,
  onOpenArticle,
  onSaveArticle,
  onNavigateHome
}) => {
  // Recommendation Logic for Collections Tab
  const displayedArticles = useMemo(() => {
    if (loading) return [];

    // 1. Identify "Seed" articles (articles the user has already expressed interest in via boards)
    let seedArticleIds: string[] = [];
    
    if (selectedCollectionId) {
      // Specific Board: Seed from this board
      const col = collections.find(c => c.id === selectedCollectionId);
      if (col) seedArticleIds = col.articleIds;
    } else {
      // "All Boards": Seed from all boards
      seedArticleIds = collections.flatMap(c => c.articleIds);
    }

    // If user has no saved articles at all, show everything (discovery mode)
    if (seedArticleIds.length === 0) return articles;

    // 2. Extract Tags from Seed Articles to understand user interests
    // We need to find the actual Article objects to get their tags. 
    // Note: In a real app, this would be a backend query.
    const seedArticles = articles.filter(a => seedArticleIds.includes(a.id));
    const interestedTags = new Set(seedArticles.flatMap(a => a.tags));

    // 3. Filter "Recommended" Articles
    // Find articles that share tags with the seed articles.
    // We mix in both the saved articles (to remind them) and new ones (suggestions).
    let recommendations = articles.filter(a => {
      // Logic: Include if it has at least one matching tag
      return a.tags.some(tag => interestedTags.has(tag));
    });

    // 4. Shuffle/Sort to simulate a "Mix" of suggestions
    // In a real app, this would weight unseen articles higher than seen ones.
    // Here we just shuffle to give it a fresh "feed" feel.
    return recommendations.sort(() => Math.random() - 0.5);

  }, [articles, collections, loading, selectedCollectionId]);

  return (
    <>
      {/* Collections Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 md:px-8 py-6 max-w-[2000px] mx-auto sticky top-[72px] z-30 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-sm transition-colors">
        <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap mr-2">
           Boards:
        </span>
        
        <Tag 
          label="All Boards" 
          selected={selectedCollectionId === null}
          onClick={() => onSelectCollection(null)}
        />

        {collections.map(col => (
          <Tag 
            key={col.id} 
            label={col.name} 
            selected={selectedCollectionId === col.id}
            onClick={() => onSelectCollection(col.id)}
          />
        ))}
      </div>

      {/* Header for Context */}
      <div className="px-4 md:px-8 pb-4 max-w-[2000px] mx-auto flex items-center gap-2 text-gray-500 dark:text-gray-400">
         <Sparkles size={16} />
         <span className="text-sm font-medium">
            {selectedCollectionId 
              ? "More ideas inspired by this board" 
              : "Curated suggestions from all your boards"}
         </span>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64 text-gray-400">
           <div className="animate-pulse flex flex-col items-center">
             <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-full mb-4"></div>
             <p>Generating suggestions...</p>
           </div>
        </div>
      ) : displayedArticles.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-xl mb-4">
            {selectedCollectionId 
              ? "Not enough data in this board for suggestions yet." 
              : "Save some articles to get personalized board recommendations."}
          </p>
          <button 
            onClick={onNavigateHome}
            className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            Explore Feed
          </button>
        </div>
      ) : (
        <MasonryGrid>
          {displayedArticles.map(article => (
            <ArticleCard 
              key={article.id} 
              article={article} 
              onOpen={onOpenArticle}
              onSave={onSaveArticle}
            />
          ))}
        </MasonryGrid>
      )}
    </>
  );
};