# Date Filtering Guide

Complete guide for implementing date range filtering across your dashboard using the advanced Date Range Picker component.

## Overview

The date filtering system provides:
- **Rolling periods** - Dynamic ranges that update with current time (e.g., "Last 90 days")
- **Fixed periods** - Static date ranges with calendar selection
- **Quick presets** - Today, Yesterday, Last 7/30/90 days, etc.
- **Comparison mode** - Compare against previous period automatically
- **Global state** - Share date range across all components via context
- **WCAG accessible** - Keyboard navigation, screen reader support

## Quick Start

### 1. Wrap Your App with DateFilterProvider

```tsx
// app/layout.tsx or page.tsx
import { DateFilterProvider } from '@/components'

export default function RootLayout({ children }) {
  return (
    <DateFilterProvider>
      {children}
    </DateFilterProvider>
  )
}
```

### 2. Add Analytics Header with Date Picker

```tsx
import { AnalyticsHeader } from '@/components'

export default function DashboardPage() {
  return (
    <div>
      <AnalyticsHeader title="Analytics" showRefreshTime />
      {/* Your content */}
    </div>
  )
}
```

### 3. Use Date Range in Components

```tsx
import { useDateFilter } from '@/components'

function MyComponent() {
  const { dateRange, comparisonEnabled, comparisonRange } = useDateFilter()

  // Filter your data
  const filteredData = data.filter(item =>
    isWithinInterval(item.date, {
      start: dateRange.from,
      end: dateRange.to
    })
  )

  return <YourVisualization data={filteredData} />
}
```

## Components

### DateRangePicker

Advanced date range picker with rolling/fixed modes.

```tsx
import { DateRangePicker } from '@/components'

<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  currencySymbol="$"
  showComparison
  comparisonEnabled={comparison}
  onComparisonChange={setComparison}
/>
```

**Props:**
- `value` - Current date range `{ from: Date, to: Date }`
- `onChange` - Callback when range changes
- `currencySymbol` - Currency symbol to display (default: '$')
- `showComparison` - Show comparison toggle button
- `comparisonEnabled` - Comparison state
- `onComparisonChange` - Callback when comparison changes

**Features:**

#### Rolling Period
Dynamic date ranges that update with current time:
- Last 30 minutes
- Last 12 hours
- Last 7/30/90/365 days
- Last 12 months
- Custom rolling period (specify number + unit)

#### Fixed Period
Static date ranges using calendar:
- Quick presets (Today, Yesterday, Last week, Last month)
- Dual calendar selection
- Include current period toggle

#### Comparison Mode
Automatically calculates previous period:
- If range is Jan 1-31, comparison is Dec 1-31
- Shows comparison data in charts and metrics
- Toggle on/off

### AnalyticsHeader

Pre-built header with date picker integration.

```tsx
import { AnalyticsHeader } from '@/components'

<AnalyticsHeader
  title="Analytics"
  showRefreshTime
/>
```

**Props:**
- `title` - Page title (default: 'Analytics')
- `showRefreshTime` - Show last refreshed timestamp
- `className` - Additional CSS classes

**Features:**
- Displays page title with icon
- Integrated date range picker
- Last refreshed timestamp
- Responsive layout

### DateFilterProvider

Context provider for global date filtering state.

```tsx
import { DateFilterProvider } from '@/components'

<DateFilterProvider
  initialRange={{ from: subDays(new Date(), 30), to: new Date() }}
  initialCurrency="USD"
>
  <App />
</DateFilterProvider>
```

**Props:**
- `initialRange` - Initial date range (default: Last 90 days)
- `initialCurrency` - Currency code (default: 'AUD')
- `children` - Child components

### useDateFilter Hook

Access date filter state from any component.

```tsx
import { useDateFilter } from '@/components'

function MyComponent() {
  const {
    dateRange,           // Current date range
    setDateRange,        // Update date range
    comparisonEnabled,   // Comparison toggle state
    setComparisonEnabled, // Update comparison
    comparisonRange,     // Comparison date range (auto-calculated)
    currency,            // Currency code
    setCurrency,         // Update currency
  } = useDateFilter()

  return (
    <div>
      {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
    </div>
  )
}
```

## Implementation Patterns

### Pattern 1: Filter Data by Date Range

```tsx
import { useDateFilter } from '@/components'
import { isWithinInterval } from 'date-fns'

function OrdersTable() {
  const { dateRange } = useDateFilter()

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt)
    return isWithinInterval(orderDate, {
      start: dateRange.from,
      end: dateRange.to
    })
  })

  return <DataTable data={filteredOrders} {...props} />
}
```

### Pattern 2: Calculate Metrics from Date Range

```tsx
import { useDateFilter } from '@/components'
import { eachDayOfInterval } from 'date-fns'

function RevenueChart() {
  const { dateRange } = useDateFilter()

  const chartData = React.useMemo(() => {
    const days = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to
    })

    return days.map(date => ({
      date: format(date, 'yyyy-MM-dd'),
      value: calculateRevenueForDay(date),
    }))
  }, [dateRange])

  return <TimeSeriesChart data={chartData} {...props} />
}
```

### Pattern 3: Show Comparison Data

```tsx
import { useDateFilter } from '@/components'

function RevenueMetrics() {
  const { dateRange, comparisonEnabled, comparisonRange } = useDateFilter()

  const currentRevenue = calculateRevenue(dateRange)
  const previousRevenue = comparisonEnabled && comparisonRange
    ? calculateRevenue(comparisonRange)
    : 0

  const delta = comparisonEnabled
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : undefined

  return (
    <KPITile
      value={currentRevenue}
      label="Revenue"
      delta={delta}
      format="currency"
    />
  )
}
```

### Pattern 4: Multiple Charts with Same Filter

```tsx
import { useDateFilter, TimeSeriesChart } from '@/components'

function Dashboard() {
  const { dateRange } = useDateFilter()

  const revenueData = generateChartData(dateRange, 'revenue')
  const ordersData = generateChartData(dateRange, 'orders')
  const visitorsData = generateChartData(dateRange, 'visitors')

  return (
    <div>
      <TimeSeriesChart data={revenueData} title="Revenue" />
      <TimeSeriesChart data={ordersData} title="Orders" />
      <TimeSeriesChart data={visitorsData} title="Visitors" />
    </div>
  )
}
```

## Complete Example

See [app/analytics/page.tsx](app/analytics/page.tsx) for a full implementation:

```tsx
'use client'

import {
  DateFilterProvider,
  useDateFilter,
  AnalyticsHeader,
  KPITile,
  TimeSeriesChart,
  DataTable,
} from '@/components'

function DashboardContent() {
  const { dateRange, comparisonEnabled } = useDateFilter()

  // Filter all data by date range
  const filteredData = filterByDateRange(data, dateRange)

  return (
    <>
      <AnalyticsHeader title="Dashboard" showRefreshTime />

      <KPITile value={calculateMetric(filteredData)} {...props} />

      <TimeSeriesChart data={generateChartData(filteredData)} {...props} />

      <DataTable data={filteredData} {...props} />
    </>
  )
}

export default function Page() {
  return (
    <DateFilterProvider>
      <DashboardContent />
    </DateFilterProvider>
  )
}
```

## Styling

The date picker matches your design system:
- Uses your color tokens (`primary-500`, `gray-*`)
- Consistent border radius (`rounded-card`, `rounded-control`)
- WCAG AA compliant contrast
- Hover and focus states
- Responsive layout

Custom CSS in [app/globals.css](app/globals.css):

```css
.rdp {
  --rdp-cell-size: 36px;
  --rdp-accent-color: #3b82f6;
  --rdp-background-color: #eff6ff;
}
```

## Accessibility

- **Keyboard navigation** - Tab, Enter, Escape, Arrow keys
- **Screen readers** - Proper ARIA labels and live regions
- **Focus management** - Visible focus indicators
- **Mobile support** - Touch-friendly targets (≥44px)

## Quick Reference

### Available Presets

- Today
- Yesterday
- Last 30 minutes
- Last 12 hours
- Last 7 days
- Last 30 days
- Last 90 days
- Last 365 days
- Last 12 months
- Last week
- Last month

### Date Utilities

```tsx
import {
  format,               // Format dates
  subDays,             // Subtract days
  isWithinInterval,    // Check if date in range
  eachDayOfInterval,   // Get all days in range
} from 'date-fns'
```

## Best Practices

1. **Always use useDateFilter hook** - Don't duplicate date state
2. **Memoize filtered data** - Use `React.useMemo` for performance
3. **Show date range in UI** - Let users know what they're viewing
4. **Handle empty states** - No data in selected range
5. **Loading states** - Show loading while fetching filtered data

## Examples

### Example 1: Simple Dashboard

```tsx
<DateFilterProvider>
  <AnalyticsHeader title="Dashboard" />
  <KPIMetrics />
  <Charts />
</DateFilterProvider>
```

### Example 2: Multi-Page App

```tsx
// app/layout.tsx
<DateFilterProvider>
  {children}
</DateFilterProvider>

// app/analytics/page.tsx
<AnalyticsHeader />
// All components automatically use global date range

// app/shopify/page.tsx
<AnalyticsHeader title="Shopify" />
// Same date range across all pages
```

### Example 3: Custom Date Picker

```tsx
import { DateRangePicker, useDateFilter } from '@/components'

function CustomHeader() {
  const { dateRange, setDateRange } = useDateFilter()

  return (
    <div className="flex items-center justify-between">
      <h1>My Dashboard</h1>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
    </div>
  )
}
```

## Troubleshooting

### Date picker not showing
- Ensure `DateFilterProvider` wraps your component
- Check for CSS conflicts with `.rdp` class

### Dates not filtering
- Use `useDateFilter` hook, don't create separate state
- Check date format matches your data
- Use `isWithinInterval` for accurate filtering

### Comparison not working
- Enable comparison via `onComparisonChange`
- Check `comparisonRange` is defined
- Comparison period is automatically calculated

## Next Steps

1. View live example: http://localhost:3000/analytics
2. Copy the pattern to your pages
3. Connect to real data sources
4. Customize presets for your use case

## Support

- Component source: [components/ui/date-range-picker.tsx](components/ui/date-range-picker.tsx)
- Context source: [contexts/date-filter-context.tsx](contexts/date-filter-context.tsx)
- Example implementation: [app/analytics/page.tsx](app/analytics/page.tsx)
