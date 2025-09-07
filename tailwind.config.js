/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        appbg: 'var(--bg-app)',
        card: 'var(--card)',
        'card-hover': 'var(--card-hover)',
        text: 'var(--text)',
        muted: 'var(--muted)'
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        'card-lg': '0 6px 16px rgba(0,0,0,0.12)'
      },
      borderRadius: {
        card: '12px',
        input: '10px',
        btn: '8px'
      }
    }
  },
  plugins: []
}

