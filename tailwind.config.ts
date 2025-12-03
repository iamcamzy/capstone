import type { Config } from 'tailwindcss';

const config: Config & { safelist?: (string | { pattern: string })[] } = {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx}'],
  theme: {
    extend: { 
      colors: {
        lion: {
          DEFAULT: '#aa8f66',
          100: '#231d13',
          200: '#463926',
          300: '#69563a',
          400: '#8b724d',
          500: '#aa8f66',
          600: '#bba583',
          700: '#ccbba2',
          800: '#ddd2c1',
          900: '#eee8e0',
        },
        butterscotch: {
          DEFAULT: '#ed9b40',
          100: '#372005',
          200: '#6e400a',
          300: '#a55f0f',
          400: '#dc7f14',
          500: '#ed9b40',
          600: '#f1b066',
          700: '#f4c48c',
          800: '#f8d7b2',
          900: '#fbebd9',
        },
        jet: {
          DEFAULT: '#363537',
          100: '#0b0a0b',
          200: '#151516',
          300: '#201f21',
          400: '#2b2a2c',
          500: '#363537',
          600: '#5e5c60',
          700: '#868489',
          800: '#aeadb0',
          900: '#d7d6d8',
        },
      },
    },
  },
  safelist: [
    'bg-[#ed9b40]',
    'bg-[#3d2810]',
    'translate-x-0',
    'translate-x-6',
    // Dark mode variants
    'dark:bg-[#363537]',
    'dark:bg-white',
    'dark:text-white',
    'dark:text-black',
    'dark:shadow-lg',
    'dark:border-white',
  ],
  plugins: [],
};

export default config;
