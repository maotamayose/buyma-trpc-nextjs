import { router } from './core';
import { productRouter } from './routers/productSercive';

export const appRouter = router({
  product: productRouter,
});

export type AppRouter = typeof appRouter;
