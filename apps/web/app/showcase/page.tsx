'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  KPITile,
  TimeSeriesChart,
  Sparkline,
  DataTable,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import { Home } from 'lucide-react'

// Sample data
const chartData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0],
  value: Math.floor(Math.random() * 5000) + 10000,
}))

const sparklineData = [10, 12, 8, 15, 20, 18, 22, 19, 25, 23]

interface SampleOrder {
  id: string
  customer: string
  amount: number
}

const sampleOrders: SampleOrder[] = [
  { id: '#001', customer: 'John Doe', amount: 129.99 },
  { id: '#002', customer: 'Jane Smith', amount: 249.5 },
  { id: '#003', customer: 'Bob Johnson', amount: 89.99 },
]

/**
 * Component Showcase Page
 *
 * Visual reference for all design system components
 */
export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-content mx-auto space-y-section-lg">
        {/* Header */}
        <div>
          <h1 className="text-page-title text-gray-900">
            Component Showcase
          </h1>
          <p className="text-body text-gray-500 mt-2">
            Visual reference for all design system components
          </p>
        </div>

        <Separator />

        {/* Typography */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">
            Typography
          </h2>
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-meta text-gray-500 mb-1">Page Title</p>
                <h1 className="text-page-title text-gray-900">
                  The quick brown fox
                </h1>
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-1">Section Title</p>
                <h2 className="text-section-title text-gray-900">
                  The quick brown fox
                </h2>
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-1">Body Text</p>
                <p className="text-body text-gray-900">
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-1">Meta Text</p>
                <p className="text-meta text-gray-500">
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-1">Meta Small</p>
                <p className="text-meta-sm text-gray-500">
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Colors */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">Colors</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <div className="w-full h-16 bg-gray-50 rounded-control mb-2" />
              <p className="text-meta text-gray-900 font-medium">
                gray-50
              </p>
              <p className="text-meta-sm text-gray-500">#FAFAFA</p>
            </Card>
            <Card>
              <div className="w-full h-16 bg-gray-100 rounded-control mb-2" />
              <p className="text-meta text-gray-900 font-medium">
                gray-100
              </p>
              <p className="text-meta-sm text-gray-500">#F5F5F5</p>
            </Card>
            <Card>
              <div className="w-full h-16 bg-gray-500 rounded-control mb-2" />
              <p className="text-meta text-gray-900 font-medium">
                gray-500
              </p>
              <p className="text-meta-sm text-gray-500">#737373</p>
            </Card>
            <Card>
              <div className="w-full h-16 bg-gray-900 rounded-control mb-2" />
              <p className="text-meta text-gray-900 font-medium">
                gray-900
              </p>
              <p className="text-meta-sm text-gray-500">#171717</p>
            </Card>
            <Card>
              <div className="w-full h-16 bg-primary-500 rounded-control mb-2" />
              <p className="text-meta text-gray-900 font-medium">
                primary-500
              </p>
              <p className="text-meta-sm text-gray-500">#3B82F6</p>
            </Card>
          </div>
        </section>

        {/* KPI Tiles */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">KPI Tiles</h2>
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

        {/* Charts */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">Charts</h2>

          <Tabs defaultValue="area" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="area">Area Chart</TabsTrigger>
              <TabsTrigger value="line">Line Chart</TabsTrigger>
              <TabsTrigger value="sparkline">Sparkline</TabsTrigger>
            </TabsList>

            <TabsContent value="area">
              <TimeSeriesChart
                data={chartData}
                type="area"
                title="Revenue (Last 30 Days)"
                valueFormatter={(v) => `$${v.toLocaleString()}`}
                height={300}
              />
            </TabsContent>

            <TabsContent value="line">
              <TimeSeriesChart
                data={chartData}
                type="line"
                title="Orders (Last 30 Days)"
                valueFormatter={(v) => v.toLocaleString()}
                height={300}
                color="#10B981"
              />
            </TabsContent>

            <TabsContent value="sparkline">
              <Card>
                <h3 className="text-section-title mb-4">Sparklines</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-body font-medium">Revenue Trend</p>
                      <p className="text-meta text-gray-500">Last 10 days</p>
                    </div>
                    <Sparkline data={sparklineData} height={40} width={120} />
                  </div>
                  <Separator />
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-body font-medium">Order Volume</p>
                      <p className="text-meta text-gray-500">Last 10 days</p>
                    </div>
                    <Sparkline
                      data={sparklineData.reverse()}
                      height={40}
                      width={120}
                      color="#10B981"
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* Data Table */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">
            Data Table
          </h2>
          <DataTable
            data={sampleOrders}
            columns={[
              { header: 'Order ID', accessor: (o) => o.id },
              { header: 'Customer', accessor: (o) => o.customer },
              {
                header: 'Amount',
                accessor: (o) => `$${o.amount.toFixed(2)}`,
              },
            ]}
            getRowKey={(order) => order.id}
          />
        </section>

        {/* Cards */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>
                  This is a card description
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-body text-gray-500">
                  Card content goes here.
                </p>
              </CardContent>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-100 rounded-control">
                  <Home className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-body font-semibold text-gray-900">
                    Icon Card
                  </p>
                  <p className="text-meta text-gray-500">With icon accent</p>
                </div>
              </div>
            </Card>

            <Card className="bg-primary-50 border-primary-200">
              <p className="text-body font-semibold text-primary-900">
                Highlighted Card
              </p>
              <p className="text-meta text-primary-700 mt-1">
                With custom background
              </p>
            </Card>
          </div>
        </section>

        {/* Spacing & Layout */}
        <section>
          <h2 className="text-section-title text-gray-900 mb-4">
            Spacing & Borders
          </h2>
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-meta text-gray-500 mb-2">
                  Border Radius - Card (12px)
                </p>
                <div className="w-24 h-24 bg-primary-500 rounded-card" />
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-2">
                  Border Radius - Control (8px)
                </p>
                <div className="w-24 h-24 bg-primary-500 rounded-control" />
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-2">Shadow - XS</p>
                <div className="w-24 h-24 bg-surface shadow-xs" />
              </div>
              <div>
                <p className="text-meta text-gray-500 mb-2">Shadow - SM</p>
                <div className="w-24 h-24 bg-surface shadow-sm" />
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}
