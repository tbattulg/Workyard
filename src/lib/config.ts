export const appConfig = {
  name: import.meta.env.VITE_PUBLIC_APP_NAME || 'Workyard',
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:5173',
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
  pilotMarket: 'Chicago, IL',
} as const
