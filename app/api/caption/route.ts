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

    const { title, camera, lens, genre, tone } = body;
    let rawImageData =
      body.image ||
      body.imageUrl ||
      body.imageData ||
      body.image_url ||
      body.file ||
      body.base64;

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
以下の写真および撮影条件に基づいて、SNS投稿用の魅力的でセンスの良いキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'なし'}
- 撮影カメラ: ${camera || '未指定'}
- 使用レンズ: ${lens || '未指定'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'かっこいい'}

【出力フォーマット】
- 写真を引き立てるキャプション本文(2〜3文程度)
- 適切なハッシュタグ(5〜8個程度)
`;

    const primaryModel = 'gemini-3.8-flash';
    const fallbackModel = 'gemini-3.5-flash-lite'; // 正しいLiteモデルを指定

    let response;

    const generateWithModel = async (modelName: string) => {
      if (rawImageData && typeof rawImageData === 'string' && rawImageData.length > 50) {
        const base64Data = rawImageData.includes('base64,')
          ? rawImageData.split('base64,')[1]
          : rawImageData;

        const mimeType = rawImageData.includes('data:image/png')
          ? 'image/png'
          : 'image/jpeg';

        return await ai.models.generateContent({
          model: modelName,
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
        return await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
      }
    };

    try {
      // メインの最新高精度モデルで実行
      response = await generateWithModel(primaryModel);
    } catch (primaryErr: any) {
      console.warn(`Primary model ${primaryModel} failed, falling back to ${fallbackModel}:`, primaryErr?.message);
      // 混雑や一時的エラーの場合は軽量フォールバックモデルで自動再試行
      response = await generateWithModel(fallbackModel);
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