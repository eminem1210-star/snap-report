'use client';

import { useState } from 'react';

export default function NewReportPage() {
  const [camera, setCamera] = useState('');
  const [lens, setLens] = useState('');
  const [genre, setGenre] = useState('');
  const [tone, setTone] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [processedImageUrl, setProcessedImageUrl] = useState('');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>新規レポート作成</h1>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>画像:</label>
        <input type="file" accept="image/*" onChange={handleImageUpload} />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>写真タイトル:</label>
        <input
          type="text"
          value={photoName}
          onChange={(e) => setPhotoName(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>カメラ:</label>
        <input
          type="text"
          value={camera}
          onChange={(e) => setCamera(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>レンズ:</label>
        <input
          type="text"
          value={lens}
          onChange={(e) => setLens(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>ジャンル:</label>
        <input
          type="text"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>トーン/雰囲気:</label>
        <input
          type="text"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>

      <button
        onClick={generateCaption}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '生成中...' : 'キャプション生成'}
      </button>

      {generatedCaption && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
          <h3>生成されたキャプション:</h3>
          <p>{generatedCaption}</p>
        </div>
      )}
    </div>
  );
}