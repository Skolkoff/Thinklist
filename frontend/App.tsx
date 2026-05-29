
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { ArticleModal } from './components/ArticleModal';
import { ProfileView } from './components/ProfileView';
import { EditProfileModal } from './components/EditProfileModal';
import { SaveBoardModal } from './components/SaveBoardModal';
import { HomeFeed } from './components/HomeFeed';
import { CollectionsFeed } from './components/CollectionsFeed';
import { AuthGate } from './components/AuthGate';
import { api } from './services/api';
import { AVAILABLE_TAGS } from './services/mockData';
import { Article, FilterState, ViewState, Collection, UserProfile, CollectionVisibility, Theme } from './types';
import { LanguagePreference, Locale, resolveLocale, t } from './i18n';

const App: React.FC = () => {
  // State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.FEED);
  const [languagePreference, setLanguagePreference] = useState<LanguagePreference>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('languagePreference') as LanguagePreference | null;
      if (stored === 'system' || stored === 'en' || stored === 'ru') return stored;
    }
    return 'system';
  });
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(languagePreference));
  
  // Theme State
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme') as Theme;
    }
    return 'system';
  });

  // Profile View State
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [viewedProfileUser, setViewedProfileUser] = useState<UserProfile | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'guest'>('loading');
  const [showAuthGate, setShowAuthGate] = useState(false);
  
  // Content State
  const [articles, setArticles] = useState<Article[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>(AVAILABLE_TAGS);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  
  // Interaction State
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articleToSave, setArticleToSave] = useState<Article | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedTags: []
  });

  // Collections View State
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await api.fetchTags();
        if (tags.length) setAvailableTags(tags);
      } catch (error) {
        console.warn("Failed to load tags", error);
      }
    };
    loadTags();
  }, []);

  // Init User
  useEffect(() => {
    const initUser = async () => {
      if (!api.hasToken()) {
        setCurrentUser(null);
        setProfileUserId(null);
        setAuthStatus('guest');
        return;
      }

      try {
        const user = await api.getCurrentUser();
        setCurrentUser(user);
        setLanguagePreference(user.languagePreference || 'system');
        setProfileUserId(user.id); // Default to viewing own profile if navigated
        setAuthStatus('authenticated');
      } catch (error) {
        api.logout();
        setCurrentUser(null);
        setProfileUserId(null);
        setAuthStatus('guest');
      }
    };
    initUser();
  }, []);

  // Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    setLocale(resolveLocale(languagePreference));
    localStorage.setItem('languagePreference', languagePreference);
  }, [languagePreference]);

  // Data Fetching
  const fetchContent = useCallback(async () => {
    setLoading(true);
    setLoadingMore(false);
    try {
      const page = await api.fetchArticles(filters);
      setArticles(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));

      if (currentUser) {
        const fetchedCollections = await api.getCollections(
          profileUserId && currentView === ViewState.PROFILE ? profileUserId : undefined
        );
        setCollections(fetchedCollections);
      } else {
        setCollections([]);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [filters, currentView, profileUserId, currentUser]);

  useEffect(() => {
    if (authStatus !== 'loading') {
      fetchContent();
    }
  }, [fetchContent, authStatus]);

  const loadMoreArticles = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await api.fetchArticles(filters, nextCursor);
      setArticles(prev => {
        // append new pages while deduplicating articles that may also be saved.
        const merged = new Map(prev.map(article => [article.id, article]));
        page.items.forEach(article => merged.set(article.id, article));
        return Array.from(merged.values());
      });
      setNextCursor(page.nextCursor);
      setHasMore(Boolean(page.nextCursor));
    } catch (error) {
      console.error("Failed to load more articles", error);
    } finally {
      setLoadingMore(false);
    }
  }, [filters, nextCursor, loadingMore, loading]);

  // Handle Profile Navigation
  const handleNavigateToProfile = async (userId: string) => {
    if (!currentUser) {
      setShowAuthGate(true);
      return;
    }
    setProfileUserId(userId);
    const user = await api.getUserProfile(userId);
    setViewedProfileUser(user);
    setCurrentView(ViewState.PROFILE);
  };

  // Handlers
  const handleTagToggle = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag]
    }));
  };

  const requireAuth = () => {
    if (!currentUser) {
      setShowAuthGate(true);
      return false;
    }
    return true;
  };

  const handleSearchChange = (q: string) => {
    setFilters(prev => ({ ...prev, searchQuery: q }));
    if (q.trim().length >= 2 && currentView !== ViewState.FEED) {
      setSelectedCollectionId(null);
      setCurrentView(ViewState.FEED);
    }
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = await api.updateUserProfile(data);
    setCurrentUser(updated);
    setViewedProfileUser(updated); // Update view if looking at self
    setLanguagePreference(updated.languagePreference || 'system');
  };

  const handleLanguagePreferenceChange = async (next: LanguagePreference) => {
    const previous = currentUser?.languagePreference || languagePreference;
    setLanguagePreference(next);
    if (!currentUser) return;
    try {
      const updated = await api.updateUserProfile({ languagePreference: next });
      setCurrentUser(updated);
      setViewedProfileUser(updated);
      setLanguagePreference(updated.languagePreference || next);
    } catch (error) {
      setLanguagePreference(previous);
      console.error("Failed to update language preference", error);
    }
  };

  const handleAuthorClick = (authorName: string) => {
    setSelectedArticle(null);
    setFilters(prev => ({ ...prev, searchQuery: authorName }));
    setSelectedCollectionId(null);
    setCurrentView(ViewState.FEED);
  };

  // Save Flow
  const handleOpenSaveModal = (article: Article) => {
    if (!requireAuth()) return;
    setArticleToSave(article);
    setIsSaveModalOpen(true);
  };

  const handleSaveToCollection = async (collectionId: string) => {
    if (!requireAuth()) return;
    if (articleToSave) {
      await api.addArticleToCollection(collectionId, articleToSave.id);
      setIsSaveModalOpen(false);
      setArticleToSave(null);
      // Refresh collections to show updated count/cover
      const updatedCols = await api.getCollections(currentUser?.id);
      setCollections(updatedCols);
    }
  };

  const handleCreateAndSave = async (name: string, visibility: CollectionVisibility) => {
    if (!requireAuth()) return;
    if (articleToSave) {
      const newCol = await api.createCollection(name, visibility);
      await api.addArticleToCollection(newCol.id, articleToSave.id);
      setIsSaveModalOpen(false);
      setArticleToSave(null);
      const updatedCols = await api.getCollections(currentUser?.id);
      setCollections(updatedCols);
    }
  };

  // Collection Management
  const handleDeleteCollection = async (collectionId: string) => {
    const success = await api.deleteCollection(collectionId);
    if (success) {
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      if (selectedCollectionId === collectionId) {
        setSelectedCollectionId(null);
        setCurrentView(ViewState.FEED);
      }
    }
  };

  const handleUpdateCollection = async (collectionId: string, data: Partial<Collection>) => {
    const updated = await api.updateCollection(collectionId, data);
    if (updated) {
      setCollections(prev => prev.map(c => c.id === collectionId ? updated : c));
    }
  };

  // Standalone Create (for Profile View)
  const handleCreateCollection = async (name: string, visibility: CollectionVisibility) => {
      const newCol = await api.createCollection(name, visibility);
      setCollections(prev => [...prev, newCol]);
  };

  const handleNavigateToCollection = (collectionId: string) => {
      setSelectedCollectionId(collectionId);
      setCurrentView(ViewState.COLLECTIONS);
  };

  // Calculate related articles
  const relatedArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return articles
      .filter(a =>
        a.id !== selectedArticle.id &&
        (
          a.tags.some(t => selectedArticle.tags.includes(t)) ||
          a.authors.some(auth => selectedArticle.authors.some(sa => sa.id === auth.id))
        )
      )
      .slice(0, 3);
  }, [selectedArticle, articles]);

  const profileArticles = useMemo<Article[]>(() => {
    // There is no user-authored publication relation in the current API.
    // Keep the profile tab honest instead of showing the global feed as "my" work.
    return [];
  }, []);

  if (authStatus === 'loading') {
    return <div className="h-screen flex items-center justify-center bg-white dark:bg-dark-bg text-gray-900 dark:text-white">{t(locale, 'app.loading')}</div>;
  }

  if (showAuthGate) {
    return (
      <AuthGate
        availableTags={availableTags}
        locale={locale}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setLanguagePreference(user.languagePreference || 'system');
          setProfileUserId(user.id);
          setAuthStatus('authenticated');
          setShowAuthGate(false);
        }}
        onClose={() => setShowAuthGate(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg transition-colors duration-300">
      <Navbar 
        user={currentUser} 
        locale={locale}
        searchQuery={filters.searchQuery}
        onSearchChange={handleSearchChange}
        onNavigate={(view) => {
          if (view === ViewState.PROFILE) {
            if (currentUser) {
              handleNavigateToProfile(currentUser.id);
            } else {
              setShowAuthGate(true);
            }
          } else {
            if (view === ViewState.COLLECTIONS) {
              setSelectedCollectionId('all');
            }
            setCurrentView(view);
          }
        }}
        currentView={currentView}
        onAuthClick={() => setShowAuthGate(true)}
      />
      
      <main className="pb-24 md:pb-0">
        {currentView === ViewState.FEED && (
          <HomeFeed 
            articles={articles}
            availableTags={availableTags}
            locale={locale}
            loading={loading}
            filters={filters}
            onTagToggle={handleTagToggle}
            onClearFilters={() => setFilters({ searchQuery: '', selectedTags: [] })}
            onOpenArticle={setSelectedArticle}
            onSaveArticle={handleOpenSaveModal}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMoreArticles}
            canInteract={Boolean(currentUser)}
            onRequireAuth={() => setShowAuthGate(true)}
          />
        )}

        {currentView === ViewState.COLLECTIONS && (
          <CollectionsFeed 
            articles={articles}
            collections={collections}
            locale={locale}
            loading={loading}
            selectedCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
            onOpenArticle={setSelectedArticle}
            onSaveArticle={handleOpenSaveModal}
            onNavigateHome={() => setCurrentView(ViewState.FEED)}
            canInteract={Boolean(currentUser)}
            onRequireAuth={() => setShowAuthGate(true)}
          />
        )}

        {currentView === ViewState.PROFILE && currentUser && viewedProfileUser && (
          <ProfileView 
            user={viewedProfileUser}
            locale={locale}
            isOwnProfile={viewedProfileUser.id === currentUser.id}
            collections={collections}
            articles={profileArticles}
            onEditProfile={() => setIsEditProfileOpen(true)}
            onOpenArticle={setSelectedArticle}
            onDeleteCollection={handleDeleteCollection}
            onUpdateCollection={handleUpdateCollection}
            onCreateCollection={handleCreateCollection}
            onNavigateToCollection={handleNavigateToCollection}
          />
        )}
      </main>

      {/* Modals */}
      {selectedArticle && (
        <ArticleModal 
          article={selectedArticle} 
          locale={locale}
          onClose={() => setSelectedArticle(null)}
          onAuthorClick={handleAuthorClick}
          onSave={handleOpenSaveModal}
          relatedArticles={relatedArticles}
          onOpenArticle={setSelectedArticle}
          canInteract={Boolean(currentUser)}
          onRequireAuth={() => setShowAuthGate(true)}
        />
      )}

      {currentUser && isEditProfileOpen && (
        <EditProfileModal
          user={currentUser}
          isOpen={isEditProfileOpen}
          availableTags={availableTags}
          locale={locale}
          currentLanguagePreference={languagePreference}
          onLanguagePreferenceChange={handleLanguagePreferenceChange}
            onClose={() => setIsEditProfileOpen(false)}
            onSave={handleUpdateProfile}
            onChangePassword={api.changePassword}
            currentTheme={theme}
          onThemeChange={setTheme}
        />
      )}

      {currentUser && isSaveModalOpen && (
        <SaveBoardModal 
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          collections={collections}
          locale={locale}
          onSaveToCollection={handleSaveToCollection}
          onCreateCollection={handleCreateAndSave}
        />
      )}
    </div>
  );
};

export default App;
