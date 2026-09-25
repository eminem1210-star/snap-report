'use client';
import { useState } from 'react';

// メーカーごとの豊富なレンズデータ（リクエストいただいたRF100-400等も追加）
const LENS_DATA: { [key: string]: string[] } = {
  'Canon (RFマウント)': [
    'RF28-70mm F2.8 IS STM',
    'RF100-400mm F5.6-8 IS USM',
    'RF24-105mm F4 L IS USM',
    'RF70-200mm F2.8 L IS USM',
    'RF100-500mm F4.5-7.1 L IS USM',
    'RF200-800mm F6.3-9 IS USM',
    'RF50mm F1.8 STM',
    'RF35mm F1.8 Macro IS STM',
  ],
  'Canon (EFマウント)': [
    'EF24-70mm F2.8L II USM',
    'EF70-200mm F2.8L IS III USM',
    'EF100-400mm F4.5-5.6L IS II USM',
    'EF400mm F5.6L USM',
    'EF50mm F1.8 STM',
  ],
  'Sony (Eマウント)': [
    'FE 24-70mm F2.8 GM II',
    'FE 70-200mm F2.8 GM OSS II',
    'FE 200-600mm F5.6-6.3 G OSS',
    'FE 70-300mm F4.5-5.6 G OSS',
    'FE 50mm F1.4 GM',
    'E 18-135mm F3.5-5.6 OSS',
  ],
  'Nikon (Zマウント)': [
    'NIKKOR Z 24-70mm f/2.8 S',
    'NIKKOR Z 70-200mm f/2.8 VR S',
    'NIKKOR Z 180-600mm f/5.6-6.3 VR',
    'NIKKOR Z 100-400mm f/4.5-5.6 VR S',
    'NIKKOR Z 40mm f/2',
  ],
  'Fujifilm (Xマウント)': [
    'XF16-55mmF2.8 R LM WR',
    'XF50-140mmF2.8 R LM OIS WR',
    'XF150-600mmF5.6-8 R LM OIS WR',
    'XF35mmF1.4 R',
    'XF27mmF2.8 R WR',
  ],
  'Tamron / Sigma / その他': [
    'タムロン 150-500mm F/5-6.7 Di III VC VXD',
    'タムロン 50-400mm F/4.5-6.3 Di III VC VXD',
    'シグマ 60-600mm F4.5-6.3 DG DN OS | Sports',
    'シグマ 150-600mm F5-6.3 DG OS HSM',
  ],
  'オールドレンズ・コンパクト': [
    'Super-Takumar 55mm F1.8',
    'Super-Takumar 135mm F2.5',
    'Yashica Electro 35 (CC/GSN)',
    'Konica C35 EF',
    'RICOH GRレンズ (内蔵)',
  ]
};

// 豊富なカメラ選択肢（RICOH GRや各種モデルを追加）
const CAMERA_OPTIONS = [
  'Canon EOS RP',
  'Canon EOS 6D',
  'Canon EOS R3',
  'Canon EOS R5 / R5 Mark II',
  'Canon EOS R6 Mark II',
  'Canon EOS R7',
  'Canon EOS R8',
  'Sony α7 IV',
  'Sony α7R V',
  'Sony α1',
  'Nikon Z8',
  'Nikon Z6III',
  'Fujifilm X-T5',
  'Fujifilm X-H2',
  'RICOH GR III',
  'RICOH GR IIIx',
  'Minolta α-303si (フィルム)',
  'Yashica Electro 35 (フィルム)',
  'Konica C35 EF (フィルム)',
  'その他カメラ'
];

export default function NewReportPage() {
  const [selectedMaker, setSelectedMaker] = useState('Canon (RFマウント)');
  const [selectedLens, setSelectedLens] = useState('RF28-70mm F2.8 IS STM');
  const [title, setTitle] = useState('');
  const [photographer, setPhotographer] = useState('深見 さら');
  const [camera, setCamera] = useState('Canon EOS RP');
  const [genre, setGenre] = useState('鉄道・航空');
  const [tone, setTone] = useState('爽やか・透明感');
  
  const [showTitle, setShowTitle] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [showLens, setShowLens] = useState(true);
  const [showPhotographer, setShowPhotographer] = useState(true);

  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMakerChange = (maker: string) => {
    setSelectedMaker(maker);
    setSelectedLens(LENS_DATA[maker]?.[0] || '');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        setImage(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setCaption('');
    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          photographer,
          camera,
          lens: selectedLens,
          genre,
          tone,
          showTitle,
          showCamera,
          showLens,
          showPhotographer,
          image,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'サーバーエラーが発生しました');
      }
      setCaption(data.caption || '生成に失敗しました。');
    } catch (err: any) {
      alert(`キャプション生成のリクエストに失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
            SNAP REPORT
          </h1>
          <p className="text-sm text-slate-400 mt-1">レポート設定とキャプション自動生成（拡張版）</p>
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

          {imagePreview && (
            <div className="mt-2 relative w-full h-64 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
              <img src={imagePreview} alt="Preview" className="h-full object-contain" />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>写真名</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showPhotographer} onChange={(e) => setShowPhotographer(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>撮影者</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showCamera} onChange={(e) => setShowCamera(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>カメラ名</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showLens} onChange={(e) => setShowLens(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>レンズ名</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">カメラ（選択または直接入力）</label>
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2"
              >
                {CAMERA_OPTIONS.map((cam) => (
                  <option key={cam} value={cam}>{cam}</option>
                ))}
              </select>
              <input
                type="text"
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
                placeholder="直接入力も可能"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">レンズメーカー / 系統</label>
              <select
                value={selectedMaker}
                onChange={(e) => handleMakerChange(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100"
              >
                {Object.keys(LENS_DATA).map((maker) => (
                  <option key={maker} value={maker}>{maker}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">レンズ（詳細）</label>
            <select
              value={selectedLens}
              onChange={(e) => setSelectedLens(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2"
            >
              {LENS_DATA[selectedMaker]?.map((lens) => (
                <option key={lens} value={lens}>{lens}</option>
              ))}
            </select>
            <input
              type="text"
              value={selectedLens}
              onChange={(e) => setSelectedLens(e.target.value)}
              placeholder="リストにない場合はここに直接入力できます"
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-300"
            />
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <h2 className="text-lg font-bold text-cyan-400">生成されたキャプション</h2>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl whitespace-pre-wrap text-slate-200 leading-relaxed font-sans">
              {caption}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(caption)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition cursor-pointer"
            >
              📋 クリップボードにコピー
            </button>
          </div>
        )}
      </div>
    </div>
  );
}