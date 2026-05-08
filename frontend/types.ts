

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
  url?: string;
  imageUrl: string;
  likes: number;
}

export interface ArticleComment {
  id: string;
  paperId: string;
  content: string;
  author: UserProfile;
  reactionCounts: Record<string, number>;
  viewerReaction?: string | null;
  canDelete?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CollectionVisibility = 'public' | 'private' | 'followers';

export interface Collection {
  id: string;
  name: string;
  articleIds: string[];
  articles?: Article[];
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
