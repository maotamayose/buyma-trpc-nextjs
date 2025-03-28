import { router } from './core';
import { productRouter } from './routers/searchProduct';
import { downloadImageRouter } from './routers/downloadImage';

export const appRouter = router({
  product: productRouter,
  downloadImage: downloadImageRouter,
});

export type AppRouter = typeof appRouter;
