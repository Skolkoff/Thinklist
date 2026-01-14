
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatSession, Message, Attachment, Collection, Reaction } from '../types';
import { api } from '../services/api';
import { MessageBubble } from './MessageBubble';
import { X, Search, Image as ImageIcon, Video, Layers, Send, MoreVertical, Plus, Trash2, Ban, Eraser, Smile, Users, UserPlus } from 'lucide-react';

interface MessengerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  initialChatId?: string | null;
  userCollections: Collection[];
  onNavigateToProfile?: (userId: string) => void;
  onNavigateToCollection?: (collectionId: string) => void;
}

export const MessengerModal: React.FC<MessengerModalProps> = ({
  isOpen, onClose, currentUser, initialChatId, userCollections, onNavigateToProfile, onNavigateToCollection
}) => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'primary' | 'requests' | 'friends'>('primary');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Menus
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);

  // File Inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialChatId) {
       if (chats.length > 0) {
         setSelectedChatId(initialChatId);
         const chat = chats.find(c => c.id === initialChatId);
         if (chat && chat.category === 'requests') {
           setActiveTab('requests');
         } else {
             setActiveTab('primary');
         }
       }
    }
  }, [initialChatId, chats]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedChatId, chats]);

  // Click outside listener for menus
  useEffect(() => {
    const handleClickOutside = () => {
       setShowChatOptions(false);
       setShowBoardPicker(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [chatsData, friendsData] = await Promise.all([
        api.getChats(),
        api.getFriends()
    ]);
    setChats(chatsData);
    setFriends(friendsData);
    setIsLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (attachment?: Attachment) => {
    if ((!inputText.trim() && !attachment) || !selectedChatId) return;
    
    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const newMessage: Message = {
        id: tempId,
        senderId: currentUser.id,
        text: inputText,
        type: attachment ? attachment.type : 'text',
        attachment: attachment,
        timestamp: new Date().toISOString(),
        reactions: []
    };

    setChats(prev => prev.map(c => {
        if (c.id === selectedChatId) {
            return {
                ...c,
                messages: [...c.messages, newMessage],
                lastMessageAt: newMessage.timestamp
            };
        }
        return c;
    }));

    setInputText('');
    setShowBoardPicker(false);

    // API Call
    await api.sendMessage(selectedChatId, newMessage.text || '', newMessage.type, attachment);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const attachment: Attachment = { type, url };
      handleSendMessage(attachment);
    }
    if (e.target) e.target.value = '';
  };

  const handleBoardShare = (col: Collection) => {
      const attachment: Attachment = { 
          type: 'collection', 
          id: col.id, 
          title: col.name, 
          previewUrl: col.coverImage 
      };
      handleSendMessage(attachment);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
      if (!selectedChatId) return;

      // Optimistic update
      setChats(prev => prev.map(c => {
          if (c.id === selectedChatId) {
              const updatedMessages = c.messages.map(m => {
                  if (m.id === messageId) {
                      const existing = m.reactions?.find(r => r.emoji === emoji);
                      let newReactions = m.reactions ? [...m.reactions] : [];
                      
                      if (existing) {
                          if (existing.userReacted) {
                              newReactions = newReactions.map(r => 
                                r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r
                              ).filter(r => r.count > 0);
                          } else {
                              newReactions = newReactions.map(r => 
                                r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r
                              );
                          }
                      } else {
                          newReactions.push({ emoji, count: 1, userReacted: true });
                      }
                      return { ...m, reactions: newReactions };
                  }
                  return m;
              });
              return { ...c, messages: updatedMessages };
          }
          return c;
      }));

      await api.reactToMessage(selectedChatId, messageId, emoji);
  };

  const handleDeleteMessage = (messageId: string) => {
      if (!selectedChatId) return;
      if (confirm("Delete this message?")) {
        setChats(prev => prev.map(c => {
            if (c.id === selectedChatId) {
                return { ...c, messages: c.messages.filter(m => m.id !== messageId) };
            }
            return c;
        }));
      }
  };

  const handleDeleteChat = async () => {
    if (!selectedChatId) return;
    if (confirm("Are you sure you want to delete this chat?")) {
       await api.deleteChat(selectedChatId);
       setChats(prev => prev.filter(c => c.id !== selectedChatId));
       setSelectedChatId(null);
    }
  };

  const handleClearChat = async () => {
    if (!selectedChatId) return;
    if (confirm("Clear all messages in this chat?")) {
        await api.clearChat(selectedChatId);
        setChats(prev => prev.map(c => c.id === selectedChatId ? { ...c, messages: [] } : c));
    }
  };

  const handleBlockUser = async () => {
    const chat = chats.find(c => c.id === selectedChatId);
    if (!chat || !chat.participantId) return;
    if (confirm(`Block ${chat.participant?.name}?`)) {
        await api.blockUser(chat.participantId);
        alert("User blocked.");
    }
  };

  const handleFriendClick = async (friendId: string) => {
      // Check if chat exists
      const existingChat = chats.find(c => c.participantId === friendId);
      if (existingChat) {
          setSelectedChatId(existingChat.id);
      } else {
          // Create new chat
          const newChatId = await api.startChat(friendId);
          await loadData(); // Reload to get new chat
          setSelectedChatId(newChatId);
      }
      setActiveTab('primary'); // Switch to chats tab
  };

  const handleNavigateProfile = () => {
      const chat = chats.find(c => c.id === selectedChatId);
      if (chat && chat.participantId && onNavigateToProfile) {
          onNavigateToProfile(chat.participantId);
          onClose();
      }
  };

  const activeChat = chats.find(c => c.id === selectedChatId);
  
  // Filter Lists
  const visibleChats = chats.filter(c => c.category === activeTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-8" onClick={onClose}>
      <div 
        className="bg-white dark:bg-dark-card w-full max-w-5xl h-[80vh] rounded-3xl shadow-2xl flex overflow-hidden border border-gray-100 dark:border-dark-border transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className={`w-full md:w-80 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border flex flex-col ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
           <div className="p-4 border-b border-gray-100 dark:border-dark-border">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-900 dark:text-white">Inbox</h2>
               <button onClick={() => { setActiveTab('friends') }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-700 dark:text-gray-300">
                  <Plus size={20} />
               </button>
             </div>
             
             {/* Tabs */}
             <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-full mb-3">
               <button 
                 onClick={() => setActiveTab('primary')}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === 'primary' ? 'bg-white dark:bg-white/20 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                 Chats
               </button>
               <button 
                 onClick={() => setActiveTab('friends')}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === 'friends' ? 'bg-white dark:bg-white/20 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                 Friends
               </button>
               <button 
                 onClick={() => setActiveTab('requests')}
                 className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === 'requests' ? 'bg-white dark:bg-white/20 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
               >
                 Reqs
               </button>
             </div>

             <div className="relative">
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="Search" 
                 className="w-full bg-gray-100 dark:bg-dark-bg pl-9 pr-4 py-2 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
               />
             </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar">
             
             {/* Render List based on Tab */}
             {activeTab === 'friends' ? (
                // FRIENDS LIST
                friends.length > 0 ? (
                  friends.map(friend => (
                     <div 
                        key={friend.id}
                        onClick={() => handleFriendClick(friend.id)}
                        className="flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                     >
                        <img src={friend.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 min-w-0">
                           <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{friend.name}</h3>
                           <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{friend.nickname}</p>
                        </div>
                     </div>
                  ))
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        <Users size={32} className="mx-auto mb-2 opacity-50"/>
                        No friends yet.
                    </div>
                )
             ) : (
                // CHATS LIST
                visibleChats.length > 0 ? (
                    visibleChats.map(chat => (
                        <div 
                        key={chat.id}
                        onClick={() => setSelectedChatId(chat.id)}
                        className={`flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-colors ${selectedChatId === chat.id ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                        <div className="relative">
                            <img src={chat.participant?.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover bg-gray-200 dark:bg-gray-700" />
                            {chat.unread && <div className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-white dark:border-dark-card"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{chat.participant?.name}</h3>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1">
                                {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className={`text-xs truncate ${chat.unread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                {chat.messages[chat.messages.length - 1]?.text || 'Sent an attachment'}
                            </p>
                        </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No conversations.
                    </div>
                )
             )}
           </div>
        </div>

        {/* Chat Area */}
        {selectedChatId && activeChat ? (
          <div className={`flex-1 flex flex-col bg-white dark:bg-dark-card w-full ${selectedChatId ? 'flex' : 'hidden md:flex'}`}>
             {/* Chat Header */}
             <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-border flex items-center justify-between shrink-0 relative z-20">
               <div className="flex items-center gap-3">
                 <button onClick={() => setSelectedChatId(null)} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-700 dark:text-gray-300">
                   <X size={20} />
                 </button>
                 <div 
                   onClick={handleNavigateProfile}
                   className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 p-1.5 -ml-1.5 rounded-xl transition-colors"
                   title="View Profile"
                 >
                    <img src={activeChat.participant?.avatarUrl} alt="" className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 object-cover" />
                    <div>
                    <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{activeChat.participant?.name}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{activeChat.participant?.isFriend ? 'Friend' : 'Suggested Contact'}</span>
                    </div>
                 </div>
               </div>
               
               <div className="relative">
                 <button 
                   onClick={(e) => { e.stopPropagation(); setShowChatOptions(!showChatOptions); }}
                   className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400"
                 >
                    <MoreVertical size={20} />
                 </button>
                 
                 {showChatOptions && (
                   <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-gray-100 dark:border-dark-border overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-200">
                      <button onClick={handleClearChat} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left">
                         <Eraser size={16} /> Clear chat
                      </button>
                      <button onClick={handleBlockUser} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left">
                         <Ban size={16} /> Block user
                      </button>
                      <button onClick={handleDeleteChat} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left font-semibold">
                         <Trash2 size={16} /> Delete chat
                      </button>
                   </div>
                 )}
               </div>
             </div>

             {/* Messages */}
             <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-white dark:bg-dark-card custom-scrollbar">
               {activeChat.messages.map((msg) => (
                   <MessageBubble 
                      key={msg.id}
                      message={msg}
                      isMe={msg.senderId === currentUser.id}
                      senderName={activeChat.participant?.name}
                      senderAvatar={activeChat.participant?.avatarUrl}
                      onReact={handleReaction}
                      onDelete={handleDeleteMessage}
                      onNavigateToCollection={(id) => {
                          if (onNavigateToCollection) {
                              onNavigateToCollection(id);
                              onClose();
                          }
                      }}
                   />
               ))}
               <div ref={messagesEndRef} />
             </div>

             {/* Input Area */}
             <div className="p-4 border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-card relative z-30">
               {/* Hidden File Inputs */}
               <input 
                  type="file" 
                  ref={photoInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e, 'image')} 
               />
               <input 
                  type="file" 
                  ref={videoInputRef} 
                  accept="video/*" 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e, 'video')} 
               />

               {/* Board Picker Popover */}
               {showBoardPicker && (
                 <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-gray-100 dark:border-dark-border overflow-hidden animate-in slide-in-from-bottom-2 fade-in">
                    <div className="p-3 border-b border-gray-100 dark:border-dark-border font-bold text-xs text-gray-500">Share a Board</div>
                    <div className="max-h-48 overflow-y-auto">
                       {userCollections.map(col => (
                         <div 
                           key={col.id} 
                           onClick={() => handleBoardShare(col)}
                           className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                         >
                            <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                               {col.coverImage && <img src={col.coverImage} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{col.name}</span>
                         </div>
                       ))}
                    </div>
                 </div>
               )}

               <div className="flex items-end gap-2 bg-gray-100 dark:bg-white/10 rounded-3xl p-2 pl-4">
                 <div className="flex gap-1 pb-2 text-gray-500 dark:text-gray-400">
                   <button onClick={() => photoInputRef.current?.click()} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors" title="Photo">
                     <ImageIcon size={20} />
                   </button>
                   <button onClick={() => videoInputRef.current?.click()} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors" title="Video">
                     <Video size={20} />
                   </button>
                   <button 
                     onClick={(e) => { e.stopPropagation(); setShowBoardPicker(!showBoardPicker); }}
                     className={`p-2 rounded-full transition-colors ${showBoardPicker ? 'bg-gray-300 dark:bg-white/20 text-gray-800 dark:text-white' : 'hover:bg-gray-200 dark:hover:bg-white/10'}`} 
                     title="Share Board"
                   >
                     <Layers size={20} />
                   </button>
                 </div>
                 
                 <textarea 
                   value={inputText}
                   onChange={e => setInputText(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSendMessage();
                     }
                   }}
                   placeholder="Type a message..."
                   rows={1}
                   className="flex-1 bg-transparent border-none outline-none resize-none py-3 max-h-32 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 text-sm"
                 />

                 <button 
                   onClick={() => handleSendMessage()}
                   disabled={!inputText.trim()}
                   className={`p-3 rounded-full transition-all ${inputText.trim() ? 'bg-primary text-white hover:bg-red-700' : 'bg-gray-200 dark:bg-white/10 text-gray-400'}`}
                 >
                   <Send size={18} />
                 </button>
               </div>
             </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 dark:bg-dark-bg flex-col text-gray-400 p-8 text-center">
             <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Send size={40} className="text-gray-300 dark:text-gray-600" />
             </div>
             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Your Messages</h3>
             <p className="max-w-xs mb-4 text-gray-500 dark:text-gray-400">Send photos, videos, or share your favorite research boards with friends and authors.</p>
             <button 
                onClick={() => setActiveTab('friends')}
                className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
             >
                Find Friends
             </button>
          </div>
        )}
      </div>
    </div>
  );
};