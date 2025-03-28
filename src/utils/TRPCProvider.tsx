"use client";

import { trpc } from "@/utils/trpc";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";

const queryClient = new QueryClient();

export function TRPCProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const trpcClient = trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: "/api/trpc",
      }),
    ],
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
