"use client";

import { useState } from "react";
import { trpc } from "@/utils/trpc";
import JSZip from "jszip";

export default function Page() {
  const [input, setInput] = useState({ brand: "", keyword: "" });
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const search = trpc.product.search.useQuery(input, {
    enabled: false,
    retry: false,
  });

  const images = trpc.downloadImage.getImages.useQuery(
    { url: selectedUrl ?? "" },
    {
      enabled: !!selectedUrl,
      retry: 1,
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
    for (const imageSrc of Array.from(selectedImages)) {
      try {
        const response = await fetch(imageSrc, { mode: "cors" });
        const blob = await response.blob();
        // URLからファイル名を取得（クエリパラメータは除去）
        let fileName = imageSrc.split("/").pop()?.split("?")[0] || "";
        // 拡張子がなければ Blob の MIME タイプから補完
        if (!fileName.includes(".")) {
          fileName = `image-${index}${getExtensionFromMime(blob.type)}`;
        }
        zip.file(fileName, blob);
        index++;
      } catch (err) {
        console.error(`画像のダウンロードに失敗: ${imageSrc}`, err);
      }
    }
    // zipファイルを生成
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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          商品画像スクレイパー
        </h1>
        <form
          className="max-w-lg mx-auto bg-white p-6 rounded-lg shadow-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.brand && input.keyword) search.refetch();
          }}
        >
          <div className="flex flex-col gap-2">
            <label className="text-gray-700 font-medium">ブランド名</label>
            <input
              value={input.brand}
              onChange={(e) =>
                setInput((p) => ({ ...p, brand: e.target.value }))
              }
              placeholder="ブランド名"
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-gray-700 font-medium">キーワード</label>
            <input
              value={input.keyword}
              onChange={(e) =>
                setInput((p) => ({ ...p, keyword: e.target.value }))
              }
              placeholder="キーワード"
              className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            disabled={search.isFetching || !input.brand || !input.keyword}
            className="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {search.isFetching ? "検索中..." : "検索"}
          </button>

          {search.isError && (
            <p className="text-red-500 text-center">
              エラーが発生しました:{" "}
              {search.error?.message || "不明なエラー"}
            </p>
          )}

          {search.data?.officialSite && (
            <div className="mb-4 text-center">
              <a
                href={search.data.officialSite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline font-semibold"
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
                className="text-blue-500 hover:underline mt-2 inline-block"
              >
                下に何も出てこなかったらこちらをクリック！！
              </a>
            </div>
          )}

          {search.data?.results?.map((url: string) => (
            <div key={url} className="flex items-center justify-between border-b py-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline truncate max-w-[70%]"
              >
                {url}
              </a>
              <button
                onClick={() => {
                  setSelectedUrl(url);
                  setIsLoadingMore(true);
                  setSelectedImages(new Set()); // 新しい画像を表示する際に選択をリセット
                }}
                disabled={isLoadingMore}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                画像を表示
              </button>
            </div>
          ))}
        </form>
      </div>

      {selectedUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                商品画像
              </h2>
              <div className="flex items-center space-x-3">
                {selectedImages.size > 0 && (
                  <button
                    onClick={downloadSelectedImagesAsZip}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    選択した画像をZipでダウンロード (
                    {selectedImages.size})
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
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">画像を読み込み中...</p>
              </div>
            ) : images.isError ? (
              <div className="text-center py-8">
                <p className="text-red-500 text-lg font-bold">
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
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  再試行
                </button>
              </div>
            ) : images.data?.images.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">画像が見つかりませんでした</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex justify-between items-center">
                  <div className="text-gray-700">
                    <span className="font-bold">
                      {images.data?.images.length}
                    </span>{" "}
                    枚の画像が見つかりました
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() =>
                        setSelectedImages(
                          new Set(
                            images.data?.images.map((img) => img.src) || []
                          )
                        )
                      }
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors text-sm"
                    >
                      すべて選択
                    </button>
                    <button
                      onClick={() => setSelectedImages(new Set())}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors text-sm"
                    >
                      選択解除
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.data?.images.map((image, index) => (
                    <div
                      key={index}
                      className={`border rounded overflow-hidden transition-all hover:shadow-xl ${
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
                          className="w-full h-auto cursor-pointer"
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
                      <div className="p-2 text-sm text-gray-600 break-all flex justify-between items-center">
                        <span>画像 {index + 1}</span>
                        <a
                          href={image.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
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
