/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          500: '#22c55e', // Vibrant green, kid friendly
          600: '#16a34a',
          700: '#15803d',
        },
        secondary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6', // Bright blue
          600: '#2563eb',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b', // Warm yellow/orange
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          raised: '#f1f5f9',
        },
        text: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          light: '#94a3b8',
        },
        error: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
        background: '#f8fafc',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Tamil"', 'sans-serif'],
        display: ['"Outfit"', '"Noto Sans Tamil"', 'sans-serif'],
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      spacing: {
        'touch': '44px',
      }
    },
  },
  plugins: [],
}
