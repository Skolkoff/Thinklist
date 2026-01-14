
import React, { useState, useEffect } from 'react';
import { UserProfile, Collection, Article, CollectionVisibility } from '../types';
import { ArticleCard } from './ArticleCard';
import { MasonryGrid } from './MasonryGrid';
import { EditCollectionModal } from './EditCollectionModal';
import { Edit2, MapPin, Briefcase, FolderOpen, Check, MoreHorizontal, Share2, Settings, Trash2, Lock, Users, AlertCircle, Plus } from 'lucide-react';

interface ProfileViewProps {
  user: UserProfile;
  isOwnProfile: boolean;
  collections: Collection[];
  articles: Article[]; // Created/Published articles
  onEditProfile: () => void;
  onOpenArticle: (article: Article) => void;
  onDeleteCollection: (id: string) => void;
  onUpdateCollection: (id: string, data: Partial<Collection>) => void;
  onCreateCollection: (name: string, visibility: CollectionVisibility) => void;
  onNavigateToCollection: (collectionId: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user, isOwnProfile, collections, articles, onEditProfile, onOpenArticle, onDeleteCollection, onUpdateCollection, onCreateCollection, onNavigateToCollection
}) => {
  const [activeTab, setActiveTab] = useState<'created' | 'saved'>('created');
  
  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Modal & Notification State
  const [deleteConfirmCollection, setDeleteConfirmCollection] = useState<Collection | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter collections: If not own profile, hide private collections
  const visibleCollections = isOwnProfile 
    ? collections 
    : collections.filter(c => !c.isPrivate);

  useEffect(() => {
    // Close menu on click outside
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShareCollection = async (col: Collection) => {
    setActiveMenuId(null);
    const url = `${window.location.origin}/collection/${col.id}`;
    
    // Use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: col.name,
          text: `Check out this board: ${col.name}`,
          url: url
        });
      } catch (err) {
        // User cancelled or share failed
        console.debug('Share cancelled');
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(url).then(() => {
        showToast("Board link copied to clipboard!");
      }).catch(() => {
        showToast("Failed to copy link");
      });
    }
  };

  const handleDeleteRequest = (col: Collection) => {
    setActiveMenuId(null);
    setCollectionToEdit(null);
    setDeleteConfirmCollection(col);
  };

  const confirmDelete = () => {
    if (deleteConfirmCollection) {
      onDeleteCollection(deleteConfirmCollection.id);
      setDeleteConfirmCollection(null);
      showToast("Board deleted");
    }
  };

  return (
    <div className="max-w-[2000px] mx-auto relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-full shadow-xl font-semibold text-sm flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
           <Check size={16} /> {toastMessage}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCollection && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-card w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-4">
                   <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete this board?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  Are you sure you want to delete <strong>{deleteConfirmCollection.name}</strong>? This action cannot be undone. Articles will remain in your library.
                </p>
                <div className="flex gap-3 w-full">
                   <button 
                     onClick={() => setDeleteConfirmCollection(null)}
                     className="flex-1 py-3 rounded-full font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={confirmDelete}
                     className="flex-1 py-3 rounded-full font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
                   >
                     Delete
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex flex-col items-center pt-8 pb-8 px-4">
        <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-white dark:border-dark-bg shadow-sm">
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{user.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">@{user.nickname}</p>

        {(user.workplace || user.fieldOfStudy) && (
           <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300 mb-4">
             {user.workplace && <span className="flex items-center gap-1"><Briefcase size={14}/> {user.workplace}</span>}
             {user.fieldOfStudy && <span className="flex items-center gap-1"><MapPin size={14}/> {user.fieldOfStudy}</span>}
           </div>
        )}

        {user.bio && (
          <p className="text-center max-w-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
            {user.bio}
          </p>
        )}
        
        <div className="flex gap-3 mb-6">
           <div className="text-center px-4">
              <span className="block font-bold text-gray-900 dark:text-white">{collections.length}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Boards</span>
           </div>
           <div className="text-center px-4">
              <span className="block font-bold text-gray-900 dark:text-white">{user.interests.length}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Interests</span>
           </div>
        </div>

        {/* Interests List */}
        {user.interests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xl">
             {user.interests.map(interest => (
               <div key={interest} className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-full">
                 {interest}
               </div>
             ))}
          </div>
        )}

        {isOwnProfile ? (
          <div className="flex gap-2">
            <button 
              onClick={onEditProfile}
              className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white px-6 py-3 rounded-full font-semibold transition-colors flex items-center gap-2"
            >
              <Edit2 size={16} /> Edit Profile
            </button>
            <button 
              onClick={() => {
                 const url = window.location.href;
                 navigator.clipboard.writeText(url).then(() => showToast("Profile link copied!"));
              }}
              className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Share
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button 
              onClick={() => {
                 const url = window.location.href;
                 navigator.clipboard.writeText(url).then(() => showToast("Profile link copied!"));
              }}
              className="bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Share
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8 border-b border-gray-100 dark:border-dark-border">
         <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('created')}
              className={`pb-3 font-semibold text-base transition-colors border-b-2 ${
                activeTab === 'created' 
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' 
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Publications
            </button>
            <button 
              onClick={() => setActiveTab('saved')}
              className={`pb-3 font-semibold text-base transition-colors border-b-2 ${
                activeTab === 'saved' 
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' 
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Saved Boards
            </button>
         </div>
      </div>

      {/* Content Grid */}
      <div className="px-4">
        {activeTab === 'created' ? (
           articles.length > 0 ? (
            <MasonryGrid>
              {articles.map(article => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  onOpen={onOpenArticle}
                />
              ))}
            </MasonryGrid>
           ) : (
             <div className="text-center py-12 text-gray-400">
               <p>No publications yet.</p>
             </div>
           )
        ) : (
           visibleCollections.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-3xl max-w-2xl mx-auto px-6">
                <FolderOpen size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {isOwnProfile ? "You haven't saved any boards yet" : "No public boards yet"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">
                  {isOwnProfile 
                    ? "Organize your research by creating boards for different topics and projects. Create your first board!" 
                    : "This researcher hasn't shared any boards yet."}
                </p>
                {isOwnProfile && (
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 transition-colors shadow-lg flex items-center gap-2 mx-auto"
                  >
                    <Plus size={20} /> Create Board
                  </button>
                )}
              </div>
           ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
                
                {/* Create Board Button (First Item) */}
                {isOwnProfile && (
                    <div 
                      onClick={() => setIsCreateModalOpen(true)}
                      className="group cursor-pointer flex flex-col relative"
                    >
                      <div className="bg-gray-100 dark:bg-white/5 rounded-2xl overflow-hidden aspect-[4/3] mb-3 relative flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-gray-300 dark:group-hover:bg-white/20 transition-colors">
                            <Plus size={24} />
                          </div>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">Create Board</h3>
                    </div>
                )}

                {visibleCollections.map(col => (
                    <div 
                      key={col.id} 
                      className="group cursor-pointer flex flex-col relative"
                      onClick={() => onNavigateToCollection(col.id)}
                    >
                      <div className="bg-gray-100 dark:bg-white/5 rounded-2xl overflow-hidden aspect-[4/3] mb-3 relative group/image">
                          {col.coverImage ? (
                            <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600">
                              <FolderOpen size={48} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
                          
                          {/* Meatball Menu Button */}
                          {isOwnProfile && (
                            <div className="absolute top-2 right-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === col.id ? null : col.id);
                                }}
                                className={`p-2 rounded-full bg-white/90 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 shadow-sm backdrop-blur-sm transition-opacity ${activeMenuId === col.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              >
                                <MoreHorizontal size={18} className="text-gray-700 dark:text-white" />
                              </button>
                              
                              {/* Dropdown Menu */}
                              {activeMenuId === col.id && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-gray-100 dark:border-dark-border z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setCollectionToEdit(col); setActiveMenuId(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 text-left"
                                    >
                                      <Settings size={16} /> Settings
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleShareCollection(col); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 text-left"
                                    >
                                      <Share2 size={16} /> Share
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-white/10 mx-2" />
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteRequest(col); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
                                    >
                                      <Trash2 size={16} /> Delete
                                    </button>
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{col.name}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 flex items-center gap-2">
                        {col.articleIds.length} Pins
                        {col.isPrivate && <span className="bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1"><Lock size={10}/> Private</span>}
                      </p>
                    </div>
                ))}
              </div>
           )
        )}
      </div>

      {collectionToEdit && (
        <EditCollectionModal 
          collection={collectionToEdit}
          onClose={() => setCollectionToEdit(null)}
          onUpdate={onUpdateCollection}
          onDelete={() => handleDeleteRequest(collectionToEdit)}
        />
      )}

      {isCreateModalOpen && (
        <EditCollectionModal 
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={onCreateCollection}
        />
      )}
    </div>
  );
};
