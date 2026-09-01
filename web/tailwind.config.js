/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAF9',
        ink: '#111110',
        surface: '#FFFFFF',
        'surface-muted': '#F1F0EE',
        'surface-active': '#E9E7E3',
        'text-muted': '#6E6C67',
        'text-faint': '#9B988F',
        accent: '#F5711F',
        'accent-soft': '#FDEBDD',
        danger: '#C2410C',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        pop: '0 8px 30px rgba(17, 17, 16, 0.10)',
        lift: '0 2px 10px rgba(17, 17, 16, 0.06)',
      },
    },
  },
  plugins: [],
};
