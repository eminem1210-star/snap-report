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
    const { title, camera, lens, genre, tone, image } = body;

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
以下の写真情報と撮影条件をもとに、InstagramやSNSで「いいね」やエンゲージメントが伸びやすい魅力的なキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || '航空写真・スナップ'}
- カメラ: ${camera || 'Canon EOS RP'}
- レンズ: ${lens || '未指定'}
- ジャンル: ${genre || '鉄道・航空'}
- トーン: ${tone || 'かっこいい'}

【重要指示】
1. 写真の世界観や撮影機材の魅力が伝わるエモーショナルでセンスの良い文章（2〜3文）を作成してください。
2. Instagramで絶対に外せない以下の【必須ハッシュタグ】を必ず含めてください：
   #aviationphotography #飛行機好きな人と繋がりたい #ヒコーキ #ig_airplane_club #hikoki_club
3. その他、カメラ（${camera}）、レンズ（${lens}）、ジャンル（${genre}）に合わせたトレンドのタグを5〜8個ほど追加してください。
`;

    let contents: any = prompt;
    if (image && typeof image === 'string' && image.length > 100) {
      const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
      const mimeType = image.includes('data:image/png') ? 'image/png' : 'image/jpeg';

      contents = [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
      ];
    }

    // Googleが推奨する最新の gemini-3.8-flash を使用
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
    });

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    console.error('API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}