'use client'

import {
  Home,
  ShoppingBag,
  Facebook,
  Mail,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { KPITile } from '@/components/ui/kpi-tile'
import { TimeSeriesChart } from '@/components/ui/time-series-chart'
import { Sidebar, SidebarItem } from '@/components/ui/sidebar'
import { MobileNav, MobileNavItem } from '@/components/ui/mobile-nav'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

// Sample data
const sidebarItems: SidebarItem[] = [
  { label: 'Home', icon: Home, href: '/example' },
  { label: 'Shopify', icon: ShoppingBag, href: '/example/shopify' },
  { label: 'Meta', icon: Facebook, href: '/example/meta' },
  { label: 'Klaviyo', icon: Mail, href: '/example/klaviyo' },
  { label: 'Settings', icon: Settings, href: '/example/settings' },
]

const mobileNavItems: MobileNavItem[] = [
  { label: 'Home', icon: Home, href: '/example' },
  { label: 'Shopify', icon: ShoppingBag, href: '/example/shopify' },
  { label: 'Meta', icon: Facebook, href: '/example/meta' },
  { label: 'Klaviyo', icon: Mail, href: '/example/klaviyo' },
  { label: 'Settings', icon: Settings, href: '/example/settings' },
]

// Generate sample time series data (30 days)
const generateTimeSeriesData = (baseValue: number, variance: number) => {
  const data = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    const randomVariance = (Math.random() - 0.5) * variance
    const value = Math.max(0, baseValue + randomVariance)

    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value),
    })
  }

  return data
}

const revenueData = generateTimeSeriesData(45000, 10000)
const ordersData = generateTimeSeriesData(320, 50)
const visitorsData = generateTimeSeriesData(12000, 3000)

/**
 * Example Dashboard Page
 *
 * Demonstrates the complete design system:
 * - KPI tiles (2 per row on mobile)
 * - Time series charts
 * - Responsive sidebar
 * - Mobile bottom navigation
 * - Tabs for data switching
 * - WCAG AA compliant
 */
export default function ExamplePage() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Desktop only */}
      <Sidebar items={sidebarItems} collapsed={false} />

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-content mx-auto p-6 md:p-8 pb-24 md:pb-8">
          {/* Page header */}
          <div className="mb-section-lg">
            <h1 className="text-page-title text-gray-900">Dashboard</h1>
            <p className="text-body text-gray-500 mt-2">
              Overview of your key metrics and performance
            </p>
          </div>

          <Separator className="mb-section-lg" />

          {/* KPI Tiles Grid */}
          <section className="mb-section-lg">
            <h2 className="text-section-title text-gray-900 mb-4">
              Key Metrics
            </h2>

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
              <KPITile
                value={342500}
                label="Website Visitors"
                delta={-3.1}
                format="number"
              />
              <KPITile
                value={4.45}
                label="Conversion Rate"
                delta={0.8}
                format="percent"
              />
            </div>
          </section>

          {/* Charts Section with Tabs */}
          <section className="mb-section-lg">
            <h2 className="text-section-title text-gray-900 mb-4">
              30-Day Trends
            </h2>

            <Tabs defaultValue="revenue" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="visitors">Visitors</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue">
                <TimeSeriesChart
                  data={revenueData}
                  type="area"
                  title="Revenue (Last 30 Days)"
                  valueFormatter={(value) => `$${value.toLocaleString()}`}
                  height={320}
                />
              </TabsContent>

              <TabsContent value="orders">
                <TimeSeriesChart
                  data={ordersData}
                  type="line"
                  title="Orders (Last 30 Days)"
                  valueFormatter={(value) => value.toLocaleString()}
                  height={320}
                  color="#10B981"
                />
              </TabsContent>

              <TabsContent value="visitors">
                <TimeSeriesChart
                  data={visitorsData}
                  type="area"
                  title="Website Visitors (Last 30 Days)"
                  valueFormatter={(value) => value.toLocaleString()}
                  height={320}
                  color="#8B5CF6"
                />
              </TabsContent>
            </Tabs>
          </section>

          {/* Additional KPIs - Channel Performance */}
          <section>
            <h2 className="text-section-title text-gray-900 mb-4">
              Channel Performance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPITile
                value={52340}
                label="Shopify Revenue"
                delta={15.2}
                format="currency"
              />
              <KPITile
                value={38920}
                label="Meta Ad Spend"
                delta={-2.4}
                format="currency"
              />
              <KPITile
                value={2.47}
                label="ROAS"
                delta={18.5}
                format="number"
              />
            </div>
          </section>
        </div>
      </main>

      {/* Mobile Navigation - Mobile only */}
      <MobileNav items={mobileNavItems} />
    </div>
  )
}
