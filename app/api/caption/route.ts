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
      body.base64 ||
      body.photo;

    const ai = new GoogleGenAI({ apiKey });

    // タイトルや設定を反映させ、ミスマッチな文章を防ぐ専用プロンプト
    const prompt = `
あなたはプロのカメラマン兼SNS運用担当者です。
以下の写真情報と撮影条件をもとに、SNS投稿用の魅力的でセンスの良いキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'ブルーインパルス'}
- 撮影カメラ: ${camera || 'Canon EOS RP'}
- 使用レンズ: ${lens || 'RF28-70mm F2.8'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'かっこいい'}

【重要指示】
- タイトルや被写体（飛行機、空、風景など）の文脈を確実に汲み取り、街並みなど矛盾する情景を勝手に作り出さないこと。
- 写真の魅力が最大限伝わる臨場感のあるキャプション本文（2〜3文程度）を作成してください。
- 適切なハッシュタグ（5〜8個程度）を最後に添えてください。
`;

    const primaryModel = 'gemini-3.8-flash';
    const fallbackModel = 'gemini-3.5-flash-lite';

    let response;

    const generateWithModel = async (modelName: string) => {
      // 画像データが確実に取得できている場合のみマルチモーダルで送信
      if (rawImageData && typeof rawImageData === 'string' && rawImageData.length > 100) {
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
        // 画像がない、または形式が合わない場合はテキスト（タイトル・機材情報）を主軸に生成
        return await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
      }
    };

    try {
      response = await generateWithModel(primaryModel);
    } catch (primaryErr: any) {
      console.warn(`Primary model failed, falling back to ${fallbackModel}:`, primaryErr?.message);
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