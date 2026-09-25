'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function SnapReportPage() {
  const [camera, setCamera] = useState('');
  const [lens, setLens] = useState('');
  const [genre, setGenre] = useState('スナップ');
  const [tone, setTone] = useState('フランク・気さく');
  const [photoName, setPhotoName] = useState('オーレリアン二郎');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [showCameraOnImage, setShowCameraOnImage] = useState(true);
  const [showLensOnImage, setShowLensOnImage] = useState(true);
  const [showPhotoByOnImage, setShowPhotoByOnImage] = useState(true);
  const [watermarkPosition, setWatermarkPosition] = useState<'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'>('bottom-left');
  
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  const [savedCameras, setSavedCameras] = useState<string[]>([]);
  const [savedLenses, setSavedLenses] = useState<string[]>([]);

  const [generatedCaption, setGeneratedCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const genreOptions = ['スナップ', 'ポートレート', '風景', '都市・建築', '夜景', 'テーブルフォト・カフェ', 'フィルム・オールドレンズ', 'その他'];

  const toneOptions = [
    { label: '🤩 テンション高め・ポップ', value: 'テンション高め・ポップ' },
    { label: '☕️ フランク・気さく', value: 'フランク・気さく' },
    { label: '🔥 エッジの効いた一言 (インパクト重視)', value: 'インパクト・キャッチー' },
    { label: '🎬 撮影裏話・エピソード風', value: '撮影裏話風' },
    { label: '📷 真面目・エモい・写真集風', value: '真面目・エモい' },
  ];

  // 設定＆履歴の復元
  useEffect(() => {
    const cameras = JSON.parse(localStorage.getItem('snap_cameras') || '["Canon EOS RP", "Yashica Electro 35"]');
    const lenses = JSON.parse(localStorage.getItem('snap_lenses') || '["Super-Takumar 50mm F1.4", "RF24-105mm F4 L"]');
    const lastPhotoName = localStorage.getItem('snap_photo_name') || 'オーレリアン二郎';

    setSavedCameras(cameras);
    setSavedLenses(lenses);
    setPhotoName(lastPhotoName);
    if (cameras.length > 0) setCamera(cameras[0]);
    if (lenses.length > 0) setLens(lenses[0]);
  }, []);

  // 履歴保存
  const saveHistory = (type: 'camera' | 'lens', val: string) => {
    if (!val.trim()) return;
    if (type === 'camera') {
      const updated = Array.from(new Set([val, ...savedCameras]));
      setSavedCameras(updated);
      localStorage.setItem('snap_cameras', JSON.stringify(updated));
    } else {
      const updated = Array.from(new Set([val, ...savedLenses]));
      setSavedLenses(updated);
      localStorage.setItem('snap_lenses', JSON.stringify(updated));
    }
  };

  // 履歴削除
  const removeHistory = (type: 'camera' | 'lens', item: string) => {
    if (type === 'camera') {
      const updated = savedCameras.filter((c) => c !== item);
      setSavedCameras(updated);
      localStorage.setItem('snap_cameras', JSON.stringify(updated));
    } else {
      const updated = savedLenses.filter((l) => l !== item);
      setSavedLenses(updated);
      localStorage.setItem('snap_lenses', JSON.stringify(updated));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  // Canvas描画（高速レンダリング）
  useEffect(() => {
    if (!imagePreview) {
      setProcessedImageUrl(null);
      return;
    }

    const img = new Image();
    img.src = imagePreview;
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      const textLines: string[] = [];
      if (showPhotoByOnImage && photoName) textLines.push(`Photo ${photoName}`);
      if (showCameraOnImage && camera) textLines.push(`Cam: ${camera}`);
      if (showLensOnImage && lens) textLines.push(`Lens: ${lens}`);

      if (textLines.length > 0) {
        const fontSize = Math.max(18, Math.floor(img.width * 0.026));
        const padding = fontSize * 0.8;
        const lineHeight = fontSize * 1.3;

        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

        let maxWidth = 0;
        textLines.forEach((line) => {
          const metrics = ctx.measureText(line);
          if (metrics.width > maxWidth) maxWidth = metrics.width;
        });

        const boxWidth = maxWidth + padding * 2;
        const boxHeight = textLines.length * lineHeight + padding * 1.2;

        let x = padding;
        let y = padding;

        if (watermarkPosition.includes('right')) x = img.width - boxWidth - padding;
        if (watermarkPosition.includes('bottom')) y = img.height - boxHeight - padding;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, boxWidth, boxHeight, 10);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, boxWidth, boxHeight);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 6;

        textLines.forEach((line, index) => {
          ctx.fillText(line, x + padding, y + padding + fontSize * 0.9 + index * lineHeight);
        });
      }

      setProcessedImageUrl(canvas.toDataURL('image/jpeg', 0.92));
    };
  }, [imagePreview, camera, lens, photoName, showCameraOnImage, showLensOnImage, showPhotoByOnImage, watermarkPosition]);

  // AIキャプション呼び出し
  const generateCaption = async () => {
    setLoading(true);
    saveHistory('camera', camera);
    saveHistory('lens', lens);
    localStorage.setItem('snap_photo_name', photoName);

    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera, lens, genre, tone, photoName }),
      });

      const data = await res.json();
      if (data.caption) {
        setGeneratedCaption(data.caption);
      } else {
        throw new Error();
      }
    } catch (e) {
      alert('キャプション生成に失敗しました。時間をおいて再試行してください。');
    } finally {
      setLoading(false);
    }
  };

  // スマホ標準共有シート起動
  const handleShare = async () => {
    if (!processedImageUrl) return;
    try {
      const blob = await (await fetch(processedImageUrl)).blob();
      const file = new File([blob], 'snap-report.jpg', { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'SnapReport Photo',
          text: generatedCaption,
        });
      } else {
        const a = document.createElement('a');
        a.href = processedImageUrl;
        a.download = 'snap-report.jpg';
        a.click();
      }
    } catch (e) {
      console.log('Shared cancelled');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans max-w-3xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          SnapReport
        </h1>
        <p className="text-sm text-slate-400 mt-2">SNS映えするキャプション＆ウォーターマーク画像生成</p>
      </header>

      <div className="space-y-6">
        {/* 1. 機材設定 */}
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2">1. 撮影情報</h2>

          {/* カメラ */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">カメラ</label>
            <input
              type="text"
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="例: Canon EOS RP"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 mb-2"
            />
            {/* チップ履歴 */}
            <div className="flex flex-wrap gap-1.5">
              {savedCameras.map((c) => (
                <span
                  key={c}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border ${
                    camera === c ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                  onClick={() => setCamera(c)}
                >
                  {c}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHistory('camera', c);
                    }}
                    className="hover:text-red-400 font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* レンズ */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">レンズ</label>
            <input
              type="text"
              value={lens}
              onChange={(e) => setLens(e.target.value)}
              placeholder="例: Super-Takumar 50mm F1.4"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500 mb-2"
            />
            <div className="flex flex-wrap gap-1.5">
              {savedLenses.map((l) => (
                <span
                  key={l}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border ${
                    lens === l ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                  onClick={() => setLens(l)}
                >
                  {l}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHistory('lens', l);
                    }}
                    className="hover:text-red-400 font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* ジャンル */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">写真のジャンル (文章用)</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200"
            >
              {genreOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Photo表記名 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Photo 表記名</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Photo</span>
              <input
                type="text"
                value={photoName}
                onChange={(e) => setPhotoName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        {/* 2. 写真＆ウォーターマーク */}
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2">2. 写真＆文字入れ</h2>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white cursor-pointer"
          />

          {imagePreview && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPhotoByOnImage}
                    onChange={(e) => setShowPhotoByOnImage(e.target.checked)}
                  />
                  <span>Photo 名</span>
                </label>
                <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCameraOnImage}
                    onChange={(e) => setShowCameraOnImage(e.target.checked)}
                  />
                  <span>カメラ名</span>
                </label>
                <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLensOnImage}
                    onChange={(e) => setShowLensOnImage(e.target.checked)}
                  />
                  <span>レンズ名</span>
                </label>
                <div className="bg-slate-900 p-2 rounded border border-slate-700">
                  <select
                    value={watermarkPosition}
                    onChange={(e) => setWatermarkPosition(e.target.value as any)}
                    className="w-full bg-slate-800 text-white rounded p-1 text-xs"
                  >
                    <option value="bottom-left">左下</option>
                    <option value="bottom-right">右下</option>
                    <option value="top-left">左上</option>
                    <option value="top-right">右上</option>
                  </select>
                </div>
              </div>

              {processedImageUrl && (
                <div className="space-y-2">
                  <img
                    src={processedImageUrl}
                    alt="Processed"
                    className="w-full rounded-lg border border-slate-600 shadow-lg object-contain max-h-96"
                  />
                  <button
                    onClick={handleShare}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2.5 rounded-lg font-bold transition shadow"
                  >
                    📲 共有・写真に保存
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. キャプション設定 */}
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2">3. キャプション生成</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {toneOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                className={`p-3 rounded-lg text-left text-xs font-medium transition border ${
                  tone === opt.value
                    ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={generateCaption}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'AIが思考中...' : generatedCaption ? '🔄 別案を出す' : '✨ キャプションを生成する'}
          </button>
        </section>

        {/* 4. 生成結果 */}
        {generatedCaption && (
          <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h2 className="text-lg font-bold text-slate-200">生成結果 (編集可能)</h2>
              <button
                onClick={handleCopy}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                {copied ? 'コピー完了！' : '📋 コピーする'}
              </button>
            </div>
            <textarea
              value={generatedCaption}
              onChange={(e) => setGeneratedCaption(e.target.value)}
              rows={10}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          </section>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}