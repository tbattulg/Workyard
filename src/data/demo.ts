import type { ActivityItem, CompanySummary, DashboardMetric } from '../../shared/domain'

export const demoCompanies: CompanySummary[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Lakefront Electric Co.',
    slug: 'lakefront-electric',
    description: 'Licensed residential and light-commercial electrical work across Chicago.',
    categories: ['Electrical', 'Lighting'],
    city: 'Chicago',
    state: 'IL',
    serviceRadiusMiles: 28,
    rating: 4.9,
    reviewCount: 86,
    verified: true,
    licenseNumber: 'ECC-10482',
    imageUrl: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Prairie & Stone Builders',
    slug: 'prairie-stone-builders',
    description: 'Remodeling, carpentry, and finish work for homes and neighborhood businesses.',
    categories: ['Remodeling', 'Carpentry'],
    city: 'Oak Park',
    state: 'IL',
    serviceRadiusMiles: 35,
    rating: 4.8,
    reviewCount: 54,
    verified: true,
    licenseNumber: 'GC-22391',
    imageUrl: null,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'North Loop Mechanical',
    slug: 'north-loop-mechanical',
    description: 'HVAC service, replacement, and preventative maintenance for Chicago properties.',
    categories: ['HVAC', 'Maintenance'],
    city: 'Evanston',
    state: 'IL',
    serviceRadiusMiles: 40,
    rating: 4.7,
    reviewCount: 39,
    verified: true,
    licenseNumber: 'HVAC-55307',
    imageUrl: null,
  },
]

export const buyerMetrics: DashboardMetric[] = [
  { label: 'Open requests', value: '3', hint: '1 response today' },
  { label: 'Active jobs', value: '2', hint: 'Both on schedule' },
  { label: 'Invoices', value: '$4,280', hint: '1 due this month' },
  { label: 'Saved companies', value: '7', hint: 'Across 4 trades' },
]

export const companyMetrics: DashboardMetric[] = [
  { label: 'New leads', value: '12', hint: 'Up 20% this week' },
  { label: 'Active jobs', value: '8', hint: '3 need updates' },
  { label: 'Awaiting invoice', value: '4', hint: '$18,650 estimated' },
  { label: 'Response rate', value: '92%', hint: 'Median 1h 18m' },
]

export const activity: ActivityItem[] = [
  {
    id: 'a1',
    title: 'Proposal received',
    detail: 'Lakefront Electric sent a proposal for panel replacement.',
    timestamp: 'Today, 10:24 AM',
    tone: 'success',
  },
  {
    id: 'a2',
    title: 'Job status updated',
    detail: 'Kitchen remodel moved to In progress.',
    timestamp: 'Yesterday, 4:16 PM',
    tone: 'neutral',
  },
  {
    id: 'a3',
    title: 'Invoice due soon',
    detail: 'Invoice INV-2026-0048 is due in five days.',
    timestamp: 'Jun 13, 2026',
    tone: 'warning',
  },
]
