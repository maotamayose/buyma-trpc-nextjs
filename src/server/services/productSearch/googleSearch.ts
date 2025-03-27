import axios from "axios";

const API_KEY = process.env.GOOGLE_API_KEY!;
const CX = process.env.GOOGLE_CSE_ID!;
const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

export async function searchOfficialSite(brand: string): Promise<string | null> {
  const query = `${brand} 公式サイト`;
  const res = await axios.get(GOOGLE_SEARCH_URL, {
    params: { key: API_KEY, cx: CX, q: query },
  });

  const items = res.data.items || [];
  for (const item of items) {
    const link: string = item.link;
    if (link.includes(brand.toLowerCase())) return new URL(link).origin;
  }
  return null;
}

export async function searchProductInOfficialSite(siteUrl: string, keyword: string): Promise<string[]> {
  const query = `site:${siteUrl} ${keyword}`;
  const res = await axios.get(GOOGLE_SEARCH_URL, {
    params: { key: API_KEY, cx: CX, q: query },
  });

  return (res.data.items || []).slice(0, 5).map((item: any) => item.link);
}
