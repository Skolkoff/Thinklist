/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E60023',
        secondary: '#111111',
        scigray: '#E9E9E9',
        muted: '#767676',
        dark: {
          bg: '#0f0f0f',
          card: '#1e1e1e',
          border: '#333333',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
};
