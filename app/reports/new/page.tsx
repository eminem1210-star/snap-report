'use client';
import { useState, useEffect } from 'react';

const INITIAL_LENS_DATA: { [key: string]: string[] } = {
  'Canon (RFマウント)': [
    'RF28-70mm F2.8 IS STM',
    'RF100-400mm F5.6-8 IS USM',
    'RF24-105mm F4 L IS USM',
    'RF70-200mm F2.8 L IS USM',
    'RF100-500mm F4.5-7.1 L IS USM',
  ],
  'Canon (EFマウント)': [
    'EF24-70mm F2.8L II USM',
    'EF70-200mm F2.8L IS III USM',
    'EF100-400mm F4.5-5.6L IS II USM',
  ],
  'Sony (Eマウント)': [
    'FE 24-70mm F2.8 GM II',
    'FE 70-200mm F2.8 GM OSS II',
    'FE 200-600mm F5.6-6.3 G OSS',
  ],
  'Nikon (Zマウント)': [
    'NIKKOR Z 24-70mm f/2.8 S',
    'NIKKOR Z 180-600mm f/5.6-6.3 VR',
  ],
  'オールドレンズ・その他': [
    'Super-Takumar 55mm F1.8',
    'Yashica Electro 35',
    'Konica C35 EF',
    'RICOH GRレンズ (内蔵)',
  ]
};

const INITIAL_CAMERAS = [
  'Canon EOS RP',
  'Canon EOS 6D',
  'Canon EOS R8',
  'Sony α7 IV',
  'RICOH GR III',
  'RICOH GR IIIx',
  'Minolta α-303si',
];

export default function NewReportPage() {
  const [lensData, setLensData] = useState(INITIAL_LENS_DATA);
  const [cameras, setCameras] = useState(INITIAL_CAMERAS);

  const [selectedMaker, setSelectedMaker] = useState('Canon (RFマウント)');
  const [selectedLens, setSelectedLens] = useState('RF28-70mm F2.8 IS STM');
  const [title, setTitle] = useState('');
  const [photographer, setPhotographer] = useState('オーレリアン二郎');
  const [camera, setCamera] = useState('Canon EOS RP');
  const [genre, setGenre] = useState('鉄道・航空');
  const [tone, setTone] = useState('爽やか・透明感');
  const [userComment, setUserComment] = useState('');
  
  const [showTitle, setShowTitle] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [showLens, setShowLens] = useState(true);
  const [showPhotographer, setShowPhotographer] = useState(true);

  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedLenses = localStorage.getItem('snap_report_custom_lenses');
    if (savedLenses) {
      try { setLensData(JSON.parse(savedLenses)); } catch (e) { console.error(e); }
    }
    const savedCameras = localStorage.getItem('snap_report_custom_cameras');
    if (savedCameras) {
      try { setCameras(JSON.parse(savedCameras)); } catch (e) { console.error(e); }
    }
  }, []);

  const handleMakerChange = (maker: string) => {
    setSelectedMaker(maker);
    setSelectedLens(lensData[maker]?.[0] || '');
  };

  const handleSaveCustomGear = () => {
    if (camera && !cameras.includes(camera)) {
      const updatedCameras = [camera, ...cameras];
      setCameras(updatedCameras);
      localStorage.setItem('snap_report_custom_cameras', JSON.stringify(updatedCameras));
    }

    if (selectedLens && (!lensData[selectedMaker] || !lensData[selectedMaker].includes(selectedLens))) {
      const updatedMakerLenses = [selectedLens, ...(lensData[selectedMaker] || [])];
      const updatedLensData = { ...lensData, [selectedMaker]: updatedMakerLenses };
      setLensData(updatedLensData);
      localStorage.setItem('snap_report_custom_lenses', JSON.stringify(updatedLensData));
    }

    alert('✨ 入力した機材を次から選べるように保存しました！');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        setImage(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadBakedImage = () => {
    const targetSource = image || imagePreview;
    if (!targetSource) {
      alert('⚠️ 先に写真をアップロードしてください。');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = targetSource;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      if (showTitle || showPhotographer || showCamera || showLens) {
        const baseScale = Math.max(canvas.width, canvas.height) / 1000;
        const mainFontSize = Math.round(18 * baseScale);
        const subFontSize = Math.round(13 * baseScale);
        const padding = Math.round(35 * baseScale);

        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        let x = canvas.width - padding;
        let y = canvas.height - padding;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 6 * baseScale;
        ctx.shadowOffsetX = 1 * baseScale;
        ctx.shadowOffsetY = 2 * baseScale;

        if (showTitle && title) {
          ctx.font = `bold ${Math.round(mainFontSize * 0.9)}px sans-serif`;
          ctx.fillStyle = '#67e8f9';
          ctx.fillText(`📌 ${title}`, x, y);
          y -= mainFontSize * 1.3;
        }

        if ((showCamera && camera) || (showLens && selectedLens)) {
          ctx.font = `300 ${subFontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          const subText = [showCamera ? camera : '', showLens ? selectedLens : ''].filter(Boolean).join(' · ');
          ctx.fillText(subText, x, y);
          y -= subFontSize * 1.4;
        }

        if (showPhotographer && photographer) {
          ctx.font = `500 ${mainFontSize}px sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillText(`Shot by ${photographer}`, x, y);
        }
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const link = document.createElement('a');
      link.download = `snap-report-${Date.now()}.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

  const handleGenerate = async () => {
    setLoading(true);
    setCaption('');
    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, photographer, camera, lens: selectedLens, genre, tone,
          userComment,
          showTitle, showCamera, showLens, showPhotographer, image,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'サーバーエラーが発生しました');
      setCaption(data.caption || '');
    } catch (err: any) {
      alert(`キャプション生成のリクエストに失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // テキストをパースしてX用とInstagram用に分離する関数
  const getXCaption = () => {
    if (!caption) return '';
    const parts = caption.split('【Instagram用キャプション】');
    return parts[0].replace('【X用キャプション】', '').trim();
  };

  const getInstaCaption = () => {
    if (!caption) return '';
    const parts = caption.split('【Instagram用キャプション】');
    return parts[1] ? parts[1].trim() : '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
            SNAP REPORT
          </h1>
          <p className="text-sm text-slate-400 mt-1">レポート設定とキャプション自動生成</p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-cyan-400">レポート設定</h2>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">写真アップロード</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer bg-slate-950/50 p-2 rounded-xl border border-slate-800"
            />
          </div>

          {(imagePreview || image) && (
            <div className="mt-2 relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner group">
              <img src={imagePreview || image} alt="Preview" className="w-full max-h-[450px] object-contain" />
              
              {(showTitle || showPhotographer || showCamera || showLens) && (
                <div className="absolute bottom-4 right-4 text-right text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none space-y-0.5">
                  {showPhotographer && photographer && (
                    <p className="text-xs font-medium tracking-wide text-white/95">
                      Shot by {photographer}
                    </p>
                  )}
                  {(showCamera || showLens) && (
                    <p className="text-[10px] text-slate-300 tracking-wider">
                      {[showCamera ? camera : '', showLens ? selectedLens : ''].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {showTitle && title && (
                    <p className="text-[11px] font-bold text-cyan-300 pt-0.5">
                      📌 {title}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleDownloadBakedImage}
                className="absolute top-3 right-3 px-3 py-2 bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer border border-cyan-400/30 z-10"
              >
                📥 撮影データを重ねた画像を保存
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>写真名を表示</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showPhotographer} onChange={(e) => setShowPhotographer(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>撮影者を表示</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showCamera} onChange={(e) => setShowCamera(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>カメラ名を表示</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showLens} onChange={(e) => setShowLens(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>レンズ名を表示</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">写真タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: ブルーインパルスと快晴の空"
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">撮影者名</label>
            <input
              type="text"
              value={photographer}
              onChange={(e) => setPhotographer(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">
              💬 撮影者のこだわり・思い・現場のメモ（任意）
            </label>
            <textarea
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              placeholder="例: 雲ひとつない青空を狙うために早朝からスタンバイしました。"
              rows={3}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 text-sm leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">カメラ</label>
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2"
              >
                {cameras.map((cam) => (
                  <option key={cam} value={cam}>{cam}</option>
                ))}
              </select>
              <input
                type="text"
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                placeholder="直接手入力も可能"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">レンズメーカー</label>
              <select
                value={selectedMaker}
                onChange={(e) => handleMakerChange(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100"
              >
                {Object.keys(lensData).map((maker) => (
                  <option key={maker} value={maker}>{maker}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">レンズ</label>
            <select
              value={selectedLens}
              onChange={(e) => setSelectedLens(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2"
            >
              {lensData[selectedMaker]?.map((lens) => (
                <option key={lens} value={lens}>{lens}</option>
              ))}
            </select>
            <input
              type="text"
              value={selectedLens}
              onChange={(e) => setSelectedLens(e.target.value)}
              placeholder="直接手入力も可能"
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-300 mb-2"
            />
            <button
              onClick={handleSaveCustomGear}
              type="button"
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold rounded-lg transition cursor-pointer"
            >
              💾 この手入力した機材を次回から選べるように保存する
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">ジャンル</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100"
              >
                <option>鉄道・航空</option>
                <option>スナップ</option>
                <option>ポートレート</option>
                <option>風景・ネイチャー</option>
                <option>植物・ガジェット</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">トーン / 雰囲気</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100"
              >
                <option>爽やか・透明感</option>
                <option>かっこいい・重厚感</option>
                <option>エモく・ノスタルジック</option>
                <option>鮮やか・ポップ</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 mt-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            {loading ? '✨ Gemini AIが写真を解析中...' : '✨ キャプションを生成する'}
          </button>
        </div>

        {caption && (
          <div className="space-y-6">
            {/* X用セクション */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h2 className="text-lg font-bold text-cyan-400">X（旧Twitter）用</h2>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl whitespace-pre-wrap text-slate-200 leading-relaxed font-sans">
                {getXCaption()}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(getXCaption())}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition cursor-pointer"
              >
                📋 X用をコピー
              </button>
            </div>

            {/* Instagram用セクション */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h2 className="text-lg font-bold text-cyan-400">Instagram用</h2>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl whitespace-pre-wrap text-slate-200 leading-relaxed font-sans">
                {getInstaCaption()}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(getInstaCaption())}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition cursor-pointer"
              >
                📋 Instagram用をコピー
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}