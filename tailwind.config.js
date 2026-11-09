/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The classroom palette: a deep board, warm paper, one pencil accent,
        // and the four classmates carry the rest of the colour.
        board: {
          DEFAULT: '#213B33',
          deep: '#172B25',
          wash: '#E8EEE5',
        },
        chalk: '#F1EFE4',
        paper: {
          DEFAULT: '#F6F1E6',
          2: '#EFE7D7',
        },
        surface: '#FFFCF6',
        ink: {
          DEFAULT: '#1E1B16',
          strong: '#1E1B16',
          soft: '#4A443A',
        },
        muted: '#655D51',
        line: '#E3D8C5',
        pencil: {
          DEFAULT: '#F2B33D',
          deep: '#C3870F',
          soft: '#E7C376',
          wash: '#FBEFD1',
        },
        right: {
          DEFAULT: '#1D7F57',
          deep: '#155C3F',
        },
        wrong: {
          DEFAULT: '#B8334B',
          deep: '#8E2439',
        },
        mika: '#4F7FE8',
        rafa: '#D64561',
        iya: '#1F9E77',
        dev: '#8A63D2',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Georgia', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
        mono: ['"Courier Prime"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.68rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(70,52,24,0.06), 0 10px 28px -16px rgba(70,52,24,0.22)',
        lift: '0 2px 4px rgba(70,52,24,0.08), 0 22px 44px -26px rgba(70,52,24,0.3)',
        board: '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 60px -30px rgba(23,43,37,0.5)',
      },
      borderRadius: {
        xl2: '1.15rem',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'hand-up': {
          '0%': { transform: 'rotate(-14deg) translateY(6px)', opacity: '0' },
          '60%': { transform: 'rotate(4deg) translateY(-2px)', opacity: '1' },
          '100%': { transform: 'rotate(0deg) translateY(0)', opacity: '1' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '320' },
          '100%': { strokeDashoffset: '0' },
        },
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'dots-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'hand-up': 'hand-up 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        bob: 'bob 3.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        'dots-bounce': 'dots-bounce 1.1s ease-in-out infinite',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
