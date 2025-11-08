# Dashboard Frontend

A minimal, accessible dashboard UI built with Next.js 14, Tailwind CSS v3, and shadcn/ui patterns.

## Features

- **Design System** - WCAG AA compliant, single primary color, consistent tokens
- **Components** - KPI tiles, time series charts, responsive tables, navigation
- **Accessibility** - Keyboard navigation, screen reader support, motion preferences
- **Responsive** - Desktop sidebar, mobile bottom tabs, adaptive layouts
- **TypeScript** - Full type safety
- **Performance** - Static generation, optimized bundles

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

Visit http://localhost:3000/example to see the complete dashboard example.

### Build for Production

```bash
pnpm build
pnpm start
```

### Lint

```bash
pnpm lint
```

## Documentation

- [QUICK_START.md](QUICK_START.md) - Get started quickly with examples
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) - Complete design system documentation
- [app/example/page.tsx](app/example/page.tsx) - Full dashboard example

## Project Structure

```
apps/web/
├── app/
│   ├── example/           # Example dashboard page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles + design tokens
├── components/
│   ├── ui/                # UI primitives
│   │   ├── card.tsx
│   │   ├── kpi-tile.tsx
│   │   ├── time-series-chart.tsx
│   │   ├── data-table.tsx
│   │   ├── sidebar.tsx
│   │   ├── mobile-nav.tsx
│   │   ├── tabs.tsx
│   │   └── separator.tsx
│   └── layout/
│       └── dashboard-layout.tsx  # Layout wrapper
├── lib/
│   └── utils.ts           # Utility functions
├── tailwind.config.ts     # Design tokens
└── .eslintrc.json         # Accessibility linting

```

## Stack

| Package | Purpose | Version |
|---------|---------|---------|
| Next.js | Framework | ^14.2.0 |
| React | UI library | ^18.3.0 |
| Tailwind CSS | Styling | ^3.4.0 |
| Recharts | Charts | ^3.3.0 |
| Radix UI | Primitives | Latest |
| Lucide React | Icons | Latest |
| date-fns | Date utilities | ^4.1.0 |

## Components

### KPI Tile
```tsx
<KPITile value={152430} label="Revenue" delta={12.5} format="currency" />
```

### Time Series Chart
```tsx
<TimeSeriesChart
  data={chartData}
  type="area"
  title="Revenue Trend"
  valueFormatter={(v) => `$${v.toLocaleString()}`}
/>
```

### Data Table
```tsx
<DataTable
  data={orders}
  columns={[
    { header: 'Order', accessor: (o) => o.id },
    { header: 'Amount', accessor: (o) => `$${o.amount}` },
  ]}
  getRowKey={(o) => o.id}
/>
```

### Dashboard Layout
```tsx
<DashboardLayout>
  <h1 className="text-page-title">Dashboard</h1>
  {/* Your content */}
</DashboardLayout>
```

## Design Principles

1. **Minimal** - Single primary color, no secondary palette
2. **Accessible** - WCAG AA (≥4.5:1 contrast), keyboard navigation, screen readers
3. **Consistent** - 8pt grid, defined tokens, no mixed radii
4. **Responsive** - Mobile-first, adaptive layouts
5. **Fast** - Static generation, optimized bundles, minimal JavaScript

## What to Avoid

- Multiple accent colors
- Heavy shadows or borders
- Mixed corner radii
- Overloaded tiles (one metric per tile)
- Icons in tight spaces

## Customization

### Change Primary Color

Edit [tailwind.config.ts](tailwind.config.ts):

```ts
primary: {
  500: '#YOUR_COLOR', // Must meet 4.5:1 contrast on white
  // Generate full scale at: https://uicolors.app
}
```

### Change Fonts

Edit [tailwind.config.ts](tailwind.config.ts) and [app/globals.css](app/globals.css):

```css
@import url('https://fonts.googleapis.com/css2?family=YourFont:wght@400;500;600;700&display=swap');
```

```ts
fontFamily: {
  sans: ['YourFont', 'system-ui', ...],
}
```

### Adjust Spacing

Edit [tailwind.config.ts](tailwind.config.ts):

```ts
spacing: {
  'card-padding': '2rem', // Adjust card padding
}
```

## Accessibility

### Contrast

All text meets WCAG AA (≥4.5:1):
- `text-gray-500` on white: 4.54:1
- `text-gray-900` on white: 16.2:1

Test your colors: https://webaim.org/resources/contrastchecker/

### Keyboard Navigation

- Tab through interactive elements
- Enter/Space to activate
- Escape to close modals
- Arrow keys in menus

### Screen Readers

- Semantic HTML (`<nav>`, `<main>`, `<article>`)
- ARIA labels on icons
- Live regions for dynamic content
- Skip links for navigation

### Motion

Respects `prefers-reduced-motion` media query.

## Performance

- Static generation where possible
- Code splitting by route
- Optimized images with Next.js Image
- Minimal client-side JavaScript
- Tree-shaking unused code

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile Safari (iOS 12+)
- Chrome Android (last 2 versions)

## License

Private - not for distribution

## Support

For issues or questions, see the documentation:
- [QUICK_START.md](QUICK_START.md)
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
