import React from 'react';
import { Locale, t } from '../i18n';

interface RegisterStepAccountProps {
  data: {
    email: string;
    password: string;
    confirmPassword: string;
    nickname: string;
  };
  onChange: (next: RegisterStepAccountProps['data']) => void;
  onSubmit: () => void;
  loading: boolean;
  locale: Locale;
}

export const RegisterStepAccount: React.FC<RegisterStepAccountProps> = ({
  data,
  onChange,
  onSubmit,
  loading,
  locale
}) => {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.email')}</label>
        <input
          type="email"
          value={data.email}
          onChange={(event) => onChange({ ...data, email: event.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
          placeholder="you@lab.edu"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.password')}</label>
          <input
            type="password"
            value={data.password}
            onChange={(event) => onChange({ ...data, password: event.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
            placeholder={t(locale, 'auth.passwordPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.confirm')}</label>
          <input
            type="password"
            value={data.confirmPassword}
            onChange={(event) => onChange({ ...data, confirmPassword: event.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
            placeholder={t(locale, 'auth.confirmPlaceholder')}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.nickname')}</label>
        <input
          type="text"
          value={data.nickname}
          onChange={(event) => onChange({ ...data, nickname: event.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
          placeholder={t(locale, 'auth.nicknamePlaceholder')}
        />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t(locale, 'auth.creatingAccount') : t(locale, 'auth.continue')}
      </button>
    </div>
  );
};
