/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./src/**/*.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
