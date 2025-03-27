import { publicProcedure, router } from '../core';
import { z } from 'zod';
import { getImagesFromUrl } from '../../services/downloadImages/imageService';

export const downloadImageRouter = router({
  getImages: publicProcedure
    .input(z.object({
      url: z.string().url('無効なURLです')
      // ドメイン制限を撤廃し、有効なURLであれば任意のドメインを受け付ける
    }))
    .query(async ({ input }) => {
      try {
        console.log('画像取得リクエスト:', input.url);
        const images = await getImagesFromUrl(input.url);
        console.log('取得した画像数:', images.length);
        return { images };
      } catch (error) {
        console.error('画像取得エラー:', error);
        throw new Error('画像の取得に失敗しました');
      }
    }),
}); 