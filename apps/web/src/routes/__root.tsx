import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { z } from 'zod'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { SideNav } from '@/components/SideNav'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import TanStackQueryProvider from '../integrations/tanstack-query/root-provider'
import { useLocation } from '@tanstack/react-router'
import { Providers } from '../providers'
import { useServiceWorker } from '@/hooks/useServiceWorker'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  validateSearch: z.object({ tag: z.string().optional(), group: z.string().optional() }),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Vector Memo',
      },
      {
        name: 'description',
        content: 'セマンティック検索メモ帳アプリケーション',
      },
      {
        name: 'theme-color',
        content: '#000000',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Vector Memo',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      },
    ],
  }),
  shellComponent: RootDocument,
})

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  useServiceWorker()
  const location = useLocation()
  const isAuthPath = location.pathname === '/login'

  if (isAuthPath) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <SideNav />
      <SidebarInset>
        <Header />
        <div className="flex-1 px-4">
          {children}
        </div>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body
        className="font-sans antialiased [overflow-wrap:anywhere]"
        suppressHydrationWarning
      >
        <TanStackQueryProvider>
          <Providers>
            <AppLayout>{children}</AppLayout>
          </Providers>
          {import.meta.env.DEV && (
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
                TanStackQueryDevtools,
              ]}
            />
          )}
        </TanStackQueryProvider>
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
