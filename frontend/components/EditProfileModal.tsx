
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, Theme } from '../types';
import { X, Camera, Lock, Sun, Moon, Monitor } from 'lucide-react';

interface EditProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  availableTags: string[];
  onClose: () => void;
  onSave: (data: Partial<UserProfile>) => Promise<void> | void;
  onChangePassword: (old: string, newP: string) => Promise<boolean>;
  currentTheme: Theme;
  onThemeChange: (t: Theme) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ 
  user, isOpen, availableTags, onClose, onSave, onChangePassword, currentTheme, onThemeChange 
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
      setProfileError("Name and nickname are required.");
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
      setProfileError(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordMessage(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: "Passwords do not match." });
      return;
    }
    if (!passwordData.oldPassword || !passwordData.newPassword) {
      setPasswordMessage({ type: 'error', text: "Current and new password are required." });
      return;
    }

    setIsChangingPassword(true);
    try {
      await onChangePassword(passwordData.oldPassword, passwordData.newPassword);
      setPasswordMessage({ type: 'success', text: "Password changed successfully." });
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordMessage(error instanceof Error ? { type: 'error', text: error.message } : { type: 'error', text: "Failed to change password." });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="bg-white dark:bg-dark-card rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
          <h2 id="edit-profile-title" className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close profile dialog" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-dark-border">
           <button 
             onClick={() => setActiveTab('profile')}
             className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
           >
             Public Profile
           </button>
           <button 
             onClick={() => setActiveTab('settings')}
             className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
           >
             Settings
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
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white" />
                  </div>
                </div>
                <button 
                  onClick={triggerFileInput}
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/20"
                >
                  Change
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">First & Last Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nickname</label>
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
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Workplace (Optional)</label>
                    <input 
                      type="text" 
                      value={formData.workplace}
                      onChange={e => setFormData({...formData, workplace: e.target.value})}
                      placeholder="University, Lab, Company"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Field of Study</label>
                    <select 
                      value={formData.fieldOfStudy}
                      onChange={e => setFormData({...formData, fieldOfStudy: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    >
                      <option value="">Select Field...</option>
                      <option value="Physics">Physics</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Biology">Biology</option>
                      <option value="Law">Law</option>
                      <option value="History">History</option>
                    </select>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">About</label>
                <textarea 
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none resize-none"
                  placeholder="Tell us your story..."
                />
              </div>

              <div className="h-px bg-gray-100 dark:bg-dark-border my-2"></div>

              {/* Interests */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Select Interests</label>
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
                      {tag}
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
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Appearance</h3>
                 <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Light', icon: <Sun size={20}/> },
                      { id: 'dark', label: 'Dark', icon: <Moon size={20}/> },
                      { id: 'system', label: 'System', icon: <Monitor size={20}/> }
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

              <div className="h-px bg-gray-100 dark:bg-dark-border"></div>

              {/* Security */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Account Security</h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 text-sm text-yellow-800 dark:text-yellow-200 flex gap-2 mb-6">
                  <Lock size={16} className="mt-0.5 shrink-0" />
                  <span>Changing your password will sign you out of all other devices.</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Old Password</label>
                    <input 
                      type="password" 
                      value={passwordData.oldPassword}
                      onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New Password</label>
                    <input 
                      type="password" 
                      value={passwordData.newPassword}
                      onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:border-gray-400 focus:ring-0 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Confirm New Password</label>
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
                    {isChangingPassword ? "Changing..." : "Change Password"}
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
              Cancel
            </button>
            <button 
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="px-5 py-2.5 rounded-full font-semibold bg-primary text-white hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
