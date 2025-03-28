import axios from "axios";
import { env } from "@/env";

// 環境変数の検証を担当する関数
function validateEnvironmentVariables() {
  if (!env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY環境変数が設定されていません");
  }
  if (!env.GOOGLE_CSE_ID) {
    throw new Error("GOOGLE_CSE_ID環境変数が設定されていません"); 
  }
}

// Google Search API の設定
const CONFIG = {
  API_KEY: env.GOOGLE_API_KEY,
  CX: env.GOOGLE_CSE_ID,
  BASE_URL: "https://www.googleapis.com/customsearch/v1"
} as const;

// APIレスポンスの型定義
interface GoogleSearchItem {
  link: string;
  title: string;
  snippet: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
}

// レート制限対策のための設定
const RATE_LIMIT_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1秒
  RATE_LIMIT_DELAY: 60000, // 1分
} as const;

// Google Search APIクライアントクラス
class GoogleSearchClient {
  private lastRequestTime: number = 0;

  constructor() {
    validateEnvironmentVariables();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async ensureRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT_CONFIG.RETRY_DELAY) {
      await this.delay(RATE_LIMIT_CONFIG.RETRY_DELAY - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }

  private async search(query: string, retryCount: number = 0): Promise<GoogleSearchResponse> {
    try {
      await this.ensureRateLimit();
      
      const response = await axios.get<GoogleSearchResponse>(CONFIG.BASE_URL, {
        params: {
          key: CONFIG.API_KEY,
          cx: CONFIG.CX,
          q: query
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429 && retryCount < RATE_LIMIT_CONFIG.MAX_RETRIES) {
          console.log(`レート制限に達しました。${RATE_LIMIT_CONFIG.RATE_LIMIT_DELAY}ms待機します...`);
          await this.delay(RATE_LIMIT_CONFIG.RATE_LIMIT_DELAY);
          return this.search(query, retryCount + 1);
        }
        throw new Error(`Google検索APIでエラーが発生しました: ${error.message}`);
      }
      throw error;
    }
  }

  async searchOfficialSite(brand: string): Promise<string | null> {
    const query = `${brand} 公式サイト`;
    const result = await this.search(query);
    
    const items = result.items || [];
    for (const item of items) {
      const link: string = item.link;
      if (link.includes(brand.toLowerCase())) {
        return new URL(link).origin;
      }
    }
    return null;
  }

  async searchProductInOfficialSite(siteUrl: string, keyword: string): Promise<string[]> {
    const query = `site:${siteUrl} inurl:${keyword}`;
    const queryAdd = `site:${siteUrl} ${keyword}`;
    let result = await this.search(query);
    const additionalResult = await this.search(queryAdd);
    result.items = [...(result.items || []), ...(additionalResult.items || [])];
    return (result.items || [])
      .slice(0, 5)
      .map(item => item.link);
  }
}

// シングルトンインスタンスをエクスポート
const googleSearchClient = new GoogleSearchClient();

export const searchOfficialSite = (brand: string) => 
  googleSearchClient.searchOfficialSite(brand);

export const searchProductInOfficialSite = (siteUrl: string, keyword: string) =>
  googleSearchClient.searchProductInOfficialSite(siteUrl, keyword); 