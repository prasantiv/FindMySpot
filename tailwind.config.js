/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // High-contrast palette tuned for WCAG AA against white & navy.
        brand: {
          50: '#eef4ff',
          100: '#dbe7ff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          900: '#0b1f4d',
        },
        accent: {
          500: '#0e7c66', // teal-700 equivalent; >=4.5:1 on white
          600: '#0a6753',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
