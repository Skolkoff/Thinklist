import React from 'react';

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
}

export const RegisterStepAccount: React.FC<RegisterStepAccountProps> = ({
  data,
  onChange,
  onSubmit,
  loading
}) => {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">Email</label>
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
          <label className="block text-xs font-semibold text-gray-500 mb-2">Password</label>
          <input
            type="password"
            value={data.password}
            onChange={(event) => onChange({ ...data, password: event.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">Confirm</label>
          <input
            type="password"
            value={data.confirmPassword}
            onChange={(event) => onChange({ ...data, confirmPassword: event.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
            placeholder="Repeat password"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">Nickname</label>
        <input
          type="text"
          value={data.nickname}
          onChange={(event) => onChange({ ...data, nickname: event.target.value })}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none focus:border-gray-400"
          placeholder="e.g. nova"
        />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Creating account...' : 'Continue'}
      </button>
    </div>
  );
};
