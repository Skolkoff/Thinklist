
import React, { useState } from 'react';
import { Collection, CollectionVisibility } from '../types';
import { X, Plus, Lock, Globe, Users, UserCheck } from 'lucide-react';

interface SaveBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  onSaveToCollection: (collectionId: string) => void;
  onCreateCollection: (name: string, visibility: CollectionVisibility) => void;
}

export const SaveBoardModal: React.FC<SaveBoardModalProps> = ({
  isOpen, onClose, collections, onSaveToCollection, onCreateCollection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('public');

  if (!isOpen) return null;

  const filteredCollections = collections.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName, visibility);
      setNewCollectionName('');
      setVisibility('public');
      setIsCreating(false);
    }
  };

  const visibilityOptions: { value: CollectionVisibility; label: string; icon: React.ReactNode }[] = [
    { value: 'public', label: 'Public', icon: <Globe size={14} /> },
    { value: 'friends', label: 'Friends', icon: <Users size={14} /> },
    { value: 'followers', label: 'Followers', icon: <UserCheck size={14} /> },
    { value: 'private', label: 'Private', icon: <Lock size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 text-center border-b border-gray-100 dark:border-dark-border relative">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Save to board</h2>
          <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {!isCreating ? (
            <div className="relative mb-4">
               <input 
                 type="text" 
                 placeholder="Search" 
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
                   placeholder="Board Name" 
                   value={newCollectionName}
                   onChange={(e) => setNewCollectionName(e.target.value)}
                   className="w-full bg-gray-100 dark:bg-dark-bg rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                   onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                   {visibilityOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setVisibility(opt.value)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border whitespace-nowrap
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
                   className="bg-primary text-white w-full py-3 rounded-full font-bold hover:bg-red-700 transition-colors mt-1"
                >
                   Create Board
                </button>
             </div>
          )}

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {!isCreating && (
              <>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">All boards</p>
                {filteredCollections.map(col => (
                  <div 
                    key={col.id} 
                    onClick={() => onSaveToCollection(col.id)}
                    className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        {col.coverImage && <img src={col.coverImage} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{col.name}</span>
                        {col.visibility === 'private' && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Lock size={10}/> Private</span>}
                        {col.visibility === 'friends' && <span className="text-[10px] text-gray-500 flex items-center gap-1"><Users size={10}/> Friends</span>}
                      </div>
                    </div>
                    <button className="bg-primary text-white px-3 py-1.5 text-sm font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      Save
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
             <span className="font-bold text-gray-900 dark:text-white">Create Board</span>
          </div>
        )}
      </div>
    </div>
  );
};