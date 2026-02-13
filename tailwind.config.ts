import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fleet: {
          black: '#0B0F14',
          dark: '#1A1F26',
          mid: '#2B313A',
          light: '#E5E7EB',
          white: '#FFFFFF',
          red: '#DC2626',
          redHover: '#B91C1C',
          danger: '#991B1B',
        },
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.tap': {
          minHeight: '44px',
          minWidth: '44px',
        },
        '.tap-lg': {
          minHeight: '52px',
          minWidth: '52px',
        },
      });
    }),
  ],
};

export default config;
