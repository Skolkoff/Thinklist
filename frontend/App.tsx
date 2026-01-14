
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { ArticleModal } from './components/ArticleModal';
import { ProfileView } from './components/ProfileView';
import { EditProfileModal } from './components/EditProfileModal';
import { SaveBoardModal } from './components/SaveBoardModal';
import { HomeFeed } from './components/HomeFeed';
import { CollectionsFeed } from './components/CollectionsFeed';
import { api } from './services/api';
import { Article, FilterState, ViewState, Collection, UserProfile, CollectionVisibility, Theme } from './types';

const App: React.FC = () => {
  // State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.FEED);
  
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
  
  // Content State
  const [articles, setArticles] = useState<Article[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  // Init User
  useEffect(() => {
    const initUser = async () => {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
      setProfileUserId(user.id); // Default to viewing own profile if navigated
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

  // Data Fetching
  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedArticles, fetchedCollections] = await Promise.all([
        api.fetchArticles(filters),
        api.getCollections(profileUserId && currentView === ViewState.PROFILE ? profileUserId : undefined)
      ]);
      setArticles(fetchedArticles);
      setCollections(fetchedCollections);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  }, [filters, currentView, profileUserId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Handle Profile Navigation
  const handleNavigateToProfile = async (userId: string) => {
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

  const handleSearchChange = (q: string) => {
    setFilters(prev => ({ ...prev, searchQuery: q }));
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = await api.updateUserProfile(data);
    setCurrentUser(updated);
    setViewedProfileUser(updated); // Update view if looking at self
  };

  const handleAuthorClick = (authorId: string) => {
    setSelectedArticle(null); // Close modal
    if (currentUser && authorId.includes(currentUser.id)) {
       handleNavigateToProfile(currentUser.id);
    } else {
       handleNavigateToProfile('u3');
    }
  };

  // Save Flow
  const handleOpenSaveModal = (article: Article) => {
    setArticleToSave(article);
    setIsSaveModalOpen(true);
  };

  const handleSaveToCollection = async (collectionId: string) => {
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

  if (!currentUser) return <div className="h-screen flex items-center justify-center bg-white dark:bg-dark-bg text-gray-900 dark:text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg transition-colors duration-300">
      <Navbar 
        user={currentUser} 
        searchQuery={filters.searchQuery}
        onSearchChange={handleSearchChange}
        onNavigate={(view) => {
          if (view === ViewState.PROFILE) {
            handleNavigateToProfile(currentUser.id);
          } else {
            setCurrentView(view);
          }
        }}
        currentView={currentView}
      />
      
      <main className="pt-2">
        {currentView === ViewState.FEED && (
          <HomeFeed 
            articles={articles}
            loading={loading}
            filters={filters}
            onTagToggle={handleTagToggle}
            onClearFilters={() => setFilters({ searchQuery: '', selectedTags: [] })}
            onOpenArticle={setSelectedArticle}
            onSaveArticle={handleOpenSaveModal}
          />
        )}

        {currentView === ViewState.COLLECTIONS && (
          <CollectionsFeed 
            articles={articles}
            collections={collections}
            loading={loading}
            selectedCollectionId={selectedCollectionId}
            onSelectCollection={setSelectedCollectionId}
            onOpenArticle={setSelectedArticle}
            onSaveArticle={handleOpenSaveModal}
            onNavigateHome={() => setCurrentView(ViewState.FEED)}
          />
        )}

        {currentView === ViewState.PROFILE && viewedProfileUser && (
          <ProfileView 
            user={viewedProfileUser}
            isOwnProfile={viewedProfileUser.id === currentUser.id}
            collections={collections}
            articles={articles}
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
          onClose={() => setSelectedArticle(null)}
          onAuthorClick={handleAuthorClick}
          onSave={handleOpenSaveModal}
          relatedArticles={relatedArticles}
          onOpenArticle={setSelectedArticle}
        />
      )}

      {isEditProfileOpen && (
        <EditProfileModal
          user={currentUser}
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          onSave={handleUpdateProfile}
          onChangePassword={api.changePassword}
          currentTheme={theme}
          onThemeChange={setTheme}
        />
      )}

      {isSaveModalOpen && (
        <SaveBoardModal 
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          collections={collections}
          onSaveToCollection={handleSaveToCollection}
          onCreateCollection={handleCreateAndSave}
        />
      )}
    </div>
  );
};

export default App;
