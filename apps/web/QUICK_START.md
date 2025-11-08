# Quick Start Guide

## View the Example

The complete dashboard example is available at:
```
http://localhost:3000/example
```

Run the dev server:
```bash
cd apps/web
pnpm dev
```

## Create a New Dashboard Page

### 1. Use the Layout Wrapper

```tsx
// app/dashboard/page.tsx
import { DashboardLayout } from '@/components'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <h1 className="text-page-title mb-section">My Dashboard</h1>
      {/* Your content */}
    </DashboardLayout>
  )
}
```

### 2. Add KPI Tiles

```tsx
import { KPITile } from '@/components'

<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <KPITile
    value={152430}
    label="Total Revenue"
    delta={12.5}
    format="currency"
  />
  <KPITile
    value={8492}
    label="Total Orders"
    delta={8.2}
    format="number"
  />
</div>
```

### 3. Add a Chart

```tsx
import { TimeSeriesChart } from '@/components'

const chartData = [
  { date: '2024-01-01', value: 1200 },
  { date: '2024-01-02', value: 1350 },
  { date: '2024-01-03', value: 1280 },
]

<TimeSeriesChart
  data={chartData}
  type="area"
  title="Revenue Trend"
  valueFormatter={(v) => `$${v.toLocaleString()}`}
/>
```

### 4. Add a Data Table

```tsx
import { DataTable } from '@/components'

interface Order {
  id: string
  customer: string
  amount: number
}

const orders: Order[] = [
  { id: '001', customer: 'John Doe', amount: 129.99 },
  { id: '002', customer: 'Jane Smith', amount: 249.50 },
]

<DataTable
  data={orders}
  columns={[
    { header: 'Order ID', accessor: (o) => o.id },
    { header: 'Customer', accessor: (o) => o.customer },
    { header: 'Amount', accessor: (o) => `$${o.amount}` },
  ]}
  getRowKey={(order) => order.id}
/>
```

## Design Tokens Quick Reference

### Colors
```tsx
// Background
bg-background          // #FAFAFA
bg-surface            // #FFFFFF
bg-gray-100           // #F5F5F5 (sidebar)

// Text (WCAG AA compliant)
text-gray-900         // Headings
text-gray-500         // Body text
text-gray-400         // Meta text

// Border
border-border         // #E5E5E5

// Brand
bg-primary-500        // #3B82F6
text-primary-600      // Active states
```

### Spacing
```tsx
mb-section            // 32px gap
mb-section-lg         // 40px gap
p-card-padding        // 28px padding
gap-4                 // 16px gap (grid/flex)
```

### Typography
```tsx
text-page-title       // 32px, semi-bold
text-section-title    // 24px, semi-bold
text-body            // 16px
text-meta            // 13px
text-meta-sm         // 12px
```

### Radius
```tsx
rounded-card         // 12px (cards)
rounded-control      // 8px (buttons, inputs)
```

### Shadows
```tsx
shadow-xs            // Subtle (tiles)
shadow-sm            // Larger (modals)
```

## Responsive Patterns

### Grid Layouts
```tsx
// 2 columns mobile, 4 columns desktop
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">

// 1 column mobile, 3 columns desktop
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
```

### Mobile/Desktop Visibility
```tsx
// Hidden on mobile, visible on desktop
<div className="hidden md:block">

// Visible on mobile, hidden on desktop
<div className="md:hidden">
```

## Accessibility Checklist

- [ ] Use semantic HTML (`<nav>`, `<main>`, `<article>`)
- [ ] Add `aria-label` to icon-only buttons
- [ ] Ensure ≥4.5:1 contrast for text
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Add `aria-live="polite"` for dynamic content
- [ ] Test with screen reader
- [ ] Run `pnpm lint` for a11y violations

## Common Patterns

### Section with Header
```tsx
<section className="mb-section-lg">
  <h2 className="text-section-title text-gray-900 mb-4">
    Section Title
  </h2>
  {/* Content */}
</section>
```

### Card Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <Card>
    <h3 className="text-section-title">Title</h3>
    <p className="text-body text-gray-500 mt-2">Description</p>
  </Card>
</div>
```

### Loading State
```tsx
<KPITile
  value={0}
  label="Revenue"
  isLoading={true}
/>
```

## Available Icons (Lucide)

Import from `lucide-react`:
- Navigation: `Home`, `Settings`, `Menu`, `X`
- Commerce: `ShoppingBag`, `CreditCard`, `DollarSign`
- Social: `Facebook`, `Instagram`, `Twitter`
- Communication: `Mail`, `MessageSquare`, `Bell`
- Data: `TrendingUp`, `TrendingDown`, `BarChart`, `PieChart`
- Actions: `Plus`, `Minus`, `Edit`, `Trash`, `Download`

See full list: https://lucide.dev/icons

## Run Accessibility Checks

```bash
# Lint for a11y violations
pnpm lint

# Build to check for TypeScript errors
pnpm build
```

## Next Steps

1. Review [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for complete documentation
2. Check [app/example/page.tsx](app/example/page.tsx) for full example
3. Customize colors in [tailwind.config.ts](tailwind.config.ts)
4. Add your data fetching logic
5. Deploy to Vercel

## Support

- Tailwind v3 docs: https://v3.tailwindcss.com
- Radix UI docs: https://radix-ui.com
- Recharts docs: https://recharts.org
- Lucide icons: https://lucide.dev
