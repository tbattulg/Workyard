import { ClerkProvider } from '@clerk/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { appConfig } from './lib/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  const application = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

  if (!appConfig.clerkPublishableKey) {
    return application
  }

  return <ClerkProvider publishableKey={appConfig.clerkPublishableKey}>{application}</ClerkProvider>
}
