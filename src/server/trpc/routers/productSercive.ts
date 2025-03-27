import { publicProcedure, router } from "../core";
import { z } from "zod";
import { getProductResults } from "@/server/services/productSearch/productService";

export const productRouter = router({
  search: publicProcedure
    .input(
      z.object({
        brand: z.string(),
        keyword: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await getProductResults(input.brand, input.keyword);
    }),
});
