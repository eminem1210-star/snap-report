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
        imageBase64: processedImageUrl, // 画像データ（Base64）
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