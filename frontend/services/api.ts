import {
  Article,
  Collection,
  CollectionVisibility,
  FilterState,
  UserProfile,
  ChatSession,
  Message,
  Attachment
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'thinklist_token';
const AVATAR_CACHE_PREFIX = 'thinklist_avatar_';

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);
const avatarCacheKey = (userId: string) => `${AVATAR_CACHE_PREFIX}${userId}`;

const applyCachedAvatar = (user: UserProfile): UserProfile => {
  try {
    const cached = localStorage.getItem(avatarCacheKey(user.id));
    if (cached) {
      return { ...user, avatarUrl: cached };
    }
  } catch (error) {
    console.warn('Avatar cache read failed', error);
  }
  return user;
};

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  retried = false
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && auth && !retried) {
    clearToken();
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
};

const bootstrapAuth = async () => {
  if (getToken()) return;
};

const normalizeArticle = (article: Article): Article => {
  return {
    ...article,
    publishedAt: article.publishedAt || new Date().toISOString(),
    imageUrl: article.imageUrl || `https://picsum.photos/seed/article-${article.id}/800/1000`,
    tags: article.tags || [],
    authors: article.authors || [],
    likes: article.likes ?? 0,
    doi: article.doi || '',
    source: article.source || 'Unknown'
  };
};

const normalizeCollection = (collection: Collection): Collection => {
  return {
    ...collection,
    articleIds: collection.articleIds || [],
    visibility: collection.visibility || 'public',
    isPrivate: collection.visibility === 'private',
    articles: collection.articles ? collection.articles.map(normalizeArticle) : undefined
  };
};

export const api = {
  hasToken: (): boolean => Boolean(getToken()),
  logout: () => clearToken(),
  checkNickname: async (nickname: string): Promise<{ nickname: string; available: boolean }> => {
    const query = buildQuery({ nickname });
    return request<{ nickname: string; available: boolean }>(`/auth/nickname-available${query}`, {}, false);
  },
  cacheAvatar: (userId: string, url: string) => {
    try {
      localStorage.setItem(avatarCacheKey(userId), url);
    } catch (error) {
      console.warn('Avatar cache write failed', error);
    }
  },
  register: async (payload: { email: string; password: string; nickname?: string }): Promise<void> => {
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, false);
  },
  login: async (email: string, password: string): Promise<UserProfile> => {
    const response = await request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }, false);
    setToken(response.access_token);
    const user = await request<UserProfile>('/me');
    return applyCachedAvatar(user);
  },
  fetchTags: async (): Promise<string[]> => {
    await bootstrapAuth();
    const response = await request<{ items: string[] }>('/tags');
    return response.items || [];
  },

  fetchArticles: async (filters: FilterState): Promise<Article[]> => {
    const searchQuery = filters.searchQuery.trim();
    const tags = filters.selectedTags.join(',');

    const shouldSearch = searchQuery.length >= 2 || filters.selectedTags.length > 0;
    if (shouldSearch) {
      const query = buildQuery({
        q: searchQuery.length >= 2 ? searchQuery : undefined,
        tags: tags || undefined,
        limit: 100
      });
      const response = await request<{ items: Article[] }>(`/search${query}`);
      return response.items.map(normalizeArticle);
    }

    const query = buildQuery({ limit: 100 });
    const hasAuth = Boolean(getToken());
    const [feedResponse, savedResponse] = await Promise.all([
      request<{ items: Article[] }>(`/feed${query}`),
      hasAuth ? request<{ items: Article[] }>('/me/saved') : Promise.resolve({ items: [] })
    ]);

    const merged = new Map<string, Article>();
    feedResponse.items.forEach(item => merged.set(item.id, item));
    savedResponse.items.forEach(item => merged.set(item.id, item));

    return Array.from(merged.values()).map(normalizeArticle);
  },

  getCollections: async (userId?: string): Promise<Collection[]> => {
    if (!getToken()) return [];
    const query = buildQuery({ user_id: userId, include_items: 1 });
    const response = await request<{ items: Collection[] }>(`/collections${query}`);
    return response.items.map(normalizeCollection);
  },

  createCollection: async (name: string, visibility: CollectionVisibility): Promise<Collection> => {
    const response = await request<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, visibility })
    });
    return normalizeCollection(response);
  },

  updateCollection: async (id: string, data: Partial<Collection>): Promise<Collection | null> => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.visibility !== undefined) payload.visibility = data.visibility;
    if (data.coverImage !== undefined) payload.cover_image = data.coverImage;

    const response = await request<Collection>(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return normalizeCollection(response);
  },

  deleteCollection: async (id: string): Promise<boolean> => {
    await request(`/collections/${id}`, { method: 'DELETE' });
    return true;
  },

  addArticleToCollection: async (collectionId: string, articleId: string): Promise<boolean> => {
    await request(`/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ paper_id: Number(articleId) })
    });
    return true;
  },

  toggleLike: async (articleId: string): Promise<boolean> => {
    await request('/events', {
      method: 'POST',
      body: JSON.stringify({ paper_id: Number(articleId), action: 'like' })
    });
    return true;
  },

  getCurrentUser: async (): Promise<UserProfile> => {
    const response = await request<UserProfile>('/me');
    return applyCachedAvatar(response);
  },

  getUserProfile: async (userId: string): Promise<UserProfile> => {
    const response = await request<UserProfile>(`/users/${userId}`);
    return applyCachedAvatar(response);
  },

  updateUserProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.nickname !== undefined) payload.nickname = data.nickname;
    if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;
    if (data.workplace !== undefined) payload.workplace = data.workplace;
    if (data.fieldOfStudy !== undefined) payload.field_of_study = data.fieldOfStudy;
    if (data.bio !== undefined) payload.bio = data.bio;
    if (data.interests !== undefined) payload.interests = data.interests;

    const response = await request<UserProfile>('/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return applyCachedAvatar(response);
  },

  changePassword: async (oldPassword: string, newPwd: string): Promise<boolean> => {
    await request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPwd })
    });
    return true;
  },

  getChats: async (): Promise<ChatSession[]> => {
    const response = await request<{ items: ChatSession[] }>('/chats');
    return response.items;
  },

  getFriends: async (): Promise<UserProfile[]> => {
    const response = await request<{ items: UserProfile[] }>('/friends');
    return response.items;
  },

  sendMessage: async (chatId: string, text: string, type: string, attachment?: Attachment): Promise<void> => {
    const payload = {
      text,
      type,
      attachment: attachment || null
    };
    await request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  reactToMessage: async (chatId: string, messageId: string, emoji: string): Promise<void> => {
    await request(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  },

  deleteChat: async (chatId: string): Promise<void> => {
    await request(`/chats/${chatId}`, { method: 'DELETE' });
  },

  clearChat: async (chatId: string): Promise<void> => {
    await request(`/chats/${chatId}/clear`, { method: 'POST' });
  },

  blockUser: async (userId: string): Promise<void> => {
    await request(`/users/${userId}/block`, { method: 'POST' });
  },

  startChat: async (userId: string): Promise<string> => {
    const response = await request<{ chat_id: string }>('/chats', {
      method: 'POST',
      body: JSON.stringify({ participant_id: Number(userId) })
    });
    return response.chat_id;
  }
};
