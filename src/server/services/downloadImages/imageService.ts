import axios from "axios";

/** 画像情報 */
interface ImageInfo {
  src: string;
  width: string;
  height: string;
  alt?: string;
}

/**
 * 動的スクレイピング：Puppeteerでレンダリング後のHTMLから、上記と同様に画像URLを抽出する
 */
async function dynamicScrape(url: string): Promise<string[]> {
  const imageUrls = new Set<string>();
  try {
    const puppeteer = await import("puppeteer");

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // 画像リソースのabortはコメントアウトまたは削除して、画像読み込みを許可する
    // await page.setRequestInterception(true);
    // page.on('request', (request) => {
    //   if (request.resourceType() === 'image' || request.resourceType() === 'media') {
    //     request.abort();
    //   } else {
    //     request.continue();
    //   }
    // });

    // ページ全体の読み込みを待つ
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // 自動スクロールでlazy loadingされた画像を読み込む
    await autoScroll(page);

    const dynamicUrls: string[] = await page.evaluate(() => {
      const urls = new Set<string>();

      // <img> タグのsrc, data-src, data-lazy属性を取得
      document.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy");
        if (src) urls.add(src);
      });

      // <picture> 内の <source> タグのsrcset属性を取得
      document.querySelectorAll("picture source").forEach((source) => {
        const srcset = source.getAttribute("srcset");
        if (srcset) {
          srcset.split(",").forEach((part) => {
            const token = part.trim().split(" ")[0];
            if (token) urls.add(token);
          });
        }
      });

      // <meta property="og:image"> タグ
      document.querySelectorAll('meta[property="og:image"]').forEach((meta) => {
        const content = meta.getAttribute("content");
        if (content) urls.add(content);
      });

      // CSSのbackground-imageとして設定されている画像も取得
      document.querySelectorAll("*").forEach((el) => {
        const style = window.getComputedStyle(el);
        const bgImage = style.getPropertyValue("background-image");
        if (bgImage && bgImage !== "none") {
          const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
          if (match && match[1]) {
            urls.add(match[1]);
          }
        }
      });

      return Array.from(urls);
    });

    dynamicUrls.forEach((u) => imageUrls.add(u));
    await browser.close();
  } catch (error) {
    console.error("動的スクレイピングエラー:", error);
  }
  return Array.from(imageUrls);
}

// 自動スクロールのヘルパー関数
async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
/**
 * 画像URLの重複・類似フィルタリング
 * クエリパラメータを除去したベースURLをキーにして、同一の画像と思われるものは高解像度と思われるURLを優先して残す
 */
function filterSimilarUrls(urls: string[]): string[] {
  const stripQuery = (url: string): string => url.split("?")[0];
  const map = new Map<string, string>();

  for (const url of urls) {
    const base = stripQuery(url);
    // 既に同じベースURLがある場合、文字数が長いほう（＝追加情報がある＝高解像度の可能性がある）を採用
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
 * URLから画像を取得し、ImageInfo 型の配列として返す
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