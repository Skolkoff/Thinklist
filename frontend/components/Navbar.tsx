
import React from 'react';
import { Home, Library, Search, User } from 'lucide-react';
import { UserProfile, ViewState } from '../types';
import { Locale, t } from '../i18n';

interface NavbarProps {
  user?: UserProfile | null;
  locale: Locale;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate: (view: ViewState) => void;
  currentView: ViewState;
  onAuthClick?: () => void;
}

interface MobileNavButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

const MobileNavButton: React.FC<MobileNavButtonProps> = ({ label, active = false, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${
      active
        ? 'bg-black text-white dark:bg-white dark:text-black'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
    }`}
  >
    {icon}
    <span className="max-w-full truncate">{label}</span>
  </button>
);

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  locale,
  searchQuery, 
  onSearchChange,
  onNavigate,
  currentView,
  onAuthClick
}) => {
  return (
    <>
      <div className="sticky top-0 z-40 bg-white dark:bg-dark-bg py-3 px-3 sm:py-4 sm:px-6 shadow-sm flex items-center gap-3 sm:gap-4 border-b border-transparent dark:border-dark-border transition-colors">
        {/* Logo */}
        <button onClick={() => onNavigate(ViewState.FEED)} className="flex items-center gap-2 shrink-0" aria-label={t(locale, 'nav.home')}>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="font-bold text-xl text-primary hidden md:block tracking-tight">SciVise</span>
        </button>

        {/* Navigation Links */}
        <div className="hidden md:flex gap-1 shrink-0">
          <button 
            onClick={() => onNavigate(ViewState.FEED)}
            className={`px-4 py-3 rounded-full font-semibold text-base transition-colors ${
              currentView === ViewState.FEED 
                ? 'bg-black dark:bg-white text-white dark:text-black' 
                : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            {t(locale, 'nav.home')}
          </button>
          <button 
            onClick={() => onNavigate(ViewState.COLLECTIONS)}
            className={`px-4 py-3 rounded-full font-semibold text-base transition-colors ${
              currentView === ViewState.COLLECTIONS 
                ? 'bg-black dark:bg-white text-white dark:text-black' 
                : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            {t(locale, 'nav.collections')}
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-1 relative min-w-0">
          <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500">
            <Search size={18} />
          </div>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(locale, 'nav.search')}
            className="w-full bg-gray-100 dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-dark-card border border-transparent focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 rounded-full py-2.5 sm:py-3 pl-10 sm:pl-12 pr-3 sm:pr-4 text-base text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
          />
        </div>

        {/* Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-gray-500 dark:text-gray-400">
          {user ? (
            <button 
              onClick={() => onNavigate(ViewState.PROFILE)}
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden hover:opacity-80 transition-opacity"
              aria-label={t(locale, 'nav.profile')}
            >
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            </button>
          ) : (
            <button
              onClick={() => onAuthClick && onAuthClick()}
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
              aria-label={t(locale, 'nav.signIn')}
            >
              <User size={20} />
            </button>
          )}
        </div>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-dark-border dark:bg-dark-bg/95"
      >
        <div className="mx-auto flex max-w-sm gap-2">
          <MobileNavButton
            label={t(locale, 'nav.home')}
            active={currentView === ViewState.FEED}
            onClick={() => onNavigate(ViewState.FEED)}
            icon={<Home size={20} />}
          />
          <MobileNavButton
            label={t(locale, 'nav.boards')}
            active={currentView === ViewState.COLLECTIONS}
            onClick={() => onNavigate(ViewState.COLLECTIONS)}
            icon={<Library size={20} />}
          />
          <MobileNavButton
            label={user ? t(locale, 'nav.profile') : t(locale, 'nav.signIn')}
            active={currentView === ViewState.PROFILE}
            onClick={() => (user ? onNavigate(ViewState.PROFILE) : onAuthClick && onAuthClick())}
            icon={<User size={20} />}
          />
        </div>
      </nav>
    </>
  );
};
