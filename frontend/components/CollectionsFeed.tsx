
import React, { useMemo } from 'react';
import { Article, Collection } from '../types';
import { Tag } from './Tag';
import { MasonryGrid } from './MasonryGrid';
import { ArticleCard } from './ArticleCard';
import { Sparkles } from 'lucide-react';
import { Locale, t } from '../i18n';

const ALL_ARTICLES_ID = 'all';

interface CollectionsFeedProps {
  articles: Article[];
  collections: Collection[];
  locale: Locale;
  loading: boolean;
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onOpenArticle: (article: Article) => void;
  onSaveArticle: (article: Article) => void;
  onNavigateHome: () => void;
  canInteract?: boolean;
  onRequireAuth?: () => void;
}

export const CollectionsFeed: React.FC<CollectionsFeedProps> = ({
  articles,
  collections,
  locale,
  loading,
  selectedCollectionId,
  onSelectCollection,
  onOpenArticle,
  onSaveArticle,
  onNavigateHome,
  canInteract = true,
  onRequireAuth
}) => {
  // Recommendation Logic for Collections Tab
  const {
    boardArticles,
    suggestedArticles,
    selectedCollection,
    isAllArticlesView,
    isSuggestionsView,
    hasSavedArticles
  } = useMemo(() => {
    if (loading) {
      return {
        boardArticles: [],
        suggestedArticles: [],
        selectedCollection: null,
        isAllArticlesView: false,
        isSuggestionsView: false,
        hasSavedArticles: false
      };
    }

    const candidateMap = new Map<string, Article>();
    articles.forEach(article => candidateMap.set(article.id, article));

    const collectionArticlesMap = new Map<string, Article>();
    collections.forEach(col => {
      const colArticles = col.articles?.length
        ? col.articles
        : col.articleIds
            .map(id => candidateMap.get(id))
            .filter((article): article is Article => Boolean(article));

      colArticles.forEach(article => collectionArticlesMap.set(article.id, article));
    });

    collectionArticlesMap.forEach(article => {
      if (!candidateMap.has(article.id)) candidateMap.set(article.id, article);
    });

    const allSavedArticles = Array.from(collectionArticlesMap.values());
    const candidates = Array.from(candidateMap.values());

    const isAllArticles = selectedCollectionId === ALL_ARTICLES_ID;
    const isSuggestions = selectedCollectionId === null;
    const activeCollection = !isAllArticles && selectedCollectionId
      ? collections.find(col => col.id === selectedCollectionId) || null
      : null;

    const resolveBoardArticles = (collection: Collection | null) => {
      if (!collection) return [];
      if (collection.articles?.length) return collection.articles;
      return collection.articleIds
        .map(id => candidateMap.get(id))
        .filter((article): article is Article => Boolean(article));
    };

    let boardItems: Article[] = [];
    if (isAllArticles) {
      boardItems = allSavedArticles.length ? allSavedArticles : candidates;
    } else if (activeCollection) {
      boardItems = resolveBoardArticles(activeCollection);
    }

    const seedArticles = isSuggestions
      ? (allSavedArticles.length ? allSavedArticles : [])
      : boardItems;
    const interestedTags = new Set(seedArticles.flatMap(article => article.tags));

    let recommendations: Article[] = [];
    if (interestedTags.size > 0) {
      recommendations = candidates.filter(article =>
        article.tags.some(tag => interestedTags.has(tag))
      );

      if (!isSuggestions) {
        const boardIds = new Set(boardItems.map(article => article.id));
        recommendations = recommendations.filter(article => !boardIds.has(article.id));
      }

      recommendations = recommendations.sort(() => Math.random() - 0.5);
    }

    return {
      boardArticles: boardItems,
      suggestedArticles: recommendations,
      selectedCollection: activeCollection,
      isAllArticlesView: isAllArticles,
      isSuggestionsView: isSuggestions,
      hasSavedArticles: allSavedArticles.length > 0
    };
  }, [articles, collections, loading, selectedCollectionId]);

  return (
    <>
      {/* Collections Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 md:px-8 py-6 max-w-[2000px] mx-auto sticky top-[72px] z-30 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-sm transition-colors">
        <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap mr-2">
           {t(locale, 'collections.boards')}
        </span>
        
        <Tag 
          label={t(locale, 'collections.allArticles')} 
          selected={selectedCollectionId === ALL_ARTICLES_ID}
          onClick={() => onSelectCollection(ALL_ARTICLES_ID)}
        />

        <Tag 
          label={t(locale, 'collections.allBoards')} 
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

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64 text-gray-400">
           <div className="animate-pulse flex flex-col items-center">
             <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-full mb-4"></div>
             <p>{t(locale, 'collections.loading')}</p>
           </div>
        </div>
      ) : (
        <>
          {!isSuggestionsView && (
            <>
              <div className="px-4 md:px-8 pb-4 max-w-[2000px] mx-auto flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="text-sm font-medium">
                  {isAllArticlesView ? t(locale, 'collections.allArticles') : selectedCollection?.name || t(locale, 'collections.board')}
                </span>
              </div>

              {boardArticles.length === 0 ? (
                <div className="text-center py-14 text-gray-500">
                  <p className="text-xl mb-4">
                    {isAllArticlesView
                      ? t(locale, 'collections.saveToBuild')
                      : t(locale, 'collections.emptyBoard')}
                  </p>
                  <button 
                    onClick={onNavigateHome}
                    className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                  >
                    {t(locale, 'collections.exploreFeed')}
                  </button>
                </div>
              ) : (
                <MasonryGrid>
                  {boardArticles.map(article => (
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
            </>
          )}

          <div className="px-4 md:px-8 pb-4 max-w-[2000px] mx-auto flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Sparkles size={16} />
            <span className="text-sm font-medium">
              {isSuggestionsView
                ? t(locale, 'collections.suggestionsAll')
                : t(locale, 'collections.suggestionsBoard')}
            </span>
          </div>

          {suggestedArticles.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-xl mb-4">
                {hasSavedArticles
                  ? t(locale, 'collections.notEnoughData')
                  : t(locale, 'collections.saveForSuggestions')}
              </p>
              <button 
                onClick={onNavigateHome}
                className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                {t(locale, 'collections.exploreFeed')}
              </button>
            </div>
          ) : (
            <MasonryGrid>
              {suggestedArticles.map(article => (
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
        </>
      )}
    </>
  );
};
