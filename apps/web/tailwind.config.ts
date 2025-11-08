import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Grayscale scale with WCAG-compliant contrast
        gray: {
          50: '#FAFAFA',  // Background
          100: '#F5F5F5', // Sidebar
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373', // Text on white ≥4.5:1
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        // Single primary brand color (adjust to your brand)
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6', // Main brand color, contrast ≥4.5:1 on white
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        // Semantic colors
        background: '#FAFAFA',
        surface: '#FFFFFF',
        border: '#E5E5E5',
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
      },
      spacing: {
        // 8pt grid
        18: '4.5rem',   // 72px
        34: '8.5rem',   // 136px
        section: '2rem', // 32px - section gaps
        'section-lg': '2.5rem', // 40px
        'card-padding': '1.75rem', // 28px
        'card-padding-sm': '1.25rem', // 20px
      },
      fontSize: {
        'page-title': ['2rem', { lineHeight: '2.5rem', fontWeight: '600' }], // 32px
        'section-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }], // 24px
        body: ['1rem', { lineHeight: '1.5rem' }], // 16px
        meta: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        'meta-sm': ['0.75rem', { lineHeight: '1rem' }], // 12px
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      maxWidth: {
        content: '1200px',
      },
      width: {
        'sidebar-collapsed': '56px',
        'sidebar-expanded': '240px',
      },
    },
  },
  plugins: [],
}
export default config
