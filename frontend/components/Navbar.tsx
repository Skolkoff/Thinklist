
import React from 'react';
import { Search, User } from 'lucide-react';
import { UserProfile, ViewState } from '../types';

interface NavbarProps {
  user?: UserProfile | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate: (view: ViewState) => void;
  currentView: ViewState;
  onAuthClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  searchQuery, 
  onSearchChange,
  onNavigate,
  currentView,
  onAuthClick
}) => {
  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-dark-bg py-4 px-4 sm:px-6 shadow-sm flex items-center gap-4 border-b border-transparent dark:border-dark-border transition-colors">
      {/* Logo */}
      <button onClick={() => onNavigate(ViewState.FEED)} className="flex items-center gap-2 shrink-0">
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
          Home
        </button>
        <button 
          onClick={() => onNavigate(ViewState.COLLECTIONS)}
          className={`px-4 py-3 rounded-full font-semibold text-base transition-colors ${
            currentView === ViewState.COLLECTIONS 
              ? 'bg-black dark:bg-white text-white dark:text-black' 
              : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
          }`}
        >
          Collections
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex-1 relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
          <Search size={20} />
        </div>
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search for research, topics, or authors"
          className="w-full bg-gray-100 dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-dark-card border border-transparent focus:border-blue-300 dark:focus:border-blue-700 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 rounded-full py-3 pl-12 pr-4 text-base text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
        />
      </div>

      {/* Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-gray-500 dark:text-gray-400">
        {user ? (
          <button 
            onClick={() => onNavigate(ViewState.PROFILE)}
            className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden hover:opacity-80 transition-opacity"
          >
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          </button>
        ) : (
          <button
            onClick={() => onAuthClick && onAuthClick()}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
            aria-label="Sign in"
          >
            <User size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
