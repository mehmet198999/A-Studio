const flowbiteReact = require("flowbite-react/plugin/tailwindcss");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", ".flowbite-react/class-list.json"],
  theme: { extend: {} },
  plugins: [flowbiteReact],
}
