import { Article } from '../types';

export type ArticleVisualDomain =
  | 'ai'
  | 'language'
  | 'vision'
  | 'security'
  | 'systems'
  | 'math'
  | 'physics'
  | 'biology'
  | 'finance'
  | 'economics'
  | 'statistics'
  | 'general';

export interface ArticleVisual {
  domain: ArticleVisualDomain;
  labelKey: string;
  kickerKey: string;
  thesis: string;
  accent: string;
  ink: string;
  paper: string;
  wash: string;
  pattern: 'columns' | 'grid' | 'rings' | 'wave' | 'ledger' | 'constellation';
  variant: number;
}

export const DOMAIN_TAGS: Record<ArticleVisualDomain, string[]> = {
  ai: ['cs.AI', 'cs.LG', 'cs.NE', 'cs.RO', 'cs.MA'],
  language: ['cs.CL', 'cs.IR'],
  vision: ['cs.CV', 'cs.GR', 'eess.IV'],
  security: ['cs.CR', 'cs.CY'],
  systems: ['cs.DC', 'cs.OS', 'cs.NI', 'cs.PF', 'cs.SE', 'cs.DB'],
  math: ['math.', 'cs.DM', 'cs.SY'],
  physics: ['physics.', 'quant-ph', 'cond-mat.', 'astro-ph.', 'hep-'],
  biology: ['q-bio.', 'cs.CE'],
  finance: ['q-fin.'],
  economics: ['econ.'],
  statistics: ['stat.'],
  general: [],
};

const DOMAIN_LABELS: Record<ArticleVisualDomain, { labelKey: string; kickerKey: string }> = {
  ai: { labelKey: 'cover.domain.ai', kickerKey: 'cover.kicker.ai' },
  language: { labelKey: 'cover.domain.language', kickerKey: 'cover.kicker.language' },
  vision: { labelKey: 'cover.domain.vision', kickerKey: 'cover.kicker.vision' },
  security: { labelKey: 'cover.domain.security', kickerKey: 'cover.kicker.security' },
  systems: { labelKey: 'cover.domain.systems', kickerKey: 'cover.kicker.systems' },
  math: { labelKey: 'cover.domain.math', kickerKey: 'cover.kicker.math' },
  physics: { labelKey: 'cover.domain.physics', kickerKey: 'cover.kicker.physics' },
  biology: { labelKey: 'cover.domain.biology', kickerKey: 'cover.kicker.biology' },
  finance: { labelKey: 'cover.domain.finance', kickerKey: 'cover.kicker.finance' },
  economics: { labelKey: 'cover.domain.economics', kickerKey: 'cover.kicker.economics' },
  statistics: { labelKey: 'cover.domain.statistics', kickerKey: 'cover.kicker.statistics' },
  general: { labelKey: 'cover.domain.general', kickerKey: 'cover.kicker.general' },
};

const DOMAIN_PALETTES: Record<ArticleVisualDomain, Omit<ArticleVisual, 'domain' | 'labelKey' | 'kickerKey' | 'thesis' | 'pattern' | 'variant'>> = {
  ai: { accent: '#D83A2E', ink: '#171412', paper: '#F7F1E6', wash: '#FFE2D5' },
  language: { accent: '#2563A8', ink: '#111827', paper: '#F4F7FB', wash: '#DCEBFF' },
  vision: { accent: '#0F8B8D', ink: '#10201F', paper: '#F0F8F6', wash: '#D6F3EF' },
  security: { accent: '#7C2D12', ink: '#18110D', paper: '#F7F0EA', wash: '#FAD6BF' },
  systems: { accent: '#475569', ink: '#111827', paper: '#F3F5F7', wash: '#DDE3EA' },
  math: { accent: '#5B4E9A', ink: '#14111F', paper: '#F4F1FA', wash: '#E4DAFF' },
  physics: { accent: '#B45309', ink: '#17130B', paper: '#F8F4EC', wash: '#F7DFB8' },
  biology: { accent: '#2F7D32', ink: '#122014', paper: '#F1F7EF', wash: '#D9F0D2' },
  finance: { accent: '#0E7490', ink: '#0B1A1F', paper: '#EEF7F8', wash: '#CBEFF4' },
  economics: { accent: '#9A3412', ink: '#1F130E', paper: '#F8F2EE', wash: '#F4D6C5' },
  statistics: { accent: '#6D28D9', ink: '#160F24', paper: '#F5F1FA', wash: '#E6D8FF' },
  general: { accent: '#334155', ink: '#111827', paper: '#F6F4EF', wash: '#E5E1D8' },
};

const PATTERNS: ArticleVisual['pattern'][] = ['columns', 'grid', 'rings', 'wave', 'ledger', 'constellation'];

export const stableNumber = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const domainForTags = (tags: string[] = []): ArticleVisualDomain => {
  const normalized = tags.map(tag => tag.trim()).filter(Boolean);
  const domains = Object.entries(DOMAIN_TAGS) as [ArticleVisualDomain, string[]][];

  for (const [domain, prefixes] of domains) {
    if (domain === 'general') continue;
    if (normalized.some(tag => prefixes.some(prefix => tag === prefix || tag.startsWith(prefix)))) {
      return domain;
    }
  }

  return 'general';
};

export const extractThesis = (article: Pick<Article, 'abstract' | 'title'>): string => {
  const text = (article.abstract || article.title || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'A compact research briefing for quick reading.';

  const sentence = text
    .split(/(?<=[.!?])\s+/)
    .find(part => part.replace(/[^A-Za-zА-Яа-я0-9]/g, '').length > 28) || text;

  const clean = sentence.replace(/^abstract\s*:?\s*/i, '').trim();
  if (clean.length <= 168) return clean;

  const clipped = clean.slice(0, 168);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 96 ? lastSpace : 168).trim()}...`;
};

export const getArticleVisual = (article: Article): ArticleVisual => {
  const domain = domainForTags(article.tags);
  const seed = stableNumber(`${article.id}:${article.title}:${article.tags.join('|')}`);
  const palette = DOMAIN_PALETTES[domain];
  const labels = DOMAIN_LABELS[domain];

  return {
    domain,
    labelKey: labels.labelKey,
    kickerKey: labels.kickerKey,
    thesis: extractThesis(article),
    pattern: PATTERNS[seed % PATTERNS.length],
    variant: seed % 4,
    ...palette,
  };
};
