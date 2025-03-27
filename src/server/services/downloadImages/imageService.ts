import axios from 'axios';
import * as cheerio from 'cheerio';

// 型定義
type CheerioAPI = ReturnType<typeof cheerio.load>;

interface ImageInfo {
  src: string;
  width: string;
  height: string;
  alt?: string;
}

/**
 * サポートされているブランド
 */
enum SupportedBrand {
  ASICS = 'asics',
  BOTTEGA_VENETA = 'bottegaveneta',
  UNKNOWN = 'unknown'
}

/**
 * URLからブランドを判別する
 */
function detectBrand(url: string): SupportedBrand {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('asics.com') || lowerUrl.includes('asics/')) {
    return SupportedBrand.ASICS;
  }
  
  if (lowerUrl.includes('bottegaveneta.com') || lowerUrl.includes('bottegaveneta/')) {
    return SupportedBrand.BOTTEGA_VENETA;
  }
  
  return SupportedBrand.UNKNOWN;
}

/**
 * 商品ページのURLから商品コードを抽出する
 * 例: https://www.asics.com/us/en-us/gel-venture-6-shield/p/ANA_1203A474-002.html
 *     → 1203A474_002
 */
function extractProductCode(url: string): string | null {
  const brand = detectBrand(url);
  
  switch (brand) {
    case SupportedBrand.ASICS:
      return extractAsicsProductCode(url);
    case SupportedBrand.BOTTEGA_VENETA:
      return extractBottegaVenetaProductCode(url);
    default:
      // 汎用的な抽出を試みる
      return extractGenericProductCode(url);
  }
}

/**
 * ASICSのURLから商品コードを抽出する
 */
function extractAsicsProductCode(url: string): string | null {
  // パターン1: /p/ANA_1203A474-002.html
  let match = url.match(/\/p\/(?:ANA_)?([0-9A-Z]+)(?:-([0-9A-Z]+))?\.html/i);
  if (match) {
    // 1203A474-002 → 1203A474_002
    return (match[1] + (match[2] ? "_" + match[2] : "")).replace(/-/g, '_');
  }
  
  // パターン2: /p/1203A474-002.html
  match = url.match(/\/p\/([0-9A-Z]+)(?:-([0-9A-Z]+))?\.html/i);
  if (match) {
    return (match[1] + (match[2] ? "_" + match[2] : "")).replace(/-/g, '_');
  }
  
  // パターン3: 1203A474-002 が含まれている場合
  match = url.match(/([0-9]{4}[A-Z]{1,2}[0-9]{3})(?:-| |_)([0-9A-Z]{3})/i);
  if (match) {
    return `${match[1]}_${match[2]}`;
  }
  
  return null;
}

/**
 * Bottega Venetaの商品コードを抽出する
 */
function extractBottegaVenetaProductCode(url: string): string | null {
  // パターン1: /product-detail/xxx-yyy.html
  let match = url.match(/\/product-detail\/([a-zA-Z0-9-]+)\.html/i);
  if (match) {
    return match[1];
  }
  
  // パターン2: パラメータに商品コードがある場合
  match = url.match(/[?&]code=([a-zA-Z0-9-]+)/i);
  if (match) {
    return match[1];
  }
  
  // パターン3: 商品ID形式 (数字とアルファベットの組み合わせ)
  match = url.match(/([A-Z0-9]{6,})(?:-([A-Z0-9]{3,}))?/i);
  if (match) {
    return match[1] + (match[2] ? `_${match[2]}` : '');
  }
  
  return null;
}

/**
 * 汎用的な商品コード抽出を試みる
 */
function extractGenericProductCode(url: string): string | null {
  // さまざまな一般的なパターンを試す
  
  // パターン1: /p/CODE.html または /products/CODE.html
  let match = url.match(/\/(p|products|product)\/([a-zA-Z0-9-_]+)(?:\.html)?/i);
  if (match) {
    return match[2].replace(/-/g, '_');
  }
  
  // パターン2: productId または product_id パラメータ
  match = url.match(/[?&](product_?id)=([a-zA-Z0-9-_]+)/i);
  if (match) {
    return match[2].replace(/-/g, '_');
  }
  
  // パターン3: SKU または sku パラメータ
  match = url.match(/[?&](sku)=([a-zA-Z0-9-_]+)/i);
  if (match) {
    return match[2].replace(/-/g, '_');
  }
  
  // 他のパターン
  // ...
  
  return null;
}

/**
 * 商品コードからブランドに応じた画像URLを生成する
 */
function generateImageUrls(productCode: string, brand: SupportedBrand): string[] {
  switch (brand) {
    case SupportedBrand.ASICS:
      return generateAsicsImageUrls(productCode);
    case SupportedBrand.BOTTEGA_VENETA:
      return generateBottegaVenetaImageUrls(productCode);
    default:
      return generateGenericBrandImageUrls(productCode);
  }
}

/**
 * 商品コードから画像URLを生成する
 * 例: 1203A474_002 → https://images.asics.com/is/image/asics/1203A474_002_SR_RT_GLB?$zoom$
 */
function generateAsicsImageUrls(productCode: string): string[] {
  const baseUrl = "https://images.asics.com/is/image/asics/";
  
  // 基本的なビューパターン
  const basicViews = [
    "_SR_RT_GLB", // 右側面
    "_SR_LT_GLB", // 左側面
    "_SR_FR_GLB", // 正面
    "_SR_BK_GLB", // 背面
    "_SB_FL_GLB", // 靴底（フル）
    "_SB_BT_GLB", // 靴底（底部）
    "_SB_TP_GLB", // 靴底（上部）
    "_SB_FR_GLB", // 靴底（前部）
    "_SB_BK_GLB", // 靴底（後部）
    "_FL_RT_GLB", // 全体（右側面）
    "_FL_LT_GLB", // 全体（左側面）
    "_FL_FR_GLB", // 全体（正面）
    "_FL_BK_GLB", // 全体（背面）
    ""            // コードのみ
  ];
  
  // 詳細なビューパターン
  const detailedViews = [
    "_SR_RT",     // 右側面（ローカル）
    "_SR_LT",     // 左側面（ローカル）
    "_SR_FR",     // 正面（ローカル）
    "_SR_BK",     // 背面（ローカル）
    "_SB_FL",     // 靴底（ローカル）
    "_SB_BT",     // 靴底底部（ローカル）
    "_SB_TP",     // 靴底上部（ローカル）
    "_SB_FR",     // 靴底前部（ローカル）
    "_SB_BK",     // 靴底後部（ローカル）
    "_SB_RT",     // 靴底右側
    "_SB_LT",     // 靴底左側
    "_TP_RT",     // 上部右側
    "_TP_LT",     // 上部左側
    "_TP_FR",     // 上部正面
    "_TP_BK",     // 上部背面
    "_IN_RT",     // 内側右
    "_IN_LT",     // 内側左
    "_DT_RT",     // 詳細右
    "_DT_LT",     // 詳細左
    "_DT_FR",     // 詳細正面
    "_PT_1",      // パーツ詳細1
    "_PT_2",      // パーツ詳細2
    "_PT_3",      // パーツ詳細3
    "_PT_4",      // パーツ詳細4
    "_CL_1",      // クローズアップ1
    "_CL_2",      // クローズアップ2
    "_WR_1",      // 着用イメージ1
    "_WR_2",      // 着用イメージ2
    "_PR_RT",     // プロダクト右
    "_PR_LT",     // プロダクト左
    "_PR_FR",     // プロダクト正面
    "_PR_BK",     // プロダクト背面
    "_1",         // バリエーション1
    "_2",         // バリエーション2
    "_3",         // バリエーション3
    "_4",         // バリエーション4
    "_5"          // バリエーション5
  ];
  
  // 地域識別子
  const regionSuffixes = [
    "_GLB",  // グローバル
    "_US",   // アメリカ
    "_EU",   // ヨーロッパ
    "_JP",   // 日本
    "_AP",   // アジアパシフィック
    "",      // なし
  ];
  
  // 画質パラメータ
  const formats = [
    "?$zoom$",                  // 高解像度
    "?$sfcc-product$",          // 通常解像度
    "?$sfcc-product-900x900$",  // 900x900
    "?$sfcc-product-600x600$",  // 600x600
    "?$sfcc-product-300x300$",  // 300x300
    "?$sfcc-pdp-main$",         // PDP メイン
    "?$sfcc-pdp-zoom$",         // PDP ズーム
    "?$productc$",              // プロダクトC
    "?$large$",                 // 大サイズ
    "?$medium$",                // 中サイズ
    "?$small$",                 // 小サイズ
    ""                          // パラメータなし
  ];
  
  const urls: string[] = [];
  
  // 商品コードバリエーション
  const productCodeVariations = [
    productCode,
    productCode.replace(/_/g, '-')  // アンダースコアをハイフンに変換
  ];
  
  // 1. 基本ビューの組み合わせ
  for (const code of productCodeVariations) {
    for (const view of basicViews) {
      for (const format of formats) {
        urls.push(`${baseUrl}${code}${view}${format}`);
      }
    }
  }
  
  // 2. 詳細ビューと地域の組み合わせ
  for (const code of productCodeVariations) {
    for (const view of detailedViews) {
      for (const region of regionSuffixes) {
        for (const format of formats.slice(0, 3)) { // 主要なフォーマットのみ
          urls.push(`${baseUrl}${code}${view}${region}${format}`);
        }
      }
    }
  }
  
  // 3. ASICSのその他の命名パターン
  urls.push(`${baseUrl}${productCode}_SR_RT_GLB?width=600&height=600&fmt=jpeg`);
  urls.push(`${baseUrl}${productCode}_SR_RT_GLB?width=900&height=900&fmt=jpeg`);
  urls.push(`${baseUrl}${productCode}_SR_RT_GLB?width=1200&height=1200&fmt=jpeg`);
  urls.push(`${baseUrl}${productCode}_SR_RT_GLB?width=1800&height=1800&fmt=jpeg`);
  
  // 4. ASICSの特別コレクションパターン
  const collections = ["RUNNING", "SPORTSTYLE", "PERFORMANCE", "TIGER", "ONITSUKA"];
  for (const collection of collections) {
    urls.push(`${baseUrl}${productCode}_${collection}_RT${formats[0]}`);
    urls.push(`${baseUrl}${productCode}_${collection}_FR${formats[0]}`);
  }
  
  // 重複を排除
  const uniqueUrls = Array.from(new Set(urls));
  console.log(`生成されたURL: ${uniqueUrls.length}個`);
  
  return uniqueUrls;
}

/**
 * Bottega Venetaの商品コードから画像URLを生成する
 */
function generateBottegaVenetaImageUrls(productCode: string): string[] {
  // 複数のCDNドメイン
  const baseUrls = [
    "https://www.bottegaveneta.com/dw/image/v2/BFMR_PRD/on/demandware.static/-/Sites-master-catalog/default/",
    "https://media.bottegaveneta.com/content/dam/bottegaveneta/",
    "https://image.bottegaveneta.com/product/",
    "https://production-na01-bottegaveneta.demandware.net/s/BottegaVeneta/dw/image/v2/BFMR_PRD/on/demandware.static/-/Sites-master-catalog/default/"
  ];
  
  const urls: string[] = [];
  
  // 商品コードバリエーション
  const productCodeVariations = [
    productCode,
    productCode.replace(/_/g, '-'),  // アンダースコアをハイフンに変換
    productCode.toLowerCase(),        // 小文字バージョン
    productCode.toUpperCase()         // 大文字バージョン
  ];
  
  // Bottega Venetaの商品画像は通常異なるビューを以下のパターンでコード化
  const views = [
    "_F", "_B", "_S", "_D", "_L", "_R",  // 基本ビュー（正面、背面、側面、詳細など）
    "_01", "_02", "_03", "_04", "_05", "_06", "_07", "_08", "_09", "_10", // 数字付きバリエーション
    "_RW", "_FW", "_SW", "_BW",  // ワイドショット
    "_CL", "_DT", "_ZM", "_AC",  // クローズアップ、詳細、ズーム、アクセサリ
    "", "/F", "/B", "/S", "/D", "/L", "/R",  // スラッシュ付きバリエーション
    "/01", "/02", "/03", "/04", "/05", "/06", "/07", "/08", "/09", "/10"  // スラッシュ+数字
  ];
  
  // 画像サイズとフォーマット
  const formats = [
    "$zoom$", "$large$", "$medium$", "$small$", // 公式サイト用サイズ
    "?$zoom$", "?$large$", "?$medium$", "?$small$", // クエリパラメータ形式
    "/w_1800,h_1800,c_fill/", "/w_1200,h_1200,c_fill/", "/w_900,h_900,c_fill/", // 寸法指定
    "", // デフォルト（サイズ指定なし）
  ];
  
  // 各ベースURLとフォーマットの組み合わせでURLを生成
  for (const baseUrl of baseUrls) {
    for (const codeVariation of productCodeVariations) {
      for (const view of views) {
        for (const format of formats) {
          // 画像URLの構築パターン1: baseUrl/productCode_view/format/productCode.jpg
          urls.push(`${baseUrl}${codeVariation}${view}/${format}${codeVariation}.jpg`);
          urls.push(`${baseUrl}${codeVariation}${view}/${format}${codeVariation}.png`);
          
          // 画像URLの構築パターン2: baseUrl/productCode_view.jpg?format
          if (format.startsWith("?")) {
            urls.push(`${baseUrl}${codeVariation}${view}.jpg${format}`);
            urls.push(`${baseUrl}${codeVariation}${view}.png${format}`);
          }
          
          // 画像URLの構築パターン3: baseUrl/productCode/images/view.jpg
          urls.push(`${baseUrl}${codeVariation}/images/${view}.jpg`);
          urls.push(`${baseUrl}${codeVariation}/images/${view}.png`);
          
          // 画像URLの構築パターン4: baseUrl/productCode/media/view.jpg
          urls.push(`${baseUrl}${codeVariation}/media/${view}.jpg`);
          urls.push(`${baseUrl}${codeVariation}/media/${view}.png`);
        }
      }
    }
  }
  
  // ルックブック画像のパターン
  const lookbookPatterns = [
    `https://www.bottegaveneta.com/on/demandware.static/-/Library-Sites-bottegaveneta-content/default/images/products/${productCode}/`,
    `https://media.bottegaveneta.com/content/dam/bottegaveneta/collections/${productCode}/`,
    `https://assets.bottegaveneta.com/product/${productCode}/lookbook/`
  ];
  
  for (const pattern of lookbookPatterns) {
    for (let i = 1; i <= 10; i++) {
      urls.push(`${pattern}lookbook_${i}.jpg`);
      urls.push(`${pattern}look_${i}.jpg`);
      urls.push(`${pattern}model_${i}.jpg`);
    }
  }
  
  // 重複を排除
  const uniqueUrls = Array.from(new Set(urls));
  console.log(`Bottega Veneta: 生成されたURL: ${uniqueUrls.length}個`);
  
  return uniqueUrls;
}

/**
 * 画像URLが有効か確認する
 */
async function checkImageExists(url: string): Promise<boolean> {
  try {
    // URLからドメインを抽出してリファラーとして使用
    const urlObj = new URL(url);
    const origin = `${urlObj.protocol}//${urlObj.hostname}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': origin,
        'Origin': origin,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 5000,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: (status) => status < 400 // 3xx リダイレクトも許可
    });
    
    const contentType = response.headers['content-type'];
    const isImage = contentType?.startsWith('image/') || false;
    
    // 応答が画像でない場合でも、バイナリデータの先頭をチェック（JPEG, PNG, GIFのマジックナンバー）
    if (!isImage && response.data && response.data.length > 4) {
      const data = Buffer.from(response.data);
      // JPEGのマジックナンバー: 0xFF 0xD8 0xFF
      if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) return true;
      // PNGのマジックナンバー: 0x89 0x50 0x4E 0x47
      if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return true;
      // GIFのマジックナンバー: 'GIF8'
      if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return true;
    }
    
    return isImage;
  } catch (error: any) {
    console.error('画像の存在確認に失敗:', url, error.message || error);
    return false;
  }
}

/**
 * サーバーサイドでのプロキシURLを作成
 * この関数はフロントエンドで使用して、画像URLをサーバーを経由するURLに変換します
 */
export function createProxyImageUrl(originalUrl: string): string {
  // URLエンコードして、サーバーのプロキシエンドポイントを通す
  const encodedUrl = encodeURIComponent(originalUrl);
  return `/api/proxy/image?url=${encodedUrl}`;
}

/**
 * 複数のURLをバッチで確認する
 */
async function checkBatchImageUrls(urls: string[]): Promise<string[]> {
  const MAX_PARALLEL_REQUESTS = 5;
  const validUrls: string[] = [];
  
  // 並列処理を制限しながら確認
  for (let i = 0; i < urls.length; i += MAX_PARALLEL_REQUESTS) {
    const batch = urls.slice(i, i + MAX_PARALLEL_REQUESTS);
    const results = await Promise.all(
      batch.map(async (url) => {
        const isValid = await checkImageExists(url);
        return { url, isValid };
      })
    );
    
    results.forEach(({ url, isValid }) => {
      if (isValid) {
        validUrls.push(url);
      }
    });
    
    // 早期終了の条件を削除（すべての画像を取得）
  }
  
  return validUrls;
}

/**
 * HTMLからスクレイピングで画像URLを抽出
 */
async function scrapeImagesFromPage(url: string, brand: SupportedBrand): Promise<string[]> {
  try {
    // URLからHTMLを取得
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 10000
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    const imageUrls = new Set<string>();
    
    // ブランド固有のスクレイピング
    switch (brand) {
      case SupportedBrand.ASICS:
        scrapeAsicsImages($, imageUrls);
        break;
      case SupportedBrand.BOTTEGA_VENETA:
        scrapeBottegaVenetaImages($, imageUrls);
        break;
      default:
        // 汎用スクレイピング
        scrapeGenericImages($, imageUrls, url);
        break;
    }
    
    console.log(`スクレイピングで見つかった画像URL: ${imageUrls.size}個`);
    return Array.from(imageUrls);
  } catch (error) {
    console.error('ページのスクレイピングに失敗:', error);
    return [];
  }
}

/**
 * ASICSサイトから画像をスクレイピング
 */
function scrapeAsicsImages($: CheerioAPI, imageUrls: Set<string>): void {
  // 1. data-zoom-image 属性から取得
  $('[data-zoom-image]').each((_, el) => {
    const zoomUrl = $(el).attr('data-zoom-image');
    if (zoomUrl) imageUrls.add(zoomUrl);
  });
  
  // 2. img タグの src から取得
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.includes('asics.com/is/image/asics/')) {
      imageUrls.add(src);
    }
  });
  
  // 3. picture タグの中のソースをチェック
  $('picture source').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) {
      srcset.split(',').forEach(part => {
        const url = part.trim().split(' ')[0];
        if (url.includes('asics.com/is/image/asics/')) {
          imageUrls.add(url);
        }
      });
    }
  });
  
  // 4. JSONデータから画像URLを抽出（ASICSサイトではよく使われる方法）
  const scriptTags = $('script').toArray();
  for (const tag of scriptTags) {
    const content = $(tag).html() || '';
    
    // プロダクトデータのJSONを探す
    if (content.includes('"product"') && content.includes('"images"')) {
      try {
        // 複雑なJSON抽出（正規表現を使用）
        const jsonMatch = content.match(/\{[\s\S]*?"product"[\s\S]*?\{[\s\S]*?\}[\s\S]*?\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          const images = jsonData.product?.images || [];
          
          images.forEach((img: any) => {
            if (typeof img === 'string' && img.includes('asics.com/is/image/asics/')) {
              imageUrls.add(img);
            } else if (img.src && typeof img.src === 'string' && img.src.includes('asics.com/is/image/asics/')) {
              imageUrls.add(img.src);
            }
          });
        }
      } catch (e) {
        console.error('JSON抽出エラー:', e);
      }
    }
  }
}

/**
 * Bottega Venetaサイトから画像をスクレイピング
 */
function scrapeBottegaVenetaImages($: CheerioAPI, imageUrls: Set<string>): void {
  // Bottega Venetaのサイトは複数のレイアウトを持つため、様々なセレクタを試す

  // 1. メイン商品ギャラリーからの画像抽出
  const gallerySelectors = [
    // 高解像度ズーム画像（最優先）
    '[data-component="PDPFullGallery"] [data-component="ZoomableImage"] img',
    '[data-component="ZoomableImage"] img',
    '[data-component="ProductImages"] img',
    
    // 一般的なギャラリーセレクタ
    '.pdp-images img', '.product-images img', '.pdp__images img',
    '.pdp-gallery img', '.pdp__gallery img', '.product-gallery img',
    '.product__gallery img', '.product__images img',
    '.product-carousel img', '.product__carousel img',
    '.swiper-slide img', '.carousel-slide img',
    
    // サムネイル画像
    '.pdp-thumbnails img', '.product-thumbnails img',
    '.thumbnail-list img', '.thumbnail-gallery img'
  ];

  // すべてのギャラリーセレクタを順に試す
  for (const selector of gallerySelectors) {
    $(selector).each((_, el) => {
      // 高解像度の画像URLを優先して抽出
      const originalSrc = $(el).attr('data-original') || $(el).attr('data-src-original');
      const dataSrc = $(el).attr('data-src') || $(el).attr('data-lazy-src');
      const src = $(el).attr('src');
      
      // 優先順位: originalSrc > dataSrc > src
      if (originalSrc) imageUrls.add(originalSrc);
      if (dataSrc) imageUrls.add(dataSrc);
      if (src) imageUrls.add(src);
      
      // srcsetから高解像度画像を抽出
      const srcset = $(el).attr('srcset');
      if (srcset) {
        const parts = srcset.split(',');
        // 最も高解像度の画像（通常最後のもの）を追加
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1].trim();
          const url = lastPart.split(' ')[0];
          if (url) imageUrls.add(url);
        }
        
        // 他の解像度も追加（念のため）
        parts.forEach(part => {
          const url = part.trim().split(' ')[0];
          if (url) imageUrls.add(url);
        });
      }
    });
    
    // いくつかの画像が見つかったら次のセレクタに進む
    if (imageUrls.size > 0) break;
  }

  // 2. Bottega Venetaのサイトはscript内のJSONデータに画像URLを含むことが多い
  const scriptTags = $('script').toArray();
  for (const tag of scriptTags) {
    const content = $(tag).html() || '';
    
    // 2.1 JSONデータを検索
    if (content.includes('"product"') || content.includes('"images"') || content.includes('"media"')) {
      try {
        // 画像URLを含む可能性がある様々なパターンを探す
        
        // パターン1: {"images": [...]}
        const imagesMatch = content.match(/["']images["']\s*:\s*\[([\s\S]*?)\]/);
        if (imagesMatch && imagesMatch[1]) {
          try {
            const images = JSON.parse('[' + imagesMatch[1] + ']'.replace(/'/g, '"'));
            images.forEach((img: any) => {
              if (typeof img === 'string') {
                imageUrls.add(img);
              } else if (img && typeof img === 'object') {
                // {"src": "URL"} または {"url": "URL"} 形式
                const imgUrl = img.src || img.url || img.path || img.href;
                if (imgUrl && typeof imgUrl === 'string') {
                  imageUrls.add(imgUrl);
                }
                
                // 高解像度バージョン
                const highResUrl = img.zoom || img.large || img.original;
                if (highResUrl && typeof highResUrl === 'string') {
                  imageUrls.add(highResUrl);
                }
              }
            });
          } catch (e) {
            console.error('JSON画像抽出エラー1:', e);
          }
        }
        
        // パターン2: {"media": {...}}
        const mediaMatch = content.match(/["']media["']\s*:\s*\{([\s\S]*?)\}/);
        if (mediaMatch && mediaMatch[1]) {
          try {
            const mediaObj = JSON.parse('{' + mediaMatch[1] + '}'.replace(/'/g, '"'));
            // media.images や media.gallery を探す
            const mediaImages = mediaObj.images || mediaObj.gallery || [];
            if (Array.isArray(mediaImages)) {
              mediaImages.forEach((img: any) => {
                if (typeof img === 'string') {
                  imageUrls.add(img);
                } else if (img && typeof img === 'object') {
                  const imgUrl = img.src || img.url || img.path || img.href;
                  if (imgUrl && typeof imgUrl === 'string') {
                    imageUrls.add(imgUrl);
                  }
                }
              });
            }
          } catch (e) {
            console.error('JSON画像抽出エラー2:', e);
          }
        }
      } catch (e) {
        console.error('Bottega Veneta JSONパース失敗:', e);
      }
    }
    
    // 2.2 URL直接検索
    // 画像URLの一般的なパターンを直接テキストから抽出
    const urlPattern = /["'](https:\/\/[^"']+?bottegaveneta[^"']+?\.(jpe?g|png|webp))["']/gi;
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      imageUrls.add(match[1]);
    }
  }
  
  // 3. OpenGraph画像メタタグをチェック（プロダクト画像が含まれる場合がある）
  $('meta[property="og:image"], meta[name="og:image"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content) {
      imageUrls.add(content);
    }
  });
  
  // 4. Bottega Venetaの画像展開リンクを探す（拡大表示用）
  $('a[href*="zoom"], a[data-zoom], [data-zoom-src]').each((_, el) => {
    const zoomSrc = $(el).attr('href') || $(el).attr('data-zoom') || $(el).attr('data-zoom-src');
    if (zoomSrc && /\.(jpe?g|png|webp)/i.test(zoomSrc)) {
      imageUrls.add(zoomSrc);
    }
  });
  
  console.log(`Bottega Venetaスクレイピング: ${imageUrls.size}個の画像URL`);
}

/**
 * 汎用的な画像スクレイピング（多くのECサイトに対応）
 */
function scrapeGenericImages($: CheerioAPI, imageUrls: Set<string>, baseUrl: string): void {
  // 1. すべての画像を抽出
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (src) {
      // 相対URLを絶対URLに変換
      const fullSrc = src.startsWith('http') ? src : new URL(src, baseUrl).href;
      imageUrls.add(fullSrc);
    }
  });
  
  // 2. srcsetから画像を取得
  $('img[srcset], source[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) {
      srcset.split(',').forEach(part => {
        const url = part.trim().split(' ')[0];
        if (url) {
          const fullUrl = url.startsWith('http') ? url : new URL(url, baseUrl).href;
          imageUrls.add(fullUrl);
        }
      });
    }
  });
  
  // 3. 拡大画像、ズーム画像リンクを検索
  $('a[href*="zoom"], a[href*="large"], a[data-zoom], [data-zoom-image]').each((_, el) => {
    const href = $(el).attr('href') || $(el).attr('data-zoom') || $(el).attr('data-zoom-image');
    if (href && href.match(/\.(jpe?g|png|webp|gif)/i)) {
      const fullHref = href.startsWith('http') ? href : new URL(href, baseUrl).href;
      imageUrls.add(fullHref);
    }
  });
  
  // 4. JSON LDからの画像抽出
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const data = JSON.parse(content);
        // Product型のJSON+LDを検索
        if (data['@type'] === 'Product' && data.image) {
          if (Array.isArray(data.image)) {
            data.image.forEach((img: string) => imageUrls.add(img));
          } else if (typeof data.image === 'string') {
            imageUrls.add(data.image);
          }
        }
      }
    } catch (e) {
      // エラーは無視して続行
    }
  });
  
  // 5. 一般的な画像ギャラリーセレクタを試す
  const gallerySelectors = [
    '.product-gallery img',
    '.product-image img',
    '.product-images img',
    '.gallery img',
    '.carousel img',
    '.slider img',
    '.swiper-slide img',
    '.pdp-image img',
    '.main-image img'
  ];
  
  gallerySelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        const fullSrc = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        imageUrls.add(fullSrc);
      }
    });
  });
  
  // 6. インラインJavaScriptから画像URLを抽出
  const scriptTags = $('script').toArray();
  for (const tag of scriptTags) {
    const content = $(tag).html() || '';
    
    // URLパターンを抽出
    const urlPattern = /(['"])(https?:\/\/[^'"]+\.(?:jpe?g|png|webp|gif))(?:\?[^'"]*)?(['"])/gi;
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      const imageUrl = match[2];
      imageUrls.add(imageUrl);
    }
  }
}

/**
 * 2つの画像のURLが実質的に同じ画像を指す可能性が高いかを判定
 */
function areSimilarImageUrls(url1: string, url2: string, brand: SupportedBrand): boolean {
  // 1. URLが完全に一致する場合
  if (url1 === url2) return true;
  
  switch (brand) {
    case SupportedBrand.ASICS:
      return areSimilarAsicsImageUrls(url1, url2);
    case SupportedBrand.BOTTEGA_VENETA:
      return areSimilarBottegaVenetaImageUrls(url1, url2);
    default:
      return areSimilarGenericImageUrls(url1, url2);
  }
}

/**
 * ASICSの画像URLの類似性を判定
 */
function areSimilarAsicsImageUrls(url1: string, url2: string): boolean {
  // 2. URLからプロダクトコードとビューアングルを抽出
  const extractPattern = (url: string) => {
    // 例: https://images.asics.com/is/image/asics/1203A474_002_SR_RT_GLB?$zoom$
    const match = url.match(/asics\/([A-Z0-9_-]+)(?:_([A-Z]{2})_([A-Z]{2})(?:_([A-Z]{2,3}))?)?/i);
    if (!match) return null;
    
    const productCode = match[1];
    const viewType = match[2] || ''; // SR, FL, TP など
    const angle = match[3] || '';    // RT, LT, FR, BK など
    
    return { productCode, viewType, angle };
  };
  
  const pattern1 = extractPattern(url1);
  const pattern2 = extractPattern(url2);
  
  if (!pattern1 || !pattern2) return false;
  
  // 3. 同じ商品コードで同じアングルなら類似と判断
  if (pattern1.productCode === pattern2.productCode && 
      pattern1.angle === pattern2.angle && 
      pattern1.viewType === pattern2.viewType) {
    return true;
  }
  
  // 4. アングルが空の場合、商品コードだけで比較（基本画像の場合）
  if (pattern1.productCode === pattern2.productCode && 
     (!pattern1.angle && !pattern2.angle || !pattern1.viewType && !pattern2.viewType)) {
    return true;
  }
  
  return false;
}

/**
 * Bottega Venetaの画像URLの類似性を判定
 */
function areSimilarBottegaVenetaImageUrls(url1: string, url2: string): boolean {
  // 1. 完全一致なら類似
  if (url1 === url2) return true;
  
  // 2. URLからビューコードを抽出
  const extractViewCode = (url: string): string | null => {
    // パターン1: _XX, _XXX (例 _F, _01, _B, _DT)
    const match1 = url.match(/_(F|B|S|D|L|R|[0-9]{2}|DT|CL|ZM)/i);
    if (match1) return match1[0].toUpperCase();
    
    // パターン2: /XX, /XXX (例 /F, /01, /B)
    const match2 = url.match(/\/(F|B|S|D|L|R|[0-9]{2})/i);
    if (match2) return `_${match2[1].toUpperCase()}`;
    
    return null;
  };
  
  // 3. URLからサイズ指定（ズームなど）を抽出
  const extractSize = (url: string): string => {
    // $zoom$, $large$ などの指定
    const sizeMatch = url.match(/\$(zoom|large|medium|small)\$/i);
    if (sizeMatch) return sizeMatch[1].toLowerCase();
    
    // w_1800,h_1800 などの指定
    const dimensionMatch = url.match(/w_(\d+),h_\d+/i);
    if (dimensionMatch) return dimensionMatch[1];
    
    return '';
  };
  
  // 同じURLから異なるビューコードが抽出された場合、異なる画像と判断
  const viewCode1 = extractViewCode(url1);
  const viewCode2 = extractViewCode(url2);
  
  if (viewCode1 && viewCode2 && viewCode1 !== viewCode2) {
    return false; // 異なるビューコードなら異なる画像
  }
  
  // 4. 同じビューでもサイズが異なる場合は高解像度を優先するために類似と判断
  const size1 = extractSize(url1);
  const size2 = extractSize(url2);
  
  // ドメインとパスが似ていて、ビューコードが同じか存在しない場合は類似と判断
  const domain1 = new URL(url1).hostname;
  const domain2 = new URL(url2).hostname;
  
  if (domain1 === domain2 && (!viewCode1 && !viewCode2)) {
    return true; // 同じドメインで特定のビューコードがなければ類似と判断
  }
  
  // 基本的には異なる画像として扱う（似ている確証がない場合）
  return false;
}

/**
 * 一般的な画像URLの類似性を判定
 */
function areSimilarGenericImageUrls(url1: string, url2: string): boolean {
  // URLからファイル名とクエリパラメータを除去して比較
  const stripQueryAndSize = (url: string): string => {
    // クエリパラメータを除去
    let stripped = url.split('?')[0];
    // サイズパラメータを除去（例: _800x800, _1200x1200）
    stripped = stripped.replace(/(_\d+x\d+)(\.[a-z]+)$/i, '$2');
    return stripped;
  };
  
  const base1 = stripQueryAndSize(url1);
  const base2 = stripQueryAndSize(url2);
  
  // ベースURLが同じなら類似と判断
  if (base1 === base2) return true;
  
  // ファイル名のみを抽出して比較（パスが違っても同じファイル名なら類似の可能性あり）
  const getFilename = (url: string): string => {
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0];
  };
  
  const file1 = getFilename(url1);
  const file2 = getFilename(url2);
  
  // 拡張子以外のファイル名が同じなら類似と判断
  if (file1.split('.')[0] === file2.split('.')[0]) return true;
  
  return false;
}

/**
 * 類似画像をフィルタリングして減らす
 */
function filterSimilarUrls(urls: string[], brand: SupportedBrand): string[] {
  if (urls.length <= 1) return urls;
  
  const result: string[] = [];
  const processed = new Set<string>();
  
  // 解像度に関するパラメータを取り出す関数
  const getResolutionPriority = (url: string): number => {
    if (url.includes('zoom')) return 5;
    if (url.includes('1800')) return 4;
    if (url.includes('1200')) return 3;
    if (url.includes('900')) return 2;
    if (url.includes('600')) return 1;
    return 0;
  };
  
  // URLをグループ化
  const groups: Record<string, string[]> = {};
  
  for (const url of urls) {
    // すでに処理済みのURLはスキップ
    if (processed.has(url)) continue;
    
    const group: string[] = [url];
    processed.add(url);
    
    // 他のURLと比較
    for (const otherUrl of urls) {
      if (url === otherUrl || processed.has(otherUrl)) continue;
      
      if (areSimilarImageUrls(url, otherUrl, brand)) {
        group.push(otherUrl);
        processed.add(otherUrl);
      }
    }
    
    // グループの代表URLを決定（解像度が高いものを優先）
    const key = group[0];
    groups[key] = group;
  }
  
  // 各グループから最適なURLを選択
  for (const key in groups) {
    const group = groups[key];
    
    // 最も解像度が高いURLを選択
    group.sort((a, b) => getResolutionPriority(b) - getResolutionPriority(a));
    result.push(group[0]);
  }
  
  return result;
}

/**
 * 商品ページURLから画像情報を取得する
 */
export async function getImagesFromUrl(url: string): Promise<ImageInfo[]> {
  try {
    console.log('商品ページURL:', url);
    
    // ブランドを検出
    const brand = detectBrand(url);
    console.log('検出されたブランド:', brand);
    
    // 商品コードを抽出
    const productCode = extractProductCode(url);
    if (!productCode) {
      console.error('商品コードが抽出できませんでした:', url);
      return [];
    }
    
    console.log('抽出された商品コード:', productCode);
    
    // 1. パターンベースで画像URLを生成
    const generatedUrls = generateImageUrls(productCode, brand);
    console.log('生成された画像URL:', generatedUrls.length);
    
    // 2. ページをスクレイピングして画像URLを取得（バックアップ）
    const scrapedUrls = await scrapeImagesFromPage(url, brand);
    console.log('スクレイピングで取得した画像URL:', scrapedUrls.length);
    
    // すべてのURLを結合して重複を除去
    const allUrls = [...generatedUrls, ...scrapedUrls];
    const uniqueUrls = Array.from(new Set(allUrls));
    console.log('重複除去後の候補画像URL:', uniqueUrls.length);
    
    // 3. 類似URLをフィルタリング
    const filteredUrls = filterSimilarUrls(uniqueUrls, brand);
    console.log('類似性フィルタリング後の画像URL:', filteredUrls.length);
    
    // 4. 画像URLの存在確認
    console.log('画像URLの存在確認を開始...');
    const validUrls = await checkBatchImageUrls(filteredUrls);
    console.log('有効な画像URL:', validUrls.length);
    
    // 5. ImageInfo型に変換（プロキシURLを使用して画像を表示）
    const images = validUrls.map((src, index) => ({
      src,
      width: "640",
      height: "480",
      alt: `商品画像 ${index + 1} - ${productCode}`
    }));
    
    console.log('最終的な画像数:', images.length);
    return images;
  } catch (error) {
    console.error('画像取得エラー:', error);
    return [];
  }
}

/**
 * 汎用ブランドの商品コードから画像URLを生成する
 * 多くのブランドで共通して使われるパターンを試す
 */
function generateGenericBrandImageUrls(productCode: string): string[] {
  const urls: string[] = [];
  
  // 商品コードバリエーション
  const productCodeVariations = [
    productCode,
    productCode.replace(/_/g, '-'),  // アンダースコアをハイフンに変換
    productCode.toLowerCase(),        // 小文字バージョン
    productCode.toUpperCase()         // 大文字バージョン
  ];
  
  // 一般的なCDNパターン
  const cdnPatterns = [
    `https://images.{brand}.com/is/image/{brand}/`,
    `https://assets.{brand}.com/images/products/`,
    `https://media.{brand}.com/i/`,
    `https://resources.{brand}.com/i/`,
    `https://www.{brand}.com/images/products/`,
    `https://cdn.{brand}.com/products/`,
    `https://product-images.{brand}.com/`
  ];
  
  // ブランド名の可能性
  const possibleBrands = extractPossibleBrandNames(productCode);
  
  // ビューパターン
  const views = [
    "_1",
    "_2",
    "_3",
    "_main",
    "_front",
    "_back",
    "_side",
    "_detail",
    "_alt",
    ""
  ];
  
  // 拡張子
  const extensions = [".jpg", ".jpeg", ".png", ".webp"];
  
  // サイズパラメータ
  const sizeParams = [
    "?w=1200&h=1200",
    "?width=800&height=800",
    "?size=large",
    "?fmt=webp",
    ""
  ];
  
  // 各CDNパターンでURLを生成
  for (const brand of possibleBrands) {
    for (const pattern of cdnPatterns) {
      const baseUrl = pattern.replace(/\{brand\}/g, brand);
      
      for (const code of productCodeVariations) {
        for (const view of views) {
          for (const ext of extensions) {
            for (const size of sizeParams) {
              urls.push(`${baseUrl}${code}${view}${ext}${size}`);
            }
          }
        }
      }
    }
  }
  
  // 重複を排除
  const uniqueUrls = Array.from(new Set(urls));
  return uniqueUrls;
}

/**
 * 商品コードから可能性のあるブランド名を抽出する
 */
function extractPossibleBrandNames(productCode: string): string[] {
  // デフォルトのブランド名セット
  const brands = ["brand", "fashion", "luxury", "apparel", "clothing", "shoes"];
  
  // 商品コードからアルファベット文字列を抽出
  const matches = productCode.match(/([a-zA-Z]+)/g);
  if (matches && matches.length > 0) {
    // アルファベット部分を潜在的なブランド名として追加
    matches.forEach(match => {
      if (match.length >= 3) { // 3文字以上のものだけ考慮
        brands.push(match.toLowerCase());
      }
    });
  }
  
  return brands;
} 