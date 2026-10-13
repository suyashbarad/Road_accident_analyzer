/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      opacity: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`${i}`, `${i / 100}`])),
      colors: {
        ink: {
          950: '#060913',
          900: '#0a0f1e',
          850: '#0e1526',
          800: '#121b30',
          700: '#1b2740',
          600: '#26344f',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          300: '#7cc0ff',
          400: '#4aa8ff',
          500: '#2f8bff',
          600: '#1f6fe0',
        },
        risk: {
          low: '#22c55e',
          moderate: '#eab308',
          high: '#f97316',
          veryhigh: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 18px 50px -12px rgba(0,0,0,0.7)',
        card: '0 10px 30px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseRing: { '0%': { transform: 'scale(0.8)', opacity: 0.7 }, '100%': { transform: 'scale(2.2)', opacity: 0 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.35s ease-out both',
        pulseRing: 'pulseRing 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
}
