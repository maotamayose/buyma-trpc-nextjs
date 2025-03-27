'use client';

import { trpc } from '@/utils/trpc';
import { useState } from 'react';

export default function HomePage() {
  const [brand, setBrand] = useState('');
  const [keyword, setKeyword] = useState('');
  const [enabled, setEnabled] = useState(false);

  const query = trpc.product.search.useQuery(
    { brand, keyword },
    { enabled }
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">商品検索</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="ブランド名（例: Nike）"
          className="border p-2 w-40"
        />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="キーワード（例: Air Max）"
          className="border p-2 w-40"
        />
        <button
          onClick={() => setEnabled(true)}
          className="bg-black text-white px-4 py-2"
        >
          検索
        </button>
      </div>

      {query.isLoading && <p>🔄 検索中です...</p>}
      {query.error && <p className="text-red-600">❌ エラー: {query.error.message}</p>}

      {query.data && (
        <div className="mt-4">
          <p>🔗 公式サイト: <a className="underline text-blue-600" href={query.data.officialSite} target="_blank">{query.data.officialSite}</a></p>
          <ul className="list-disc pl-5 mt-2">
            {query.data.results.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
