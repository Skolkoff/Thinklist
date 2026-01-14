
import { Article, Collection, CollectionVisibility, FilterState, UserProfile, ChatSession, Message, Attachment } from '../types';
import { MOCK_ARTICLES, MOCK_COLLECTIONS, MOCK_USER, MOCK_OTHER_USER, MOCK_AUTHOR_USER } from './mockData';

const DELAY = 600; // Simulate network latency

// In-memory state for the session
let currentUserState = { ...MOCK_USER };

// Mock Messenger State
let MOCK_CHATS: ChatSession[] = [
  {
    id: 'chat-1',
    participantId: 'u2',
    participant: { ...MOCK_OTHER_USER, isFriend: true },
    messages: [
      {
        id: 'm1',
        senderId: 'u2',
        text: 'Hey Alex, did you see the new paper on quantum entanglement?',
        type: 'text',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        reactions: [{ emoji: '👍', count: 1, userReacted: false }]
      }
    ],
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
    category: 'primary',
    unread: true
  }
];

export const api = {
  fetchArticles: async (filters: FilterState): Promise<Article[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        let results = [...MOCK_ARTICLES];

        // Filter by Search Query
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          results = results.filter(a => 
            a.title.toLowerCase().includes(q) || 
            a.abstract.toLowerCase().includes(q)
          );
        }

        // Filter by Tags
        if (filters.selectedTags.length > 0) {
          results = results.filter(a => 
            a.tags.some(tag => filters.selectedTags.includes(tag))
          );
        }

        // Recommendation Logic (Mock: shuffle if no filters to simulate discovery)
        if (!filters.searchQuery && filters.selectedTags.length === 0) {
           // Basic shuffle to simulate "Feed"
           results.sort(() => Math.random() - 0.5);
        }

        resolve(results);
      }, DELAY);
    });
  },

  getCollections: async (userId?: string): Promise<Collection[]> => {
    return new Promise((resolve) => {
       setTimeout(() => {
         if (userId) {
           resolve(MOCK_COLLECTIONS.filter(c => c.ownerId === userId));
         } else {
           resolve(MOCK_COLLECTIONS);
         }
       }, DELAY);
    });
  },

  createCollection: async (name: string, visibility: CollectionVisibility): Promise<Collection> => {
    return new Promise((resolve) => {
      const newCol: Collection = {
        id: `col-${Date.now()}`,
        name,
        articleIds: [],
        ownerId: currentUserState.id,
        isPrivate: visibility === 'private',
        visibility
      };
      MOCK_COLLECTIONS.push(newCol); // Update mock data
      setTimeout(() => resolve(newCol), DELAY);
    });
  },

  updateCollection: async (id: string, data: Partial<Collection>): Promise<Collection | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = MOCK_COLLECTIONS.findIndex(c => c.id === id);
        if (index > -1) {
          const updated = { ...MOCK_COLLECTIONS[index], ...data };
          // Sync legacy isPrivate flag if visibility changes
          if (data.visibility) {
             updated.isPrivate = data.visibility === 'private';
          }
          MOCK_COLLECTIONS[index] = updated;
          resolve(updated);
        } else {
          resolve(null);
        }
      }, DELAY);
    });
  },

  deleteCollection: async (id: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const index = MOCK_COLLECTIONS.findIndex(c => c.id === id);
        if (index > -1) {
          MOCK_COLLECTIONS.splice(index, 1);
          resolve(true);
        } else {
          resolve(false);
        }
      }, DELAY);
    });
  },

  addArticleToCollection: async (collectionId: string, articleId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const col = MOCK_COLLECTIONS.find(c => c.id === collectionId);
        if (col && !col.articleIds.includes(articleId)) {
          col.articleIds.push(articleId);
          // If it's the first article, update cover image
          if (col.articleIds.length === 1) {
            const art = MOCK_ARTICLES.find(a => a.id === articleId);
            if (art) col.coverImage = art.imageUrl;
          }
        }
        resolve(true);
      }, 200);
    });
  },

  toggleLike: async (articleId: string): Promise<boolean> => {
    // Mock toggle
    return new Promise(resolve => setTimeout(() => resolve(true), 200));
  },

  // User & Profile API
  getCurrentUser: async (): Promise<UserProfile> => {
    return new Promise(resolve => setTimeout(() => resolve(currentUserState), DELAY / 2));
  },

  getUserProfile: async (userId: string): Promise<UserProfile> => {
     return new Promise(resolve => {
        setTimeout(() => {
           if (userId === MOCK_USER.id) resolve(currentUserState);
           else if (userId === MOCK_OTHER_USER.id) resolve(MOCK_OTHER_USER);
           else resolve(MOCK_AUTHOR_USER);
        }, DELAY);
     });
  },

  updateUserProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
    return new Promise(resolve => {
       setTimeout(() => {
          currentUserState = { ...currentUserState, ...data };
          resolve(currentUserState);
       }, DELAY);
    });
  },

  changePassword: async (old: string, newPwd: string): Promise<boolean> => {
    return new Promise(resolve => setTimeout(() => resolve(true), DELAY));
  },

  // Messenger API
  getChats: async (): Promise<ChatSession[]> => {
    return new Promise(resolve => setTimeout(() => resolve(MOCK_CHATS), 400));
  },

  getFriends: async (): Promise<UserProfile[]> => {
    // Return mock users as friends
    return new Promise(resolve => setTimeout(() => resolve([MOCK_OTHER_USER, MOCK_AUTHOR_USER]), 300));
  },

  sendMessage: async (chatId: string, text: string, type: string, attachment?: Attachment): Promise<void> => {
    return new Promise(resolve => {
      setTimeout(() => {
        const chat = MOCK_CHATS.find(c => c.id === chatId);
        if (chat) {
          const newMessage: Message = {
            id: `msg-${Date.now()}`,
            senderId: currentUserState.id,
            text,
            type: type as any,
            attachment,
            timestamp: new Date().toISOString(),
            reactions: []
          };
          chat.messages.push(newMessage);
          chat.lastMessageAt = newMessage.timestamp;
        }
        resolve();
      }, 150);
    });
  },

  reactToMessage: async (chatId: string, messageId: string, emoji: string): Promise<void> => {
    // Mock reaction persistence
    return new Promise(resolve => setTimeout(resolve, 50));
  },

  deleteChat: async (chatId: string): Promise<void> => {
    MOCK_CHATS = MOCK_CHATS.filter(c => c.id !== chatId);
    return new Promise(resolve => setTimeout(resolve, 200));
  },

  clearChat: async (chatId: string): Promise<void> => {
    const chat = MOCK_CHATS.find(c => c.id === chatId);
    if (chat) chat.messages = [];
    return new Promise(resolve => setTimeout(resolve, 200));
  },

  blockUser: async (userId: string): Promise<void> => {
    // Mock user blocking
    return new Promise(resolve => setTimeout(resolve, 300));
  },

  startChat: async (userId: string): Promise<string> => {
    return new Promise(resolve => {
      const existing = MOCK_CHATS.find(c => c.participantId === userId);
      if (existing) {
        resolve(existing.id);
        return;
      }

      const id = `chat-${Date.now()}`;
      const newChat: ChatSession = {
        id,
        participantId: userId,
        participant: { ...MOCK_OTHER_USER, id: userId, isFriend: true },
        messages: [],
        lastMessageAt: new Date().toISOString(),
        category: 'primary'
      };
      MOCK_CHATS.push(newChat);
      setTimeout(() => resolve(id), 400);
    });
  }
};
