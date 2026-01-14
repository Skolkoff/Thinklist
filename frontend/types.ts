

export interface Author {
  id: string;
  name: string;
}

export interface Article {
  id: string;
  title: string;
  abstract: string;
  authors: Author[];
  tags: string[];
  source: string;
  publishedAt: string; // ISO Date
  doi: string;
  imageUrl: string;
  likes: number;
}

export type CollectionVisibility = 'public' | 'private' | 'friends' | 'followers';

export interface Collection {
  id: string;
  name: string;
  articleIds: string[];
  coverImage?: string;
  isPrivate?: boolean;
  visibility: CollectionVisibility;
  ownerId?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  nickname: string;
  avatarUrl: string;
  workplace?: string;
  fieldOfStudy?: string;
  bio?: string;
  interests: string[];
}

export enum ViewState {
  FEED = 'FEED',
  COLLECTIONS = 'COLLECTIONS',
  ARTICLE_DETAIL = 'ARTICLE_DETAIL',
  PROFILE = 'PROFILE'
}

export interface FilterState {
  searchQuery: string;
  selectedTags: string[];
}

export type Theme = 'light' | 'dark' | 'system';

/**
 * Messenger specific types
 */
export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Attachment {
  type: 'text' | 'image' | 'video' | 'collection' | 'friend_request';
  url?: string;
  id?: string;
  title?: string;
  previewUrl?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'collection' | 'friend_request';
  attachment?: Attachment;
  timestamp: string;
  reactions: Reaction[];
}

export interface ChatSession {
  id: string;
  participantId: string;
  participant: UserProfile & { isFriend?: boolean };
  messages: Message[];
  lastMessageAt: string;
  category: 'primary' | 'requests';
  unread?: boolean;
}
