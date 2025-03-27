/**
 * クライアントサイドのtRPC設定
 * フロントエンドからAPIを呼び出すための設定
 */

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/trpc';

/**
 * クライアント用のtRPCインスタンス
 * 型安全なAPI呼び出しを可能にする
 */
export const trpc = createTRPCReact<AppRouter>();
