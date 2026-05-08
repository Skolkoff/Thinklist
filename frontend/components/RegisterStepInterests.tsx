import React from 'react';
import { getTopicLabel, Locale, t } from '../i18n';

interface RegisterStepInterestsProps {
  tags: string[];
  selected: string[];
  locale: Locale;
  onToggle: (tag: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
}

export const RegisterStepInterests: React.FC<RegisterStepInterestsProps> = ({
  tags,
  selected,
  locale,
  onToggle,
  onBack,
  onNext,
  onSkip,
  loading
}) => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">{t(locale, 'auth.pickTopics')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.length ? (
          tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                selected.includes(tag)
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getTopicLabel(tag, locale)}
            </button>
          ))
        ) : (
          <span className="text-sm text-gray-400">{t(locale, 'auth.noTags')}</span>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:border-gray-300"
        >
          {t(locale, 'auth.back')}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-500 hover:border-gray-300"
        >
          {t(locale, 'auth.skip')}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t(locale, 'auth.saving') : t(locale, 'auth.continue')}
        </button>
      </div>
    </div>
  );
};
