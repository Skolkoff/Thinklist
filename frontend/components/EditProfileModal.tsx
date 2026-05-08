
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, Theme } from '../types';
import { X, Camera, Lock, Sun, Moon, Monitor } from 'lucide-react';
import { getTopicLabel, LanguagePreference, Locale, t } from '../i18n';

interface EditProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  availableTags: string[];
  locale: Locale;
  currentLanguagePreference: LanguagePreference;
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => Promise<void> | void;
  onChangePassword: (old: string, newP: string) => Promise<boolean>;
  currentTheme: Theme;
  onThemeChange: (t: Theme) => void;
  onLanguagePreferenceChange: (language: LanguagePreference) => Promise<void> | void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ 
  user, isOpen, availableTags, locale, currentLanguagePreference, onClose, onSave, onChangePassword, currentTheme, onThemeChange, onLanguagePreferenceChange
}) => {
  const [formData, setFormData] = useState({
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    workplace: user.workplace || '',
    fieldOfStudy: user.fieldOfStudy || '',
    bio: user.bio || '',
    interests: user.interests
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInterestToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(tag)
        ? prev.interests.filter(t => t !== tag)
        : [...prev.interests, tag]
    }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected for upload:", file);
      // Create a local object URL to simulate immediate upload/preview
      const newAvatarUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, avatarUrl: newAvatarUrl }));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    const name = formData.name.trim();
    const nickname = formData.nickname.trim();
    if (!name || !nickname) {
      setProfileError(t(locale, 'profile.nameRequired'));
      return;
    }

    setIsSavingProfile(true);
    try {
      await onSave({
        ...formData,
        name,
        nickname,
        workplace: formData.workplace.trim(),
        fieldOfStudy: formData.fieldOfStudy.trim(),
        bio: formData.bio.trim()
      });
      onClose();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t(locale, 'profile.saveFailed'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordMessage(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: t(locale, 'profile.passwordMismatch') });
      return;
    }
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      setPasswordMessage({ type: 'error', text: t(locale, 'profile.passwordRequired') });
      return;
    }

    setIsChangingPassword(true);
    try {
      await onChangePassword(passwordData.oldPassword, passwordData.newPassword);
      setPasswordMessage({ type: 'success', text: t(locale, 'profile.passwordChanged') });
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordMessage(error instanceof Error ? { type: 'error', text: error.message } : { type: 'error', text: t(locale, 'profile.passwordFailed') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
          <h2 id="edit-profile-title" className="text-xl font-bold text-gray-900 dark:text-white">{t(locale, 'profile.edit')}</h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label={t(locale, 'profile.closeDialog')} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-dark-border">
           <button 
             onClick={() => setActiveTab('profile')}
             className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
           >
             {t(locale, 'profile.publicProfile')}
           </button>
           <button 
             onClick={() => setActiveTab('settings')}
             className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
           >
             {t(locale, 'profile.settings')}
           </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Photo */}
              <div className="flex flex-col items-center gap-2">
                <div 
                  onClick={triggerFileInput}
                  className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden group cursor-pointer"
                >
                  <img src={formData.avatarUrl} alt={t(locale, 'profile.avatarAlt')} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white" />
                  </div>
                </div>
                <button 
                  onClick={triggerFileInput}
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/20"
                >
                  {t(locale, 'profile.change')}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.firstLastName')}</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.nickname')}</label>
                  <input 
                    type="text" 
                    value={formData.nickname}
                    onChange={e => setFormData({...formData, nickname: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.workplace')}</label>
                    <input 
                      type="text" 
                      value={formData.workplace}
                      onChange={e => setFormData({...formData, workplace: e.target.value})}
                      placeholder={t(locale, 'profile.workplacePlaceholder')}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.fieldOfStudy')}</label>
                    <select 
                      value={formData.fieldOfStudy}
                      onChange={e => setFormData({...formData, fieldOfStudy: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    >
                      <option value="">{t(locale, 'profile.selectField')}</option>
                      <option value="Physics">{t(locale, 'field.physics')}</option>
                      <option value="Mathematics">{t(locale, 'field.mathematics')}</option>
                      <option value="Computer Science">{t(locale, 'field.computerScience')}</option>
                      <option value="Biology">{t(locale, 'field.biology')}</option>
                      <option value="Law">{t(locale, 'field.law')}</option>
                      <option value="History">{t(locale, 'field.history')}</option>
                    </select>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.about')}</label>
                <textarea 
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none resize-none"
                  placeholder={t(locale, 'profile.aboutPlaceholder')}
                />
              </div>

              <div className="h-px bg-gray-100 dark:bg-dark-border my-2"></div>

              {/* Interests */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t(locale, 'profile.selectInterests')}</label>
                <div className="flex flex-wrap gap-2">
                  {(availableTags.length ? availableTags : user.interests).map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleInterestToggle(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        formData.interests.includes(tag)
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {getTopicLabel(tag, locale)}
                    </button>
                  ))}
                </div>
              </div>

              {profileError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                  {profileError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Appearance */}
              <div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t(locale, 'profile.appearance')}</h3>
                 <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: t(locale, 'profile.themeLight'), icon: <Sun size={20}/> },
                      { id: 'dark', label: t(locale, 'profile.themeDark'), icon: <Moon size={20}/> },
                      { id: 'system', label: t(locale, 'profile.themeSystem'), icon: <Monitor size={20}/> }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onThemeChange(t.id as Theme)}
                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                          currentTheme === t.id 
                            ? 'border-primary bg-red-50 dark:bg-red-900/20 text-primary' 
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                         {t.icon}
                         <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    ))}
                 </div>
              </div>

              <div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t(locale, 'profile.language')}</h3>
                 <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'system', label: t(locale, 'profile.languageSystem') },
                      { id: 'en', label: t(locale, 'profile.languageEnglish') },
                      { id: 'ru', label: t(locale, 'profile.languageRussian') }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => onLanguagePreferenceChange(option.id as LanguagePreference)}
                        className={`flex min-h-16 items-center justify-center rounded-xl border p-3 text-sm font-semibold transition-all ${
                          currentLanguagePreference === option.id
                            ? 'border-primary bg-red-50 text-primary dark:bg-red-900/20'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5'
                        }`}
                      >
                         {option.label}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-dark-border"></div>

              {/* Security */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t(locale, 'profile.accountSecurity')}</h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 text-sm text-yellow-800 dark:text-yellow-200 flex gap-2 mb-6">
                  <Lock size={16} className="mt-0.5 shrink-0" />
                  <span>{t(locale, 'profile.passwordWarning')}</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.oldPassword')}</label>
                    <input 
                      type="password" 
                      value={passwordData.oldPassword}
                      onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.newPassword')}</label>
                    <input 
                      type="password" 
                      value={passwordData.newPassword}
                      onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(locale, 'profile.confirmNewPassword')}</label>
                    <input 
                      type="password" 
                      value={passwordData.confirmPassword}
                      onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                  </div>
                </div>

                {passwordMessage && (
                  <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                    passwordMessage.type === 'success'
                      ? 'border-green-100 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-200'
                      : 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200'
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}
                
                <div className="pt-6 flex justify-end">
                  <button 
                    onClick={handleSavePassword}
                    disabled={isChangingPassword}
                    className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                  >
                    {isChangingPassword ? t(locale, 'profile.changingPassword') : t(locale, 'profile.changePassword')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'profile' && (
          <div className="p-4 border-t border-gray-100 dark:border-dark-border flex justify-end gap-3 bg-gray-50 dark:bg-dark-bg">
            <button 
              onClick={onClose}
              disabled={isSavingProfile}
              className="px-5 py-2.5 rounded-full font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t(locale, 'profile.cancel')}
            </button>
            <button 
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="px-5 py-2.5 rounded-full font-semibold bg-primary text-white hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProfile ? t(locale, 'profile.saving') : t(locale, 'profile.saveProfile')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
