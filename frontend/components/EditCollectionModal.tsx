
import React, { useEffect, useRef, useState } from 'react';
import { Collection, CollectionVisibility } from '../types';
import { X, Lock, Globe, UserCheck, Trash2 } from 'lucide-react';
import { Locale, t } from '../i18n';

interface EditCollectionModalProps {
  collection?: Collection; // Optional for Create Mode
  onClose: () => void;
  onUpdate?: (id: string, data: Partial<Collection>) => void;
  onDelete?: () => void;
  onCreate?: (name: string, visibility: CollectionVisibility) => void;
  locale: Locale;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  collection, onClose, onUpdate, onDelete, onCreate, locale
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isEditing = !!collection;
  const [name, setName] = useState(collection?.name || '');
  const [visibility, setVisibility] = useState<CollectionVisibility>(collection?.visibility || 'public');

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (isEditing && collection && onUpdate) {
      onUpdate(collection.id, {
        name,
        visibility,
        isPrivate: visibility === 'private'
      });
    } else if (onCreate) {
      onCreate(name, visibility);
    }
    onClose();
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
        aria-labelledby="edit-board-title"
        className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 text-center border-b border-gray-100 dark:border-dark-border relative">
          <h2 id="edit-board-title" className="font-bold text-lg text-gray-900 dark:text-white">
            {isEditing ? t(locale, 'board.edit') : t(locale, 'board.create')}
          </h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label={t(locale, 'board.close')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
            <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'board.name')}</label>
                  <input 
                    type="text" 
                    autoFocus
                    placeholder={t(locale, 'board.namePlaceholder')} 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-dark-bg rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t(locale, 'board.visibility')}</label>
                  <div className="grid grid-cols-2 gap-2">
                      {visibilityOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setVisibility(opt.value)}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all border
                            ${visibility === opt.value 
                              ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                              : 'bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/10'}`}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                  </div>
                </div>

                <button 
                   onClick={handleSave}
                   disabled={!name.trim()}
                   className={`w-full py-3 rounded-full font-bold transition-colors mt-2 ${!name.trim() ? 'bg-gray-200 dark:bg-white/10 text-gray-400' : 'bg-primary text-white hover:bg-red-700'}`}
                >
                   {isEditing ? t(locale, 'board.saveChanges') : t(locale, 'board.create')}
                </button>

                {isEditing && onDelete && (
                  <div className="pt-4 mt-2 border-t border-gray-100 dark:border-dark-border flex justify-center">
                     <button 
                       onClick={onDelete}
                       className="text-red-600 dark:text-red-400 font-semibold text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                     >
                       <Trash2 size={16} /> {t(locale, 'board.delete')}
                     </button>
                  </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};
