/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crop: {
          soil: '#5C4033',
          earth: '#8B5A2B',
          sprout: '#4CAF50',
          growth: '#2E7D32',
          ripe: '#F59E0B',
          golden: '#D97706',
        },
        impact: {
          beneficial: '#10B981',
          neutral: '#6B7280',
          low: '#3B82F6',
          medium: '#F59E0B',
          high: '#F97316',
          critical: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
