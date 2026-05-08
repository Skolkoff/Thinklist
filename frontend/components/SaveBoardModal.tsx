
import React, { useEffect, useRef, useState } from 'react';
import { Collection, CollectionVisibility } from '../types';
import { X, Plus, Lock, Globe, UserCheck, FolderOpen } from 'lucide-react';
import { Locale, t } from '../i18n';

interface SaveBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  locale: Locale;
  onSaveToCollection: (collectionId: string) => void;
  onCreateCollection: (name: string, visibility: CollectionVisibility) => void;
}

export const SaveBoardModal: React.FC<SaveBoardModalProps> = ({
  isOpen, onClose, collections, locale, onSaveToCollection, onCreateCollection
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('public');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCollections = collections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveToCollection = async (collectionId: string) => {
    setError(null);
    setPendingAction(collectionId);
    try {
      await Promise.resolve(onSaveToCollection(collectionId));
    } catch {
      setError(t(locale, 'board.saveFailed'));
      setPendingAction(null);
    }
  };

  const handleCreate = async () => {
    if (newCollectionName.trim()) {
      setError(null);
      setPendingAction('create');
      try {
        await Promise.resolve(onCreateCollection(newCollectionName, visibility));
      } catch {
        setError(t(locale, 'board.createFailed'));
        setPendingAction(null);
        return;
      }
      setNewCollectionName('');
      setVisibility('public');
      setIsCreating(false);
    }
  };

  const visibilityOptions: { value: CollectionVisibility; label: string; icon: React.ReactNode }[] = [
    { value: 'public', label: t(locale, 'board.public'), icon: <Globe size={14} /> },
    { value: 'followers', label: t(locale, 'board.followers'), icon: <UserCheck size={14} /> },
    { value: 'private', label: t(locale, 'board.private'), icon: <Lock size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-board-title"
        className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 text-center border-b border-gray-100 dark:border-dark-border relative">
          <h2 id="save-board-title" className="font-bold text-lg text-gray-900 dark:text-white">{t(locale, 'board.saveTo')}</h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label={t(locale, 'board.closeSave')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {!isCreating ? (
            <div className="relative mb-4">
               <input 
                 type="text" 
                 placeholder={t(locale, 'board.search')} 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-gray-100 dark:bg-dark-bg rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
               />
            </div>
          ) : (
             <div className="flex flex-col gap-3 mb-4">
                <input 
                   type="text" 
                   autoFocus
                   placeholder={t(locale, 'board.name')} 
                   value={newCollectionName}
                   onChange={(e) => setNewCollectionName(e.target.value)}
                   className="w-full bg-gray-100 dark:bg-dark-bg rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                   onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                
                <div className="grid grid-cols-3 gap-2">
                   {visibilityOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setVisibility(opt.value)}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all border min-w-0
                          ${visibility === opt.value 
                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                            : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/10'}`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                   ))}
                </div>

                <button 
                   onClick={handleCreate}
                   disabled={!newCollectionName.trim() || pendingAction === 'create'}
                   className={`w-full py-3 rounded-full font-bold transition-colors mt-1 ${!newCollectionName.trim() || pendingAction === 'create' ? 'bg-gray-200 dark:bg-white/10 text-gray-400' : 'bg-primary text-white hover:bg-red-700'}`}
                >
                   {pendingAction === 'create' ? t(locale, 'board.creating') : t(locale, 'board.create')}
                </button>
             </div>
          )}

          {error && (
            <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {!isCreating && (
              <>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t(locale, 'board.all')}</p>
                {filteredCollections.length === 0 ? (
                  <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                    <FolderOpen size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm font-medium">
                      {collections.length === 0 ? t(locale, 'board.noBoards') : t(locale, 'board.noSearch')}
                    </p>
                  </div>
                ) : filteredCollections.map(col => (
                  <div 
                    key={col.id} 
                    onClick={() => pendingAction ? undefined : handleSaveToCollection(col.id)}
                    className={`flex items-center justify-between p-2 rounded-xl group transition-colors ${pendingAction ? 'cursor-wait opacity-70' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        {col.coverImage && <img src={col.coverImage} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{col.name}</span>
                        {col.visibility === 'private' && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Lock size={10}/> {t(locale, 'board.private')}</span>}
                        {col.visibility === 'followers' && <span className="text-[10px] text-gray-500 flex items-center gap-1"><UserCheck size={10}/> {t(locale, 'board.followers')}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(pendingAction)}
                      className="bg-primary text-white px-3 py-1.5 text-sm font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {pendingAction === col.id ? t(locale, 'board.saving') : t(locale, 'board.save')}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {!isCreating && (
          <div 
            className="p-4 border-t border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors"
            onClick={() => setIsCreating(true)}
          >
             <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center">
               <Plus size={24} className="text-gray-900 dark:text-white" />
             </div>
             <span className="font-bold text-gray-900 dark:text-white">{t(locale, 'board.create')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
