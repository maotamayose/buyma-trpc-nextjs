import axios from "axios";
import puppeteer, { Page, Browser } from "puppeteer";

/** 画像情報 */
interface ImageInfo {
  src: string;
  width: string;
  height: string;
  alt?: string;
}

/**
 * ランダムな遅延を発生させる関数
 * @param min 最小ミリ秒
 * @param max 最大ミリ秒
 */
async function randomDelay(
  min: number = 500,
  max: number = 1500
): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * ページを自動スクロールする関数
 * @param page Puppeteer の Page インスタンス
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

/**
 * 動的スクレイピングを行い、画像URLを取得する汎用関数
 */
export async function dynamicScrape(url: string): Promise<string[]> {
  const imageUrls = new Set<string>();
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: false, // ヘッドレスモードを無効にして通常ブラウザに近づける
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--start-fullscreen",
      ],
    });
    const page: Page = await browser.newPage();
    await page.setViewport({
      width: 1920, // 画面幅（例）
      height: 1080, // 画面高さ（例）
    });
    // 一般的なUser-Agentを設定
    const USER_AGENT =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
    await page.setUserAgent(USER_AGENT);

    // navigator.webdriver を false に上書き
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await autoScroll(page);
    await randomDelay(1500, 2500);

    // DOM内の各種画像要素からURLを取得
    const urls: string[] = await page.evaluate(() => {
      const urls = new Set<string>();

      // <img> タグ
      document.querySelectorAll("img").forEach((img) => {
        const src =
          img.getAttribute("src") ||
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy");
        if (src) urls.add(src);
      });

      // <picture> タグ内の <source> 要素
      document.querySelectorAll("picture source").forEach((source) => {
        const srcset = source.getAttribute("srcset");
        if (srcset) {
          srcset.split(",").forEach((part) => {
            const token = part.trim().split(" ")[0];
            if (token) urls.add(token);
          });
        }
      });

      // og:image タグ
      document.querySelectorAll('meta[property="og:image"]').forEach((meta) => {
        const content = meta.getAttribute("content");
        if (content) urls.add(content);
      });

      // CSS の background-image
      document.querySelectorAll("*").forEach((el) => {
        const style = window.getComputedStyle(el);
        const bgImage = style.getPropertyValue("background-image");
        if (bgImage && bgImage !== "none") {
          const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
          if (match && match[1]) urls.add(match[1]);
        }
      });

      return Array.from(urls);
    });
    urls.forEach((u) => imageUrls.add(u));

    await browser.close();
  } catch (error) {
    console.error("動的スクレイピングエラー:", error);
    if (browser) {
      await browser.close();
    }
  }

  return Array.from(imageUrls);
}

/**
 * 画像URLの重複・類似フィルタリング
 * URLのクエリパラメータを除去したベースURLをキーにして、同一画像と思われるものは
 * 高解像度とみなされるURLを優先して残す
 */
function filterSimilarUrls(urls: string[]): string[] {
  const stripQuery = (url: string): string => url.split("?")[0];
  const map = new Map<string, string>();

  for (const url of urls) {
    const base = stripQuery(url);
    if (map.has(base)) {
      const existing = map.get(base)!;
      if (url.length > existing.length) {
        map.set(base, url);
      }
    } else {
      map.set(base, url);
    }
  }
  return Array.from(map.values());
}

/**
 * 画像URLの存在確認
 * 各URLに対して HTTP リクエストを発行し、Content-Type が image/ であれば有効と判断する
 */
async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      responseType: "arraybuffer",
      validateStatus: (status) => status < 400,
    });
    const contentType = response.headers["content-type"];
    return contentType && contentType.startsWith("image/");
  } catch (error) {
    return false;
  }
}

/**
 * 有効な画像URLのみを残すため、各URLの存在確認を実施する
 */
async function filterValidUrls(urls: string[]): Promise<string[]> {
  const validUrls: string[] = [];
  for (const url of urls) {
    if (await checkImageExists(url)) {
      validUrls.push(url);
    }
  }
  return validUrls;
}

/**
 * URLから画像を取得し、ImageInfo 型の配列として返す関数
 * ① 動的スクレイピングのみ
 * ② 取得したURLの重複・類似フィルタリング、③ 画像存在確認を行い、最終結果を整形して返す
 */
export async function getImagesFromUrl(url: string): Promise<ImageInfo[]> {
  const dynamicUrls = await dynamicScrape(url);
  console.log(`動的スクレイピングで ${dynamicUrls.length} 個取得`);

  const filteredUrls = filterSimilarUrls(dynamicUrls);
  console.log(`フィルタリング後: ${filteredUrls.length} 個の候補`);

  const validUrls = await filterValidUrls(filteredUrls);
  console.log(`有効な画像URL: ${validUrls.length} 個`);

  const images: ImageInfo[] = validUrls.map((src, index) => ({
    src,
    width: "640",
    height: "480",
    alt: `Image ${index + 1}`,
  }));

  return images;
}
