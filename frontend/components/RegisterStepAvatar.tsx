import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react';

interface RegisterStepAvatarProps {
  selectedAvatar: string | null;
  presetAvatars: string[];
  onSelect: (url: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  loading: boolean;
}

export const RegisterStepAvatar: React.FC<RegisterStepAvatarProps> = ({
  selectedAvatar,
  presetAvatars,
  onSelect,
  onBack,
  onNext,
  onSkip,
  loading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelect(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-full border border-gray-200">
          <img
            src={selectedAvatar || presetAvatars[0]}
            alt="Selected avatar"
            className="h-full w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
        >
          <UploadCloud size={16} /> Upload avatar
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Suggested avatars</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {presetAvatars.map((avatar) => (
            <button
              key={avatar}
              type="button"
              onClick={() => onSelect(avatar)}
              className={`h-14 w-14 overflow-hidden rounded-full border-2 transition-colors ${
                selectedAvatar === avatar ? 'border-black' : 'border-transparent'
              }`}
            >
              <img src={avatar} alt="Avatar option" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:border-gray-300"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-500 hover:border-gray-300"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
};
