"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import JSZip from "jszip";

export default function Page() {
  const [input, setInput] = useState({ brand: "", keyword: "" });
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [hasCrawled, setHasCrawled] = useState(false); // 一度だけ実行するためのフラグ

  const search = trpc.product.search.useQuery(input, {
    enabled: false,
    retry: false,
  });

  const images = trpc.downloadImage.getImages.useQuery(
    { url: selectedUrl ?? "" },
    {
      enabled: !!selectedUrl,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchInterval: false, // または 0
      onSettled: () => {
        setIsLoadingMore(false);
      },
    }
  );
  

  // 画像の選択状態を切り替える
  const toggleImageSelection = (imageSrc: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageSrc)) {
      newSelection.delete(imageSrc);
    } else {
      newSelection.add(imageSrc);
    }
    setSelectedImages(newSelection);
  };

  // Blob の MIME タイプから拡張子を取得するヘルパー
  const getExtensionFromMime = (mimeType: string): string => {
    const extMap: { [key: string]: string } = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
    };
    return extMap[mimeType] || "";
  };

  // 選択した画像をzipファイルにまとめてダウンロードする
  const downloadSelectedImagesAsZip = async () => {
    const zip = new JSZip();
    let index = 0;
    // ファイル名重複対策
    const fileNameCount: Record<string, number> = {};

    for (const imageSrc of Array.from(selectedImages)) {
      try {
        const response = await fetch(imageSrc, { mode: "cors" });
        const blob = await response.blob();
        // URLからファイル名を取得（クエリパラメータは除去）
        let fileName =
          imageSrc.split("/").pop()?.split("?")[0] || `image-${index}`;
        if (!fileName.includes(".")) {
          fileName = `image-${index}${getExtensionFromMime(blob.type)}`;
        }
        // 重複があれば番号付与
        if (fileNameCount[fileName] !== undefined) {
          fileNameCount[fileName]++;
          const dotIndex = fileName.lastIndexOf(".");
          const base = fileName.substring(0, dotIndex);
          const ext = fileName.substring(dotIndex);
          fileName = `${base}-${fileNameCount[fileName]}${ext}`;
        } else {
          fileNameCount[fileName] = 0;
        }
        zip.file(fileName, blob);
        index++;
      } catch (err) {
        console.error(`画像のダウンロードに失敗: ${imageSrc}`, err);
      }
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const blobUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "images.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  // ボタンクリックで一度だけクローリングを実行する（再実行する場合はリセットボタンから）
  const handleSearch = () => {
    if (!input.brand || !input.keyword) return;
    if (!hasCrawled) {
      search.refetch();
      setHasCrawled(true);
    } else {
      alert("既にクローリング済みです。リセットして再実行してください。");
    }
  };

  // リセット処理（再検索可能にする）
  const handleReset = () => {
    setHasCrawled(false);
    setSelectedUrl(null);
    setSelectedImages(new Set());
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-12 px-6">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-10">
          商品画像スクレイパー
        </h1>
        <form
          className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              ブランド名
            </label>
            <input
              type="text"
              value={input.brand}
              onChange={(e) =>
                setInput((p) => ({ ...p, brand: e.target.value }))
              }
              placeholder="例: Nike"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              キーワード
            </label>
            <input
              type="text"
              value={input.keyword}
              onChange={(e) =>
                setInput((p) => ({ ...p, keyword: e.target.value }))
              }
              placeholder="例: Air Pegasus 2005"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex justify-between gap-4">
            <button
              type="submit"
              disabled={search.isFetching || !input.brand || !input.keyword}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {search.isFetching ? "検索中..." : "検索"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              リセット
            </button>
          </div>
          {search.isError && (
            <p className="text-red-500 text-center">
              エラーが発生しました: {search.error?.message || "不明なエラー"}
            </p>
          )}
          {search.data?.officialSite && (
            <div className="text-center">
              <a
                href={search.data.officialSite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-semibold"
              >
                公式サイト: {search.data.officialSite}
              </a>
              <br />
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(
                  search.data.officialSite + " " + input.keyword
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline mt-2 inline-block"
              >
                こちらをクリックしても検索できます
              </a>
            </div>
          )}
          {search.data?.results?.map((url: string, index: number) => (
            <div
              key={`${url}-${index}`}
              className="flex items-center justify-between border-b py-2"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate max-w-[70%]"
              >
                {url}
              </a>
              <button
                type="button"
                onClick={() => {
                  if (selectedUrl === url) return;
                  setSelectedUrl(url);
                  setIsLoadingMore(true);
                  setSelectedImages(new Set());
                }}
                disabled={isLoadingMore}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                画像を表示
              </button>
            </div>
          ))}
        </form>
      </div>

      {selectedUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-6 z-50">
          <div className="bg-white p-8 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">商品画像</h2>
              <div className="flex items-center space-x-4">
                {selectedImages.size > 0 && (
                  <button
                    onClick={downloadSelectedImagesAsZip}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    選択した画像をZipでダウンロード ({selectedImages.size})
                  </button>
                )}
                <button
                  onClick={() => setSelectedUrl(null)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {images.isLoading || isLoadingMore ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">画像を読み込み中...</p>
              </div>
            ) : images.isError ? (
              <div className="text-center py-10">
                <p className="text-red-500 text-xl font-bold">
                  画像の読み込みに失敗しました
                </p>
                <p className="mt-2 text-gray-600">
                  {images.error?.message || "不明なエラーが発生しました"}
                </p>
                <button
                  onClick={() => {
                    setIsLoadingMore(true);
                    images.refetch();
                  }}
                  className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  再試行
                </button>
              </div>
            ) : images.data?.images.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-600">画像が見つかりませんでした</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex justify-between items-center">
                  <div className="text-gray-700 text-lg">
                    <span className="font-bold">
                      {images.data?.images.length}
                    </span>{" "}
                    枚の画像が見つかりました
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() =>
                        setSelectedImages(
                          new Set(
                            images.data?.images.map((img) => img.src) || []
                          )
                        )
                      }
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                    >
                      すべて選択
                    </button>
                    <button
                      onClick={() => setSelectedImages(new Set())}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                    >
                      選択解除
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.data?.images.map((image, index) => (
                    <div
                      key={`${image.src}-${index}`}
                      className={`border rounded-lg overflow-hidden transition-transform hover:scale-105 hover:shadow-2xl cursor-pointer ${
                        selectedImages.has(image.src)
                          ? "ring-2 ring-blue-500"
                          : ""
                      }`}
                      onClick={() => toggleImageSelection(image.src)}
                    >
                      <div className="relative">
                        <img
                          src={image.src}
                          alt={image.alt || `商品画像 ${index + 1}`}
                          width={image.width}
                          height={image.height}
                          className="w-full h-auto"
                          loading="lazy"
                        />
                        <div className="absolute top-2 left-2">
                          <input
                            type="checkbox"
                            checked={selectedImages.has(image.src)}
                            onChange={() => toggleImageSelection(image.src)}
                            className="w-5 h-5"
                          />
                        </div>
                      </div>
                      <div className="p-3 text-sm text-gray-600 break-all flex justify-between items-center">
                        <span>画像 {index + 1}</span>
                        <a
                          href={image.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          原寸で表示
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
