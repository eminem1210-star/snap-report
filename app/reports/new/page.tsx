'use client';
import { useState } from 'react';

// メーカーごとのレンズデータ
const LENS_DATA: { [key: string]: string[] } = {
  'Canon (RFマウント)': [
    'RF28-70mm F2.8 IS STM',
    'RF24-105mm F4 L IS USM',
    'RF70-200mm F2.8 L IS USM',
    'RF100-500mm F4.5-7.1 L IS USM',
    'RF50mm F1.8 STM',
  ],
  'Canon (EFマウント)': [
    'EF24-70mm F2.8L II USM',
    'EF70-200mm F2.8L IS III USM',
    'EF100-400mm F4.5-5.6L IS II USM',
    'EF50mm F1.8 STM',
  ],
  'Sony (Eマウント)': [
    'FE 24-70mm F2.8 GM II',
    'FE 70-200mm F2.8 GM OSS II',
    'FE 200-600mm F5.6-6.3 G OSS',
    'FE 50mm F1.4 GM',
  ],
  'Nikon (Zマウント)': [
    'NIKKOR Z 24-70mm f/2.8 S',
    'NIKKOR Z 70-200mm f/2.8 VR S',
    'NIKKOR Z 180-600mm f/5.6-6.3 VR',
  ],
  'Tamron / Sigma (汎用)': [
    'タムロン 150-500mm F/5-6.7 Di III VC VXD',
    'シグマ 60-600mm F4.5-6.3 DG DN OS | Sports',
    'シグマ 150-600mm F5-6.3 DG OS HSM',
  ],
  'オールドレンズ・その他': [
    'Super-Takumar 55mm F1.8',
    'Yashica Electro 35 (CC/GSN)',
    'Konica C35 EF',
    'その他オールドレンズ',
  ]
};

export default function NewReportPage() {
  const [selectedMaker, setSelectedMaker] = useState('Canon (RFマウント)');
  const [selectedLens, setSelectedLens] = useState('RF28-70mm F2.8 IS STM');
  const [title, setTitle] = useState('');
  const [camera, setCamera] = useState('Canon EOS RP');
  const [genre, setGenre] = useState('鉄道・航空');
  const [tone, setTone] = useState('爽やか・透明感');
  const [image, setImage] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMakerChange = (maker: string) => {
    setSelectedMaker(maker);
    setSelectedLens(LENS_DATA[maker]?.[0] || '');
  };

  // 容量オーバー（413エラー）を防ぐため、画像を読み込む際に自動で縮小する処理
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        
        // 圧縮したBase64データをセット
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
          camera,
          lens: selectedLens,
          genre,
          tone,
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
    <div className="p-6 max-w-2xl mx-auto text-white">
      <h1 className="text-xl font-bold mb-4">SNAP REPORT - キャプション生成</h1>

      {/* 画像アップロード */}
      <label className="block mb-2">写真アップロード</label>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="w-full p-2 bg-gray-800 rounded mb-4"
      />

      {/* タイトル */}
      <label className="block mb-2">写真タイトル</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例: ブルーインパルスと快晴の空"
        className="w-full p-2 bg-gray-800 rounded mb-4"
      />

      {/* カメラ選択 */}
      <label className="block mb-2">撮影カメラ</label>
      <select
        value={camera}
        onChange={(e) => setCamera(e.target.value)}
        className="w-full p-2 bg-gray-800 rounded mb-4"
      >
        <option>Canon EOS RP</option>
        <option>Canon EOS 6D</option>
        <option>Google Pixel 9a</option>
      </select>

      {/* メーカー選択 */}
      <label className="block mb-2">レンズメーカー</label>
      <select
        value={selectedMaker}
        onChange={(e) => handleMakerChange(e.target.value)}
        className="w-full p-2 bg-gray-800 rounded mb-4"
      >
        {Object.keys(LENS_DATA).map((maker) => (
          <option key={maker} value={maker}>{maker}</option>
        ))}
      </select>

      {/* レンズ選択（メーカーに連動） */}
      <label className="block mb-2">使用レンズ</label>
      <select
        value={selectedLens}
        onChange={(e) => setSelectedLens(e.target.value)}
        className="w-full p-2 bg-gray-800 rounded mb-4"
      >
        {LENS_DATA[selectedMaker]?.map((lens) => (
          <option key={lens} value={lens}>{lens}</option>
        ))}
      </select>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold mb-6"
      >
        {loading ? 'Gemini AIが写真を解析中...' : 'キャプションを生成する'}
      </button>

      {caption && (
        <div className="p-4 bg-gray-900 rounded border border-gray-700 whitespace-pre-wrap">
          {caption}
        </div>
      )}
    </div>
  );
}