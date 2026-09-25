import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

// 試行するモデルの候補リスト（新しい順）
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

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
- 写真を引き立てるキャプション本文（2〜3文程度）
- 適切なハッシュタグ（5〜8個程度）
`;

    let responseText = '';
    let lastError = null;

    // 利用可能なモデルを順番に試す
    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`Trying model: ${modelName}`);

        if (rawImageData && typeof rawImageData === 'string' && rawImageData.length > 50) {
          const base64Data = rawImageData.includes('base64,')
            ? rawImageData.split('base64,')[1]
            : rawImageData;

          const mimeType = rawImageData.includes('data:image/png')
            ? 'image/png'
            : 'image/jpeg';

          const res = await ai.models.generateContent({
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
          responseText = res.text || '';
        } else {
          const res = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });
          responseText = res.text || '';
        }

        // 成功したらループを抜ける
        if (responseText) {
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} failed:`, err?.message || err);
        lastError = err;
        // 404 等のエラーの場合は次の候補モデルを試す
      }
    }

    if (!responseText) {
      throw lastError || new Error('すべての Gemini モデルの呼び出しに失敗しました。');
    }

    return NextResponse.json({ caption: responseText });
  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}