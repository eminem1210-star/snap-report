'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

const CAMERA_OPTIONS = ['Canon EOS RP', 'Canon EOS R6', 'Sony α7 IV', 'Nikon Z6II', 'FUJIFILM X-T4', 'iPhone / Smartphone'];
const LENS_OPTIONS = ['RF28-70mm F2.8', 'RF24-105mm F4 L', '100-400mm F4.5-5.6', 'FE 24-70mm F2.8', 'XF35mmF1.4 R'];
const GENRE_OPTIONS = ['スナップ', '風景', 'ポートレート', '鉄道・航空', '夜景・星空', 'ストリート'];
const TONE_OPTIONS = ['かっこいい', 'エモい・ノスタルジック', 'シネマティック', '爽やか・透明感', 'ダーク・重厚', 'ナチュラル'];

export default function SnapReportPage() {
  const [photoName, setPhotoName] = useState('');
  const [camera, setCamera] = useState(CAMERA_OPTIONS[0]);
  const [lens, setLens] = useState(LENS_OPTIONS[0]);
  const [genre, setGenre] = useState(GENRE_OPTIONS[0]);
  const [tone, setTone] = useState(TONE_OPTIONS[0]);

  const [rawImageUrl, setRawImageUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [loading, setLoading] = useState(false);

  // 文字入れ・合成のフラグ
  const [showTitle, setShowTitle] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [showLens, setShowLens] = useState(true);
  const [addBorder, setAddBorder] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 画像のキャンバス描画＆文字入れ処理
  const updateCanvas = useCallback(() => {
    if (!rawImageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = rawImageUrl;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const padding = addBorder ? 40 : 0;
      const textAreaHeight = (showTitle || showCamera || showLens) ? 80 : 0;

      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2 + textAreaHeight;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, padding, padding, img.width, img.height);

      if (textAreaHeight > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px sans-serif';
        let currentY = img.height + padding + 35;

        if (showTitle && photoName) {
          ctx.fillText(photoName, padding + 10, currentY);
          currentY += 28;
        }

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94a3b8';
        const metaText = [
          showCamera && camera ? `Cam: ${camera}` : '',
          showLens && lens ? `Lens: ${lens}` : '',
        ].filter(Boolean).join('  |  ');

        if (metaText) {
          ctx.fillText(metaText, padding + 10, currentY);
        }
      }

      setProcessedImageUrl(canvas.toDataURL('image/jpeg', 0.9));
    };
  }, [rawImageUrl, photoName, camera, lens, showTitle, showCamera, showLens, addBorder]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // AIキャプション生成
  const generateCaption = async () => {
    if (!rawImageUrl && !processedImageUrl) {
      alert('写真をアップロードしてください。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera,
          lens,
          genre,
          tone,
          photoName,
          imageBase64: rawImageUrl || processedImageUrl,
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
      <header className="w-full max-w-4xl mb-6 flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          SNAP REPORT
        </h1>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左カラム：設定パネル */}
        <section className="space-y-5 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">1. 写真＆文字入れ設定</h2>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">写真アップロード</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>

          {/* 文字入れオプション（チェックボックス） */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} /> Title入れる
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showCamera} onChange={(e) => setShowCamera(e.target.checked)} /> カメラ名
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showLens} onChange={(e) => setShowLens(e.target.checked)} /> レンズ名
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={addBorder} onChange={(e) => setAddBorder(e.target.checked)} /> 外枠追加
            </label>
          </div>

          {/* 画像プレビュー */}
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
              placeholder="例: ブルーインパルスと快晴の空"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
            />
          </div>

          {/* プルダウン選択項目 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">カメラ</label>
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              >
                {CAMERA_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">レンズ</label>
              <select
                value={lens}
                onChange={(e) => setLens(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              >
                {LENS_OPTIONS.map((l) => (<option key={l} value={l}>{l}</option>))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">ジャンル</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              >
                {GENRE_OPTIONS.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">トーン / 雰囲気</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-100"
              >
                {TONE_OPTIONS.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
          </div>

          <button
            onClick={generateCaption}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg shadow-lg disabled:opacity-50 transition"
          >
            {loading ? '✨ Gemini AIが写真を解析中...' : '✨ キャプションを生成する'}
          </button>
        </section>

        {/* 右カラム：生成結果 */}
        <section className="space-y-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col">
          <h2 className="text-lg font-semibold text-slate-200 border-b border-slate-800 pb-2">2. 生成されたキャプション</h2>
          <textarea
            value={generatedCaption}
            onChange={(e) => setGeneratedCaption(e.target.value)}
            rows={14}
            placeholder="AIで生成されたキャプションがここに表示されます..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none flex-grow leading-relaxed font-sans"
          />
        </section>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}