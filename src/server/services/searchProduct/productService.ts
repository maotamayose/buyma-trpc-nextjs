import {
  searchOfficialSite,
  searchProductInOfficialSite,
} from "./googleSearch";

export async function getProductResults(brand: string, keyword: string) {
  if (!brand || !keyword) {
    throw new Error("brand and keyword are required");
  }

  const brandUrl = await searchOfficialSite(brand);
  if (!brandUrl) {
    throw new Error("Official site not found");
  }

  const results = await searchProductInOfficialSite(brandUrl, keyword);

  return { brand, keyword, officialSite: brandUrl, results };
} 