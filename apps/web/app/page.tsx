'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Order {
  id: string
  shop_id: string
  order_number: string
  total_price: number
  currency: string
  created_at: string
}

interface ETLRun {
  id: string
  shop_id: string
  status: string
  job_type: string
  platform: string
  records_synced: number | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([])
  const [jobs, setJobs] = useState<ETLRun[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  })

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      // Fetch orders from public view
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (ordersError) throw ordersError

      // Fetch recent jobs from public view
      const { data: jobsData, error: jobsError } = await supabase
        .from('etl_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (jobsError) throw jobsError

      setOrders(ordersData || [])
      setJobs(jobsData || [])

      // Calculate stats
      if (ordersData && ordersData.length > 0) {
        const total = ordersData.reduce((sum, order) => sum + Number(order.total_price), 0)
        setStats({
          totalOrders: ordersData.length,
          totalRevenue: total,
          avgOrderValue: total / ordersData.length,
        })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function triggerSync() {
    setSyncing(true)
    try {
      const { data, error } = await supabase
        .rpc('trigger_sync', {
          p_shop_id: 'sh_test',
          p_job_type: 'INCREMENTAL',
          p_platform: 'SHOPIFY',
        })

      if (error) throw error

      alert('Sync job queued successfully!')
      await fetchData()
    } catch (error) {
      console.error('Error triggering sync:', error)
      alert('Failed to trigger sync')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">E-commerce Dashboard</h1>
        <p className="text-gray-600">Real-time analytics for your Shopify store</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Orders</div>
          <div className="text-3xl font-bold">{stats.totalOrders.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Avg Order Value</div>
          <div className="text-3xl font-bold">${stats.avgOrderValue.toFixed(2)}</div>
        </div>
      </div>

      {/* Sync Button */}
      <div className="mb-8">
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? 'Syncing...' : 'Trigger Sync'}
        </button>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Recent Sync Jobs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        job.status === 'SUCCEEDED'
                          ? 'bg-green-100 text-green-800'
                          : job.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : job.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.platform}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.job_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.records_synced || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.slice(0, 20).map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{order.order_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">${order.total_price}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{order.currency}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
