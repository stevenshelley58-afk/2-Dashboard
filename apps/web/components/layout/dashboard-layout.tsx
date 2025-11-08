'use client'

import * as React from 'react'
import {
  Home,
  ShoppingBag,
  Facebook,
  Mail,
  Settings,
} from 'lucide-react'
import { Sidebar, SidebarItem } from '@/components/ui/sidebar'
import { MobileNav, MobileNavItem } from '@/components/ui/mobile-nav'

const defaultNavItems: SidebarItem[] = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Shopify', icon: ShoppingBag, href: '/shopify' },
  { label: 'Meta', icon: Facebook, href: '/meta' },
  { label: 'Klaviyo', icon: Mail, href: '/klaviyo' },
  { label: 'Settings', icon: Settings, href: '/settings' },
]

const defaultMobileNavItems: MobileNavItem[] = [
  { label: 'Home', icon: Home, href: '/' },
  { label: 'Shopify', icon: ShoppingBag, href: '/shopify' },
  { label: 'Meta', icon: Facebook, href: '/meta' },
  { label: 'Klaviyo', icon: Mail, href: '/klaviyo' },
  { label: 'Settings', icon: Settings, href: '/settings' },
]

export interface DashboardLayoutProps {
  /**
   * Child content
   */
  children: React.ReactNode
  /**
   * Sidebar navigation items
   */
  sidebarItems?: SidebarItem[]
  /**
   * Mobile navigation items
   */
  mobileNavItems?: MobileNavItem[]
  /**
   * Sidebar collapsed state
   */
  sidebarCollapsed?: boolean
}

/**
 * Dashboard Layout Component
 *
 * Provides a consistent layout with:
 * - Sidebar navigation (desktop)
 * - Bottom tab navigation (mobile)
 * - Centered content area (max 1200px)
 * - Background color (#FAFAFA)
 *
 * @example
 * <DashboardLayout>
 *   <YourPageContent />
 * </DashboardLayout>
 */
export function DashboardLayout({
  children,
  sidebarItems = defaultNavItems,
  mobileNavItems = defaultMobileNavItems,
  sidebarCollapsed = false,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - Desktop only */}
      <Sidebar items={sidebarItems} collapsed={sidebarCollapsed} />

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="max-w-content mx-auto p-6 md:p-8 pb-24 md:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Navigation - Mobile only */}
      <MobileNav items={mobileNavItems} />
    </div>
  )
}
