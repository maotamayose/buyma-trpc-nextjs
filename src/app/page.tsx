'use client';

import { useState } from 'react';
import { trpc } from '@/utils/trpc';

export default function Page() {
  const [input, setInput] = useState({ brand: '', keyword: '' });
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  
  const search = trpc.product.search.useQuery(input, {
    enabled: false,
    retry: false,
  });

  const images = trpc.downloadImage.getImages.useQuery(
    { url: selectedUrl ?? '' },
    { 
      enabled: !!selectedUrl,
      retry: 1,
      onSettled: () => {
        setIsLoadingMore(false);
      }
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

  // 選択した画像をダウンロードする
  const downloadSelectedImages = () => {
    Array.from(selectedImages).forEach((imageSrc, index) => {
      // ダウンロード処理を遅延実行（ブラウザのブロックを防ぐため）
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = imageSrc;
        // ファイル名の作成（URLから抽出）
        const fileName = imageSrc.split('/').pop()?.split('?')[0] || `image-${index}.jpg`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 300);
    });
  };

  return (
    <main className="p-4">
      <form 
        className="max-w-md mx-auto space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.brand && input.keyword) search.refetch();
        }}
      >
        <input
          value={input.brand}
          onChange={e => setInput(p => ({ ...p, brand: e.target.value }))}
          placeholder="ブランド名"
          className="w-full p-2 border rounded"
        />
        <input
          value={input.keyword}
          onChange={e => setInput(p => ({ ...p, keyword: e.target.value }))}
          placeholder="キーワード"
          className="w-full p-2 border rounded"
        />
        <button
          disabled={search.isFetching || !input.brand || !input.keyword}
          className="w-full p-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {search.isFetching ? '検索中...' : '検索'}
        </button>

        {search.isError && (
          <p className="text-red-500">エラーが発生しました: {search.error?.message || '不明なエラー'}</p>
        )}

        {search.data?.officialSite && (
          <div className="mb-4">
            <a
              href={search.data.officialSite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              公式サイト: {search.data.officialSite}
            </a>
          </div>
        )}

        {search.data?.results?.map((url: string) => (
          <div key={url} className="flex items-center justify-between">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline overflow-hidden text-ellipsis"
              style={{ maxWidth: '70%' }}
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
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              画像を表示
            </button>
          </div>
        ))}

        {selectedUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-4 rounded max-w-4xl w-full max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">商品画像</h2>
                <div className="flex items-center space-x-2">
                  {selectedImages.size > 0 && (
                    <button
                      onClick={downloadSelectedImages}
                      className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      選択した画像をダウンロード ({selectedImages.size})
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUrl(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {images.isLoading || isLoadingMore ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4">画像を読み込み中...</p>
                </div>
              ) : images.isError ? (
                <div className="text-center py-8">
                  <p className="text-red-500 text-lg font-bold">画像の読み込みに失敗しました</p>
                  <p className="mt-2 text-gray-600">{images.error?.message || '不明なエラーが発生しました'}</p>
                  <button 
                    onClick={() => {
                      setIsLoadingMore(true);
                      images.refetch();
                    }}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
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
                    <div>
                      <span className="font-bold">{images.data?.images.length}</span> 枚の画像が見つかりました
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedImages(new Set(images.data?.images.map(img => img.src) || []))}
                        className="px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                      >
                        すべて選択
                      </button>
                      <button
                        onClick={() => setSelectedImages(new Set())}
                        className="px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                      >
                        選択解除
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {images.data?.images.map((image, index) => (
                      <div 
                        key={index} 
                        className={`border rounded overflow-hidden transition-all ${
                          selectedImages.has(image.src) ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => toggleImageSelection(image.src)}
                      >
                        <div className="relative">
                          <img
                            src={image.src}
                            alt={image.alt || `商品画像 ${index + 1}`}
                            width={image.width}
                            height={image.height}
                            className="max-w-full h-auto cursor-pointer"
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
                        <div className="p-2 text-sm break-all flex justify-between items-center">
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
      </form>
    </main>
  );
}
