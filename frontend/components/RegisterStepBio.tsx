import React from 'react';
import { Locale, t } from '../i18n';

interface RegisterStepBioProps {
  bio: string;
  onChange: (bio: string) => void;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
  loading: boolean;
  locale: Locale;
}

export const RegisterStepBio: React.FC<RegisterStepBioProps> = ({
  bio,
  onChange,
  onBack,
  onFinish,
  onSkip,
  loading,
  locale
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.shortBio')}</label>
        <textarea
          value={bio}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
          placeholder={t(locale, 'auth.bioPlaceholder')}
        />
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
          onClick={onFinish}
          disabled={loading}
          className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t(locale, 'auth.finishing') : t(locale, 'auth.finish')}
        </button>
      </div>
    </div>
  );
};
