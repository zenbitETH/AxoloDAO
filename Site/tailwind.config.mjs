/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        teal: '#009C9C',
        navy: '#0A3B49',
        'dark-navy': '#071F29',
        'mid-navy': '#0E4555',
        rosa: '#E85D75',
        ocre: '#D4925F',
        marfil: '#F4E8C8',
        cream: '#F6EFE0',
        choco: '#4A3628',
        'wq-aa': '#B87333',
        'wq-am': '#2C5F7C',
        'wq-ad': '#3E6B4A',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'cursive'],
        body: ['Montserrat', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        'neon-teal': '0 0 24px rgba(0, 156, 156, 0.45)',
        'neon-rosa': '0 0 24px rgba(232, 93, 117, 0.45)',
      },
      backdropBlur: { xs: '4px' },
      backgroundImage: {
        'glass': 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
      },
    },
  },
  plugins: [],
};
