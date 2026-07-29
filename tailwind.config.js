/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EDF4FA',
          100: '#D0E4F0',
          200: '#A8CBDF',
          300: '#7FAFC8',
          400: '#6497B8',
          500: '#5B80A0',
          600: '#4E7896',
          700: '#3E6080',
          800: '#2E4A64',
          900: '#1E3448',
          950: '#0F1E2C',
        },
        cream: {
          50:  '#FDFCFB',
          100: '#F8F5F0',
          200: '#F2ECE4',
          300: '#C9CCDB',
          400: '#DDD5C7',
          500: '#C8BEAD',
        },
        pale: {
          100: '#EBF4FA',
          200: '#D0E5F0',
          300: '#C5DDED',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        }
      }
    },
  },
  plugins: [],
}
