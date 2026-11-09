// Tailwind build config. The CSS is compiled by build.mjs into assets/css/site.css.
/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./index.html"],
  theme: {
    extend: {
      colors: {
        page: '#fafafa',
        ink: '#131210',
        muted: '#2f2e2b',
        navy: { DEFAULT: '#16202e', 700: '#1e2a3b', 600: '#27364a' },
        brand: { DEFAULT: '#144486', soft: '#89a1c2' },
        surface: { DEFAULT: '#f3f3f3', warm: '#f6f5f3', deep: '#e7e8ea' },
        line: { DEFAULT: '#e2e2e1', strong: '#c6c6c6' },
        mist: '#d3d9df',
      },
      fontFamily: {
        display: ['Onest', 'Arial', 'sans-serif'],
        sans: ['Geist', 'Arial', 'sans-serif'],
      },
      spacing: { section: '7.5rem', 'section-sm': '4.5rem' },
      maxWidth: { site: '84.5rem' },
      borderRadius: { card: '0.75rem' },
      boxShadow: {
        float: '0 1px 2px rgba(22,32,46,.06), 0 10px 24px -8px rgba(22,32,46,.16), 0 28px 56px -20px rgba(22,32,46,.18)',
        raised: '0 1px 1px rgba(22,32,46,.04), 0 6px 16px -8px rgba(22,32,46,.12)',
      },
    },
  },
};
