/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 'jersey' will map to the Jersey 25 font loaded via index.html
        jersey: ["'Jersey 25'", 'system-ui', '-apple-system', "'Segoe UI'", 'Roboto', 'Arial'],
      }
    },
  },
  plugins: [],
};