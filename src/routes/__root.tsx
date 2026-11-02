import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportVibeError } from "../lib/vibe-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader, SiteFooter } from "@/components/klokk/site-chrome";
import { useEnsureSeeded } from "@/lib/klokk-hooks";
import { ChatWidget } from "@/components/klokk/chat-widget";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-6xl font-bold text-primary">404</p>
        <h2 className="mt-4 text-xl font-semibold text-foreground">This page isn't available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-95"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportVibeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-95"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Defaults for every page. The embed route overrides Content-Security-Policy so that
  // only the organiser's allowed sites can frame it.
  headers: ({ matches }) => ({
    // The embed page sets its own policy (allowed sites only), so do not send ours there.
    ...(matches.some((m) => (m.routeId as string) === "/embed/$token")
      ? {}
      : { "Content-Security-Policy": "frame-ancestors 'self'" }),
    "X-Content-Type-Options": "nosniff",
    // Event links carry a secret token in the address: never send it to other sites.
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#003524" },
      { title: "Klokk — Find a time that works for everyone" },
      {
        name: "description",
        content:
          "Klokk is premium scheduling software. Create an event, share a link, and let everyone vote on the best time — no accounts required for participants.",
      },
      { property: "og:title", content: "Klokk — Premium scheduling" },
      {
        property: "og:description",
        content:
          "Find a time that works for everyone — fast. Create a free event and let participants vote on availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DynaPuff:wght@400;500;600;700&family=Playwrite+VN:wght@100..400&family=Red+Hat+Display:ital,wght@0,300..900;1,300..900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const themeInitScript = `
    try {
      var stored = localStorage.getItem('klokk.theme');
      var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch (e) {}
  `;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEnsureSeeded();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  // No third-party chat widget on pages that carry secret tokens or run inside an embed.
  const showChat = !pathname.startsWith("/event/") && !pathname.startsWith("/embed/");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 bg-main-bg">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster position="bottom-right" richColors />
      {showChat && <ChatWidget />}
    </QueryClientProvider>
  );
}
