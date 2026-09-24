'use client';

import React, { useState, useEffect, useRef } from 'react';

// 保存用の型定義
type SavedItem = string;

export default function SnapReportPage() {
  // 入力ステート
  const [camera, setCamera] = useState('');
  const [lens, setLens] = useState('');
  const [tone, setTone] = useState('フランク・気さく');
  const [photoName, setPhotoName] = useState('オーレリアン二郎');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ウォーターマーク（画像文字入れ）設定
  const [showCameraOnImage, setShowCameraOnImage] = useState(true);
  const [showLensOnImage, setShowLensOnImage] = useState(true);
  const [showPhotoByOnImage, setShowPhotoByOnImage] = useState(true);
  const [watermarkPosition, setWatermarkPosition] = useState<'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'>('bottom-left');
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  // 履歴保持 (LocalStorage)
  const [savedCameras, setSavedCameras] = useState<SavedItem[]>([]);
  const [savedLenses, setSavedLenses] = useState<SavedItem[]>([]);

  // 生成結果
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // トーンの選択肢
  const toneOptions = [
    { label: '🤩 テンション高め・ポップ', value: 'テンション高め・ポップ' },
    { label: '☕️ フランク・気さく', value: 'フランク・気さく' },
    { label: '🔥 エッジの効いた一言 (インパクト重視)', value: 'インパクト・キャッチー' },
    { label: '🎬 撮影裏話・エピソード風', value: '撮影裏話風' },
    { label: '📷 真面目・エモい・写真集風', value: '真面目・エモい' },
  ];

  // 初回読み込み時にLocalStorageから履歴取得
  useEffect(() => {
    const cameras = JSON.parse(localStorage.getItem('snap_cameras') || '[]');
    const lenses = JSON.parse(localStorage.getItem('snap_lenses') || '[]');
    setSavedCameras(cameras);
    setSavedLenses(lenses);
  }, []);

  // 画像が選択されたとき
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  // カメラ・レンズの保存処理
  const saveCustomItem = (type: 'camera' | 'lens', value: string) => {
    if (!value.trim()) return;
    if (type === 'camera') {
      if (!savedCameras.includes(value)) {
        const updated = [...savedCameras, value];
        setSavedCameras(updated);
        localStorage.setItem('snap_cameras', JSON.stringify(updated));
      }
    } else {
      if (!savedLenses.includes(value)) {
        const updated = [...savedLenses, value];
        setSavedLenses(updated);
        localStorage.setItem('snap_lenses', JSON.stringify(updated));
      }
    }
  };

  // キャンバス描画（画像へ文字を合成）
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

      // 画像を描画
      ctx.drawImage(img, 0, 0);

      // 表示するテキストの組み立て
      const textLines: string[] = [];
      if (showPhotoByOnImage && photoName) textLines.push(`Photo ${photoName}`);
      if (showCameraOnImage && camera) textLines.push(`Cam: ${camera}`);
      if (showLensOnImage && lens) textLines.push(`Lens: ${lens}`);

      if (textLines.length > 0) {
        // フォントサイズを画像解像度に合わせて自動調整
        const fontSize = Math.max(16, Math.floor(img.width * 0.025));
        const padding = fontSize * 0.8;
        const lineHeight = fontSize * 1.3;

        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

        // テキストブロックの幅と高さを計算
        let maxWidth = 0;
        textLines.forEach((line) => {
          const metrics = ctx.measureText(line);
          if (metrics.width > maxWidth) maxWidth = metrics.width;
        });

        const boxWidth = maxWidth + padding * 2;
        const boxHeight = textLines.length * lineHeight + padding * 1.2;

        // 配置座標の計算
        let x = padding;
        let y = padding;

        if (watermarkPosition.includes('right')) {
          x = img.width - boxWidth - padding;
        }
        if (watermarkPosition.includes('bottom')) {
          y = img.height - boxHeight - padding;
        }

        // 半透明背景（読みやすさ向上）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.roundRect ? ctx.roundRect(x, y, boxWidth, boxHeight, 8) : ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.fill();

        // 文字の描画
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;

        textLines.forEach((line, index) => {
          ctx.fillText(line, x + padding, y + padding + fontSize * 0.9 + index * lineHeight);
        });
      }

      setProcessedImageUrl(canvas.toDataURL('image/jpeg', 0.92));
    };
  }, [imagePreview, camera, lens, photoName, showCameraOnImage, showLensOnImage, showPhotoByOnImage, watermarkPosition]);

  // AIキャプション生成処理
  const generateCaption = async () => {
    setLoading(true);
    saveCustomItem('camera', camera);
    saveCustomItem('lens', lens);

    try {
      // 選択トーンに応じたプロンプト指示
      const promptText = `
あなたはSNS（InstagramやX）で目を引く写真投稿を作るプロのWebライターです。
以下の写真情報をもとに、思わず「いいね」やコメントをしたくなるような印象的なキャプション（投稿本文）を作成してください。

【撮影情報】
・カメラ: ${camera || '未設定'}
・レンズ: ${lens || '未設定'}
・雰囲気/トーン: ${tone}
・フォトグラファー: ${photoName ? `Photo ${photoName}` : '未設定'}

【トーン＆書き方のルール】
・指定されたトーン（${tone}）の雰囲気をしっかり出してください。
・冒頭の1行目はタイムラインで目を引くインパク知のあるフック（強いフレーズ）にしてください。
・ダラダラ書かず、テンポ良く読める改行や箇条書きを活用してください。
・絵文字を適度に使って見栄え良くしてください。
・末尾には写真・カメラ・雰囲気に合ったハッシュタグを6〜10個ほど付けてください。
      `;

      // API呼び出し (ダミーまたはGemini API連携)
      // ここではプロンプト動作のイメージを出力します
      await new Promise((resolve) => setTimeout(resolve, 1500));

      let mockOutput = '';
      if (tone === 'インパクト・キャッチー') {
        mockOutput = `世界が息をのんだ瞬間、切り取ってみた。🔥\n\n一瞬の光と影のグラデーション。やっぱり ${camera || 'このカメラ'} と ${lens || 'このレンズ'} の組み合わせは反則級の描写力…！\n\nあなたはこの雰囲気、好きですか？ぜひコメントで教えてください👇\n\n------------------\nPhoto ${photoName}\nCam: ${camera}\nLens: ${lens}\n\n#写真好きな人と繋がりたい #ファインダー越しの私の世界 #カメラ男子 #カメラ女子 #写真部 #キリトリセカイ #${camera.replace(/\s+/g, '')}`;
      } else if (tone === 'テンション高め・ポップ') {
        mockOutput = `ちょっと待って、凄すぎる写真撮れちゃった！！📸✨\n\nシャッター切った瞬間「勝った」って叫びそうになった件（笑）\n${camera || 'お気に入りカメラ'} の色味が天才すぎてテンション爆上がりです最高🙌最高🙌\n\nみんなも今日一日お疲れ様でした〜！✨\n\n------------------\nPhoto ${photoName}\n#日常を彩る #カメラ散歩 #写真で伝えたい私の世界 #${camera.replace(/\s+/g, '')}`;
      } else {
        mockOutput = `日常の隙間に潜む、特別な光。✨\n\nふとした瞬間に惹かれてシャッターを切りました。${lens || 'このレンズ'} 独特のやわらかい空気感が心地いい。\n\n今日も良い一日になりますように。\n\n------------------\nPhoto ${photoName}\nCam: ${camera}\nLens: ${lens}\n\n#ファインダー越しの私の世界 #スナップ写真 #エモい写真 #東京カメラ部`;
      }

      setGeneratedCaption(mockOutput);
    } catch (e) {
      alert('生成に失敗しました。');
    } finally {
      setLoading(false);
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
          SnapReport AI
        </h1>
        <p className="text-sm text-slate-400 mt-2">SNS映えするキャプション＆ウォーターマーク画像生成</p>
      </header>

      <div className="space-y-6">
        {/* 1. 機材・フォトグラファー設定 */}
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2">1. 撮影情報</h2>
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">カメラ</label>
            <input
              type="text"
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="例: Canon EOS RP / Yashica Electro 35"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              list="camera-history"
            />
            <datalist id="camera-history">
              {savedCameras.map((item, i) => (
                <option key={i} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">レンズ</label>
            <input
              type="text"
              value={lens}
              onChange={(e) => setLens(e.target.value)}
              placeholder="例: Super-Takumar 50mm F1.4 / RF24-105mm"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              list="lens-history"
            />
            <datalist id="lens-history">
              {savedLenses.map((item, i) => (
                <option key={i} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Photo 表記名</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Photo</span>
              <input
                type="text"
                value={photoName}
                onChange={(e) => setPhotoName(e.target.value)}
                placeholder="オーレリアン二郎"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        {/* 2. 写真＆ウォーターマーク設定 */}
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2">2. 写真＆文字入れ（ウォーターマーク）</h2>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
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
                  <span>Photo 名を入れる</span>
                </label>
                <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCameraOnImage}
                    onChange={(e) => setShowCameraOnImage(e.target.checked)}
                  />
                  <span>カメラ名を入れる</span>
                </label>
                <label className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLensOnImage}
                    onChange={(e) => setShowLensOnImage(e.target.checked)}
                  />
                  <span>レンズ名を入れる</span>
                </label>
                <div className="bg-slate-900 p-2 rounded border border-slate-700">
                  <span className="block text-slate-400 mb-1">表示位置</span>
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

              {/* プレビュー＆保存画像 */}
              {processedImageUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-400 font-semibold">✨ 文字入れ済み画像（長押しで保存可能）:</p>
                  <img
                    src={processedImageUrl}
                    alt="Processed"
                    className="w-full rounded-lg border border-slate-600 shadow-lg object-contain max-h-96"
                  />
                  <a
                    href={processedImageUrl}
                    download="snap-report.jpg"
                    className="inline-block w-full text-center bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded-lg font-medium transition"
                  >
                    📥 文字入れ画像をダウンロード
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. トーン＆AI生成 */}
        <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-slate-200 border-b border-slate-700 pb-2">3. AIキャプション設定</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">キャプションの雰囲気（トーン）</label>
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
          </div>

          <button
            onClick={generateCaption}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'AIが生成中...' : '✨ 目を引くコメントを生成する'}
          </button>
        </section>

        {/* 4. 結果表示＆コピー */}
        {generatedCaption && (
          <section className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h2 className="text-lg font-bold text-slate-200">完成したキャプション</h2>
              <button
                onClick={handleCopy}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                {copied ? 'コピー完了！' : '📋 コピーする'}
              </button>
            </div>
            <textarea
              readOnly
              value={generatedCaption}
              rows={10}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 leading-relaxed focus:outline-none"
            />
          </section>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}