'use client';

import React, { useState, useRef } from 'react';

export default function SnapReportPage() {
  const [photoName, setPhotoName] = useState('');
  const [camera, setCamera] = useState('');
  const [lens, setLens] = useState('');
  const [genre, setGenre] = useState('');
  const [tone, setTone] = useState('');
  const [processedImageUrl, setProcessedImageUrl] = useState('');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProcessedImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCaption = async () => {
    if (!processedImageUrl) {
      alert('写真をアップロードしてください。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          camera,
          lens,
          genre,
          tone,
          photoName,
          imageBase64: processedImageUrl,
        }),
      });

      const data = await res.json();
      if (data.caption) {
        setGeneratedCaption(data.caption);
      } else if (data.error) {
        alert(`エラーが発生しました: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to fetch caption:', error);
      alert('キャプション生成のリクエストに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          SNAP REPORT
        </h1>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左カラム：入力フォーム */}
        <section className="space-y-5 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">レポート設定</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">写真アップロード</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>

          {processedImageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 max-h-64 flex justify-center items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={processedImageUrl} alt="Preview" className="max-h-64 object-contain" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">写真タイトル</label>
            <input
              type="text"
              value={photoName}
              onChange={(e) => setPhotoName(e.target.value)}
              placeholder="例: 夕暮れの海岸"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">カメラ</label>
              <input
                type="text"
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                placeholder="例: Canon EOS RP"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">レンズ</label>
              <input
                type="text"
                value={lens}
                onChange={(e) => setLens(e.target.value)}
                placeholder="例: RF28-70mm F2.8"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">ジャンル</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="例: スナップ / 風景"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">トーン / 雰囲気</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="例: ノスタルジック"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              />
            </div>
          </div>

          <button
            onClick={generateCaption}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition"
          >
            {loading ? 'AIキャプション生成中...' : '✨ キャプションを生成する'}
          </button>
        </section>

        {/* 右カラム：生成結果表示 */}
        <section className="space-y-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col">
          <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">生成されたキャプション</h2>
          <textarea
            value={generatedCaption}
            onChange={(e) => setGeneratedCaption(e.target.value)}
            rows={12}
            placeholder="AIで生成されたキャプションがここに表示されます..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none flex-grow leading-relaxed"
          />
        </section>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}