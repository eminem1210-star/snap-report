import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。' },
        { status: 500 }
      );
    }

    const body = await req.json();

    let rawImageData =
      body.image ||
      body.imageUrl ||
      body.imageData ||
      body.image_url ||
      body.file ||
      body.base64;

    const { title, camera, lens, genre, tone } = body;

    // 最新 SDK の初期化
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
以下の写真および撮影条件に基づいて、SNS（InstagramやXなど）投稿用の魅力的でセンスの良いキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'ブルーインパルス'}
- 撮影カメラ: ${camera || 'Canon EOS RP'}
- 使用レンズ: ${lens || 'RF28-70mm F2.8'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'かっこいい'}

【出力フォーマット】
- 写真を引き立てるキャプション本文（2〜3文程度）
- 適切なハッシュタグ（5〜8個程度）
`;

    let response;

    if (rawImageData && typeof rawImageData === 'string' && rawImageData.length > 50) {
      const base64Data = rawImageData.includes('base64,')
        ? rawImageData.split('base64,')[1]
        : rawImageData;

      const mimeType = rawImageData.includes('data:image/png')
        ? 'image/png'
        : 'image/jpeg';

      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
      });
    } else {
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
    }

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}