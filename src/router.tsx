import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import { routeTree } from "./routeTree.gen";

// Sentry — initialize once on the client. (TanStack Start has no main.tsx;
// router.tsx is the closest to the client bootstrap point.)
if (typeof window !== "undefined" && !(window as any).__sentryInited) {
  (window as any).__sentryInited = true;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
