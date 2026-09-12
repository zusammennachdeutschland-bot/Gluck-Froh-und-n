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
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          soft: 'rgba(59, 130, 246, 0.1)',
          border: 'rgba(59, 130, 246, 0.25)',
        },
        surface: {
          DEFAULT: 'var(--surface-color, #ffffff)',
          hover: 'var(--surface-hover, #f8fafc)',
          border: 'var(--surface-border, #e2e8f0)',
        },
        background: 'var(--bg-color, #f8fafc)',
        'text-main': 'var(--text-main, #0f172a)',
        'text-muted': 'var(--text-muted, #64748b)',
      },
      fontFamily: {
        arabic: ['Alexandria', 'Cairo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
