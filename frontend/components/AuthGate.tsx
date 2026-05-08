import React, { useState } from 'react';
import { api } from '../services/api';
import { UserProfile } from '../types';
import { RegisterStepAccount } from './RegisterStepAccount';
import { RegisterStepAvatar } from './RegisterStepAvatar';
import { RegisterStepInterests } from './RegisterStepInterests';
import { RegisterStepBio } from './RegisterStepBio';
import { Locale, t } from '../i18n';

const PRESET_AVATARS = [
  '/images/avatars/avatar-1.svg',
  '/images/avatars/avatar-2.svg',
  '/images/avatars/avatar-3.svg',
  '/images/avatars/avatar-4.svg',
  '/images/avatars/avatar-5.svg',
  '/images/avatars/avatar-6.svg'
];

type RegisterStep = 'account' | 'avatar' | 'interests' | 'bio';

interface AuthGateProps {
  availableTags: string[];
  locale: Locale;
  onAuthSuccess: (user: UserProfile) => void;
  onClose?: () => void;
}

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { detail?: string };
      if (parsed.detail) return parsed.detail;
    } catch (err) {
      // noop
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
};

export const AuthGate: React.FC<AuthGateProps> = ({ availableTags, locale, onAuthSuccess, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [step, setStep] = useState<RegisterStep>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountData, setAccountData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: ''
  });
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [profileData, setProfileData] = useState({
    avatarUrl: PRESET_AVATARS[0],
    interests: [] as string[],
    bio: ''
  });
  const [registeredUser, setRegisteredUser] = useState<UserProfile | null>(null);

  const steps: RegisterStep[] = ['account', 'avatar', 'interests', 'bio'];
  const stepIndex = steps.indexOf(step) + 1;

  const resetErrors = () => setError(null);

  const handleRegisterAccount = async () => {
    resetErrors();
    const email = accountData.email.trim();
    const nickname = accountData.nickname.trim();

    if (!email || !email.includes('@')) {
      setError(t(locale, 'auth.validEmailError'));
      return;
    }
    if (accountData.password.length < 8) {
      setError(t(locale, 'auth.passwordLengthError'));
      return;
    }
    if (accountData.password !== accountData.confirmPassword) {
      setError(t(locale, 'auth.passwordMatchError'));
      return;
    }
    if (!nickname) {
      setError(t(locale, 'auth.nicknameRequiredError'));
      return;
    }

    setLoading(true);
    try {
      const nicknameCheck = await api.checkNickname(nickname);
      if (!nicknameCheck.available) {
        setError(t(locale, 'auth.nicknameTakenError'));
        setLoading(false);
        return;
      }
      await api.register({
        email,
        password: accountData.password,
        nickname
      });
      const user = await api.login(email, accountData.password);
      setRegisteredUser(user);
      setStep('avatar');
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarNext = async () => {
    resetErrors();
    if (!registeredUser) return;

    setLoading(true);
    try {
      const avatarUrl = profileData.avatarUrl || PRESET_AVATARS[0];
      api.cacheAvatar(registeredUser.id, avatarUrl);
      const updated = await api.updateUserProfile({ avatarUrl });
      setRegisteredUser(updated);
      setStep('interests');
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInterestsNext = async () => {
    resetErrors();
    if (!registeredUser) return;

    setLoading(true);
    try {
      const updated = await api.updateUserProfile({ interests: profileData.interests });
      setRegisteredUser(updated);
      setStep('bio');
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAvatar = () => {
    setStep('interests');
  };

  const handleSkipInterests = () => {
    setStep('bio');
  };

  const handleSkipBio = () => {
    if (registeredUser) onAuthSuccess(registeredUser);
  };

  const handleFinish = async () => {
    resetErrors();
    if (!registeredUser) return;

    setLoading(true);
    try {
      const updated = await api.updateUserProfile({ bio: profileData.bio });
      onAuthSuccess(updated);
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    resetErrors();
    const email = loginData.email.trim();
    if (!email || !email.includes('@')) {
      setError(t(locale, 'auth.validEmailError'));
      return;
    }
    if (!loginData.password) {
      setError(t(locale, 'auth.passwordRequiredError'));
      return;
    }

    setLoading(true);
    try {
      const user = await api.login(email, loginData.password);
      onAuthSuccess(user);
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-12 text-gray-900">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
              S
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">SciVise</p>
              <h1 className="text-2xl font-bold">
                {mode === 'register' ? t(locale, 'auth.createAccount') : t(locale, 'auth.welcomeBack')}
              </h1>
            </div>
          </div>
          <div className="flex gap-2 rounded-full bg-gray-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setStep('account');
                resetErrors();
              }}
              className={`rounded-full px-4 py-2 ${mode === 'register' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              {t(locale, 'auth.register')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                resetErrors();
              }}
              className={`rounded-full px-4 py-2 ${mode === 'login' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              {t(locale, 'auth.login')}
            </button>
          </div>
        </div>
        {onClose && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
            >
              {t(locale, 'auth.continueBrowsing')}
            </button>
          </div>
        )}

        {mode === 'register' && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
              <span>{t(locale, 'auth.step', { current: stepIndex, total: steps.length })}</span>
              <span className="uppercase tracking-[0.2em]">{t(locale, 'auth.onboarding')}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-black transition-all"
                style={{ width: `${(stepIndex / steps.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="mt-8">
          {mode === 'register' && step === 'account' && (
            <RegisterStepAccount
              data={accountData}
              onChange={setAccountData}
              onSubmit={handleRegisterAccount}
              loading={loading}
              locale={locale}
            />
          )}

          {mode === 'register' && step === 'avatar' && (
            <RegisterStepAvatar
              selectedAvatar={profileData.avatarUrl}
              presetAvatars={PRESET_AVATARS}
              onSelect={(url) => setProfileData((prev) => ({ ...prev, avatarUrl: url }))}
              onBack={() => setStep('account')}
              onNext={handleAvatarNext}
              onSkip={handleSkipAvatar}
              loading={loading}
              locale={locale}
            />
          )}

          {mode === 'register' && step === 'interests' && (
            <RegisterStepInterests
              tags={availableTags}
              selected={profileData.interests}
              locale={locale}
              onToggle={(tag) =>
                setProfileData((prev) => ({
                  ...prev,
                  interests: prev.interests.includes(tag)
                    ? prev.interests.filter((item) => item !== tag)
                    : [...prev.interests, tag]
                }))
              }
              onBack={() => setStep('avatar')}
              onNext={handleInterestsNext}
              onSkip={handleSkipInterests}
              loading={loading}
            />
          )}

          {mode === 'register' && step === 'bio' && (
            <RegisterStepBio
              bio={profileData.bio}
              onChange={(bio) => setProfileData((prev) => ({ ...prev, bio }))}
              onBack={() => setStep('interests')}
              onFinish={handleFinish}
              onSkip={handleSkipBio}
              loading={loading}
              locale={locale}
            />
          )}

          {mode === 'login' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.email')}</label>
                <input
                  type="email"
                  value={loginData.email}
                  onChange={(event) => setLoginData((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
                  placeholder="you@lab.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">{t(locale, 'auth.password')}</label>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(event) => setLoginData((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
                  placeholder={t(locale, 'auth.yourPassword')}
                />
              </div>
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t(locale, 'auth.signingIn') : t(locale, 'auth.signIn')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
