# Dashboard Design System

A minimal, accessible design system built with Tailwind CSS v3, shadcn/ui patterns, Radix UI primitives, and Recharts.

## Design Tokens

All design tokens are defined in [tailwind.config.ts](tailwind.config.ts).

### Colors

**Grayscale** (WCAG AA compliant, ≥4.5:1 contrast on white)
- `gray-50` (#FAFAFA) - Background
- `gray-100` (#F5F5F5) - Sidebar
- `gray-500` (#737373) - Body text (meets 4.5:1 on white)
- `gray-900` (#171717) - Headings

**Primary Brand**
- `primary-500` (#3B82F6) - Main brand color
- Full scale: 50-900

**Semantic**
- `background` (#FAFAFA)
- `surface` (#FFFFFF)
- `border` (#E5E5E5)

### Border Radius

- `rounded-card` - 12px for cards
- `rounded-control` - 8px for buttons, inputs, controls

### Shadows

- `shadow-xs` - Subtle elevation for tiles
- `shadow-sm` - Slightly larger for modals

### Spacing (8pt grid)

- `section` - 32px section gaps
- `section-lg` - 40px larger section gaps
- `card-padding` - 28px
- `card-padding-sm` - 20px

### Typography

Using **Inter** font family.

- `text-page-title` - 32px, semi-bold (page headings)
- `text-section-title` - 24px, semi-bold (section headings)
- `text-body` - 16px (body text)
- `text-meta` - 13px (metadata)
- `text-meta-sm` - 12px (small metadata)

### Layout

- `max-w-content` - 1200px max content width
- `w-sidebar-collapsed` - 56px (icon only)
- `w-sidebar-expanded` - 240px (icon + label)

## Components

### KPI Tile

Displays a single metric with optional delta indicator.

```tsx
import { KPITile } from '@/components/ui/kpi-tile'

<KPITile
  value={152430}
  label="Total Revenue"
  delta={12.5}
  format="currency"
  currency="USD"
/>
```

**Props:**
- `value` - Metric value
- `label` - Descriptive label
- `delta` - Change percentage (optional)
- `format` - 'number' | 'currency' | 'percent'
- `currency` - Currency code (default: 'USD')
- `isLoading` - Loading state

**Features:**
- WCAG AA contrast
- ARIA labels for screen readers
- Tabular numbers
- Delta with trend icons

### Time Series Chart

Displays time-series data with minimal styling.

```tsx
import { TimeSeriesChart } from '@/components/ui/time-series-chart'

<TimeSeriesChart
  data={[
    { date: '2024-01-01', value: 1200 },
    { date: '2024-01-02', value: 1350 },
  ]}
  type="area"
  title="Revenue (30 days)"
  valueFormatter={(v) => `$${v.toLocaleString()}`}
/>
```

**Props:**
- `data` - Array of `{ date: string, value: number }`
- `type` - 'line' | 'area'
- `title` - Chart title (optional)
- `height` - Chart height in px (default: 300)
- `color` - Line/area color
- `valueFormatter` - Format values in tooltip/axis
- `dateFormatter` - Format dates

**Features:**
- Thin lines (2px stroke)
- Muted grid (#E5E5E5)
- Compact tooltip
- Responsive container

### Sidebar

Desktop navigation (hidden on mobile).

```tsx
import { Sidebar } from '@/components/ui/sidebar'
import { Home, Settings } from 'lucide-react'

<Sidebar
  items={[
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ]}
  collapsed={false}
/>
```

**Features:**
- 56px collapsed (icons only)
- 240px expanded (icon + label)
- Active state highlighting
- Keyboard accessible
- Badge support

### Mobile Nav

Bottom tab bar for mobile devices.

```tsx
import { MobileNav } from '@/components/ui/mobile-nav'
import { Home, Settings } from 'lucide-react'

<MobileNav
  items={[
    { label: 'Home', icon: Home, href: '/' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ]}
/>
```

**Features:**
- Fixed to bottom on mobile
- Safe area padding
- Active state indication
- Icon + label

### Dashboard Layout

Wrapper component for consistent page layout.

```tsx
import { DashboardLayout } from '@/components/layout/dashboard-layout'

<DashboardLayout>
  <h1 className="text-page-title">Dashboard</h1>
  {/* Your content */}
</DashboardLayout>
```

### Card Components

Basic card primitives following shadcn/ui patterns.

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Tabs

Tab navigation using Radix UI primitives.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

## Layout Rules

### Desktop
- Background: `#FAFAFA`
- Surface cards: `#FFFFFF`
- Sidebar: `#F5F5F5` (56px collapsed, 240px expanded)
- Max content width: 1200px, centered
- No borders unless 1px subtle (`#E5E5E5`)
- Rely on elevation and spacing

### Mobile
- Bottom tab bar with 5 items max
- KPI tiles: 2 per row
- Horizontal scroll allowed for tiles
- Charts switch to single sparkline when width < 360px
- Tables collapse to stacked cards

## Accessibility

### WCAG AA Compliance

All text meets **4.5:1 contrast ratio**:
- Body text: `gray-500` (#737373) on white
- Headings: `gray-900` (#171717) on white

### Keyboard Navigation

- All interactive elements have visible focus states
- `focus-visible:ring-2 ring-primary-500`
- Tab order follows visual order

### Screen Readers

- Semantic HTML elements
- ARIA labels on icons and complex components
- `aria-current="page"` for active nav items
- `aria-live="polite"` for dynamic content

### Motion

Respects `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Linting

ESLint with `eslint-plugin-jsx-a11y` is configured in [.eslintrc.json](.eslintrc.json).

Run accessibility checks:
```bash
pnpm lint
```

## What to Avoid

- Multiple accent colors (stick to one primary)
- Heavy shadows or borders
- Mixed corner radii (use `rounded-card` and `rounded-control`)
- Overloaded tiles (one metric per tile)
- Icons in tight spaces (text is clearer)

## Utilities

Helper functions in [lib/utils.ts](lib/utils.ts):

- `cn()` - Merge Tailwind classes with proper precedence
- `formatNumber()` - Format with K/M/B suffixes
- `formatCurrency()` - Localized currency formatting
- `formatPercent()` - Percentage with +/- sign

## Example

See [app/example/page.tsx](app/example/page.tsx) for a complete dashboard implementation demonstrating all components and patterns.

## Quick Start

```tsx
import { DashboardLayout, KPITile, TimeSeriesChart } from '@/components'

export default function Page() {
  return (
    <DashboardLayout>
      <h1 className="text-page-title mb-section">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-section-lg">
        <KPITile value={45230} label="Revenue" delta={12.5} format="currency" />
        <KPITile value={320} label="Orders" delta={8.2} format="number" />
      </div>

      <TimeSeriesChart
        data={data}
        type="area"
        title="Revenue Trend"
        valueFormatter={(v) => `$${v.toLocaleString()}`}
      />
    </DashboardLayout>
  )
}
```
