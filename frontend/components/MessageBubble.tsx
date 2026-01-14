
import React, { useState, useRef, useEffect } from 'react';
import { Message, Reaction } from '../types';
import { Layers, Smile, Edit2, Trash2, Copy, CornerUpLeft } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  senderName?: string;
  senderAvatar?: string;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onNavigateToCollection?: (collectionId: string) => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  senderName,
  senderAvatar,
  onReact,
  onDelete,
  onEdit,
  onReply,
  onNavigateToCollection
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);

  // --- Handlers ---

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      setShowMenu(false);
      setShowMobileMenu(false);
    }
  };

  // Double Tap (Mobile)
  const handleTouchStart = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected -> Like
      onReact(message.id, '❤️');
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    } else {
      lastTapRef.current = now;
      // Start Long Press Timer
      longPressTimerRef.current = setTimeout(() => {
        setShowMobileMenu(true);
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMobileMenu(true); // Treat right click like long press
  };

  // --- Renderers ---

  const renderContent = () => {
    return (
      <div className={`
        px-4 py-2 rounded-2xl text-sm relative select-none
        ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-bl-none'}
      `}>
        {/* Name in group chats (optional) */}
        {!isMe && senderName && (
          <div className="text-[10px] font-bold opacity-60 mb-0.5">{senderName}</div>
        )}

        {/* Text */}
        {message.type === 'text' && <span className="whitespace-pre-wrap">{message.text}</span>}
        
        {/* Image Attachment */}
        {message.type === 'image' && message.attachment && (
          <div className="rounded-lg overflow-hidden mt-1 mb-1">
            <img src={message.attachment.url} alt="Attachment" className="max-w-full h-auto max-h-60 object-cover" />
          </div>
        )}

        {/* Video Attachment */}
        {message.type === 'video' && message.attachment && (
          <div className="rounded-lg overflow-hidden mt-1 mb-1 bg-black flex items-center justify-center max-h-60 relative">
             <video src={message.attachment.url} controls className="max-w-full max-h-60 rounded-lg" />
          </div>
        )}

        {/* Board/Collection Attachment */}
        {message.type === 'collection' && message.attachment && (
          <div 
              onClick={(e) => {
                e.stopPropagation();
                if (message.attachment?.id && onNavigateToCollection) onNavigateToCollection(message.attachment.id);
              }}
              className={`rounded-xl overflow-hidden mt-1 mb-1 border cursor-pointer transition-transform hover:scale-95 active:scale-90 ${isMe ? 'border-red-500 bg-red-600' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-dark-card'} w-48`}
          >
             <div className="h-24 bg-gray-200 dark:bg-white/10 relative">
                {message.attachment.previewUrl ? (
                  <img src={message.attachment.previewUrl} className="w-full h-full object-cover" alt={message.attachment.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Layers size={24} />
                  </div>
                )}
             </div>
             <div className={`p-2 ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                <div className="text-xs font-bold truncate">{message.attachment.title || 'Untitled Board'}</div>
                <div className={`text-[10px] ${isMe ? 'text-red-100' : 'text-gray-500 dark:text-gray-400'}`}>Board • Tap to view</div>
             </div>
          </div>
        )}
        
        {/* Friend Request Special Rendering */}
        {message.type === 'friend_request' && (
             <div className="flex flex-col gap-2">
                <p>{message.text}</p>
             </div>
        )}
      </div>
    );
  };

  const isFriendRequest = message.type === 'friend_request';

  if (isFriendRequest) {
     return (
        <div className="flex justify-center my-4">
           <div className="bg-gray-50 dark:bg-white/5 px-6 py-4 rounded-2xl text-center border border-gray-100 dark:border-white/10 shadow-sm max-w-sm">
             <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-2 overflow-hidden">
                <img src={senderAvatar} className="w-full h-full object-cover" />
             </div>
             <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-3">
               {isMe ? 'You sent a friend request' : `${senderName} wants to connect with you`}
             </p>
             {!isMe && (
               <div className="flex gap-2 justify-center">
                 <button onClick={() => alert("Accepted!")} className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-full hover:bg-red-700">Accept</button>
                 <button className="px-4 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-full hover:bg-gray-300 dark:hover:bg-white/20">Ignore</button>
               </div>
             )}
           </div>
         </div>
     );
  }

  return (
    <div 
      className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative mb-1`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar (Only for others) */}
      {!isMe && (
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden mr-2 mt-auto shrink-0">
          <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        
        {/* The Bubble */}
        {renderContent()}

        {/* Metadata Row: Time & Reactions */}
        <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
            {/* Display Reactions */}
            {message.reactions && message.reactions.length > 0 && (
                <div className="flex gap-1 flex-wrap order-last">
                    {message.reactions.map((r, i) => (
                        <button 
                            key={i} 
                            onClick={(e) => { e.stopPropagation(); onReact(message.id, r.emoji); }}
                            className={`border rounded-full px-1.5 py-0.5 text-[10px] shadow-sm transition-colors flex items-center gap-1 ${
                                r.userReacted ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white dark:bg-dark-card border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}
                        >
                            <span>{r.emoji}</span>
                            {r.count > 0 && <span>{r.count}</span>}
                        </button>
                    ))}
                </div>
            )}

            <span className="text-[10px] text-gray-300 dark:text-gray-500">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>

        {/* DESKTOP HOVER MENU */}
        <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isMe ? '-left-14' : '-right-14'}`}>
            <div className="relative">
                <button 
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1.5 bg-white dark:bg-dark-card rounded-full shadow-sm border border-gray-100 dark:border-dark-border text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                >
                    <Smile size={16} />
                </button>
                
                {/* Desktop Reaction Picker Popover */}
                {showMenu && (
                    <div className={`absolute top-0 transform -translate-y-full mb-2 ${isMe ? 'left-0' : 'right-0'} bg-white dark:bg-dark-card shadow-xl rounded-full p-1.5 flex gap-1 z-20 border border-gray-100 dark:border-dark-border animate-in zoom-in-95 duration-200`}>
                        {REACTIONS.map(emoji => (
                            <button 
                                key={emoji}
                                onClick={() => { onReact(message.id, emoji); setShowMenu(false); }}
                                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-transform hover:scale-125"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {isMe && (
               <button onClick={() => onDelete && onDelete(message.id)} className="p-1.5 bg-white dark:bg-dark-card rounded-full shadow-sm border border-gray-100 dark:border-dark-border text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 size={16} />
               </button>
            )}
            <button onClick={() => onReply && onReply(message.id)} className="p-1.5 bg-white dark:bg-dark-card rounded-full shadow-sm border border-gray-100 dark:border-dark-border text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                <CornerUpLeft size={16} />
            </button>
        </div>

      </div>

      {/* MOBILE CONTEXT MENU (Bottom Sheet Style) */}
      {showMobileMenu && (
        <>
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-[51] bg-white dark:bg-dark-card rounded-t-2xl p-4 animate-in slide-in-from-bottom-full duration-300">
                <div className="flex justify-center mb-4">
                   <div className="w-12 h-1 bg-gray-300 dark:bg-white/20 rounded-full" />
                </div>
                
                {/* Reactions Row */}
                <div className="flex justify-between items-center mb-6 px-2">
                    {REACTIONS.map(emoji => (
                        <button 
                            key={emoji}
                            onClick={() => { onReact(message.id, emoji); setShowMobileMenu(false); }}
                            className="text-3xl hover:scale-125 transition-transform"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>

                {/* Actions List */}
                <div className="space-y-1">
                    <button onClick={() => { onReply && onReply(message.id); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-800 dark:text-gray-200 font-medium">
                        <CornerUpLeft size={20} /> Reply
                    </button>
                    <button onClick={handleCopy} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-800 dark:text-gray-200 font-medium">
                        <Copy size={20} /> Copy
                    </button>
                    {isMe && (
                        <>
                            <button onClick={() => { onEdit && onEdit(message.id); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-800 dark:text-gray-200 font-medium">
                                <Edit2 size={20} /> Edit
                            </button>
                            <button onClick={() => { onDelete && onDelete(message.id); setShowMobileMenu(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 font-medium">
                                <Trash2 size={20} /> Delete
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
      )}
    </div>
  );
};