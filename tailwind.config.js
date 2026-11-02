/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#070E0E',
          900: '#0B1616',
          850: '#0F1D1D',
          800: '#142525',
          700: '#1E3636',
          600: '#2A4B4B',
        },
        regalGold: {
          100: '#FDF8ED',
          200: '#F9EED4',
          300: '#F2DCAB',
          400: '#E6C57B',
          500: '#D4AF37',
          600: '#AA8B24',
          700: '#806716',
        },
        holyEmerald: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
      },
      fontFamily: {
        tajawal: ['Tajawal', 'sans-serif'],
        quran: ['Amiri', 'Noto Naskh Arabic', 'serif'],
        mono: ['Space Grotesk', 'monospace'],
      },
    },
  },
  plugins: [],
};

