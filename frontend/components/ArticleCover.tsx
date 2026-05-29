import React from 'react';
import { Article } from '../types';
import { getArticleVisual } from '../services/articleVisuals';
import { getTopicChipLabel, Locale, t } from '../i18n';

interface ArticleCoverProps {
  article: Article;
  locale: Locale;
  mode?: 'card' | 'modal' | 'compact';
}

const patternClass = {
  columns: 'bg-[linear-gradient(90deg,var(--cover-line)_1px,transparent_1px),linear-gradient(180deg,var(--cover-line)_1px,transparent_1px)] bg-[size:34px_34px]',
  grid: 'bg-[linear-gradient(90deg,var(--cover-line)_1px,transparent_1px),linear-gradient(180deg,var(--cover-line)_1px,transparent_1px)] bg-[size:18px_18px]',
  rings: 'bg-[radial-gradient(circle_at_24%_28%,transparent_0_18px,var(--cover-line)_19px_20px,transparent_21px_48px),radial-gradient(circle_at_78%_68%,transparent_0_32px,var(--cover-line)_33px_34px,transparent_35px_72px)]',
  wave: 'bg-[repeating-linear-gradient(135deg,var(--cover-line)_0_1px,transparent_1px_20px)]',
  ledger: 'bg-[linear-gradient(180deg,var(--cover-line)_1px,transparent_1px),linear-gradient(90deg,var(--cover-line)_1px,transparent_1px)] bg-[size:100%_28px,52px_100%]',
  constellation: 'bg-[radial-gradient(circle_at_18%_25%,var(--cover-line)_0_2px,transparent_3px),radial-gradient(circle_at_62%_38%,var(--cover-line)_0_2px,transparent_3px),radial-gradient(circle_at_78%_72%,var(--cover-line)_0_2px,transparent_3px),linear-gradient(120deg,transparent_0_45%,var(--cover-line)_46%,transparent_47%)]',
};

export const ArticleCover: React.FC<ArticleCoverProps> = ({ article, locale, mode = 'card' }) => {
  const visual = getArticleVisual(article);
  const isModal = mode === 'modal';
  const isCompact = mode === 'compact';
  const year = article.publishedAt ? new Date(article.publishedAt).getFullYear() : '';
  const hook = visual.thesis || t(locale, 'cover.fallbackHook');

  return (
    <div
      className={[
        'relative h-full min-h-[220px] w-full overflow-hidden text-left transition-transform duration-500 group-hover:scale-[1.015]',
        isModal ? 'min-h-full rounded-none' : 'aspect-[4/5] rounded-2xl',
        isCompact ? 'min-h-[132px] rounded-xl' : '',
      ].join(' ')}
      style={{
        backgroundColor: visual.paper,
        color: visual.ink,
        ['--cover-accent' as string]: visual.accent,
        ['--cover-wash' as string]: visual.wash,
        ['--cover-line' as string]: `${visual.accent}22`,
      }}
      aria-label={`${t(locale, visual.labelKey)}: ${article.title}`}
    >
      <div className={`absolute inset-0 opacity-80 ${patternClass[visual.pattern]}`} />
      <div className="absolute inset-x-0 top-0 h-2 bg-[var(--cover-accent)]" />
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[var(--cover-wash)] blur-sm" />
      <div className="absolute bottom-0 left-0 h-28 w-full bg-gradient-to-t from-black/[0.07] to-transparent" />

      <div className={['relative flex h-full min-h-[inherit] flex-col', isModal ? 'p-8 sm:p-10' : 'p-5', isCompact ? 'p-4' : ''].join(' ')}>
        <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--cover-accent)]">
              {t(locale, visual.labelKey)}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
              {t(locale, visual.kickerKey)}
            </p>
          </div>
          <div className="shrink-0 border-l border-black/15 pl-3 text-right font-serif text-xs font-bold leading-tight opacity-70" aria-label={t(locale, 'cover.year')}>
            {year}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-5 py-5">
          {!isCompact && (
            <div className="border-y border-black/10 py-4">
              <p className={['font-serif font-black leading-tight tracking-normal', isModal ? 'line-clamp-8 text-3xl sm:text-4xl lg:text-5xl' : 'line-clamp-6 text-xl'].join(' ')}>
                {hook}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-black/10 pt-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">
              {article.source || 'Research'}
            </p>
            <p className="mt-1 truncate text-xs opacity-70">
              {(article.tags || []).slice(0, 3).map(tag => getTopicChipLabel(tag, locale)).join(' / ') || t(locale, 'cover.generalTag')}
            </p>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--cover-accent)] text-sm font-black text-[var(--cover-accent)]">
            {visual.variant + 1}
          </div>
        </div>
      </div>
    </div>
  );
};
