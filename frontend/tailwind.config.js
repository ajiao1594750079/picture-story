/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'kids': ['"Comic Sans MS"', '"Chalkboard SE"', 'cursive'],
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-fast': 'pulse 1s infinite',
      }
    },
  },
  plugins: [],
}
