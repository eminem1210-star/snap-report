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
    const { title, photographer, camera, lens, genre, tone, showTitle, showCamera, showLens, showPhotographer, image } = body;

    const ai = new GoogleGenAI({ apiKey });

    let displayInfoText = '';
    if (showTitle && title) displayInfoText += `- タイトル/主題: ${title}\n`;
    if (showPhotographer && photographer) displayInfoText += `- 撮影者: ${photographer}\n`;
    if (showCamera && camera) displayInfoText += `- カメラ: ${camera}\n`;
    if (showLens && lens) displayInfoText += `- レンズ: ${lens}\n`;

    const prompt = `
以下の写真情報と撮影条件をもとに、InstagramやSNSで「いいね」やエンゲージメントが伸びやすい魅力的なキャプションを作成してください。

【写真情報】
${displayInfoText || '- 撮影スナップ'}
- ジャンル: ${genre || '鉄道・航空'}
- トーン: ${tone || '爽やか・透明感'}

【重要指示】
1. 写真の世界観や撮影機材の魅力が伝わるエモーショナルでセンスの良い文章（2〜3文）を作成してください。
2. Instagramで絶対に外せない以下の【必須ハッシュタグ】を必ず含めてください：
   #aviationphotography #飛行機好きな人と繋がりたい #ヒコーキ #ig_airplane_club #hikoki_club
3. その他、カメラやレンズ、ジャンルに合わせたトレンドのタグを5〜8個ほど追加してください。
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

    let response: any = null;
    let retries = 3;
    let lastError: any = null;

    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents,
        });
        break;
      } catch (err: any) {
        lastError = err;
        if (err?.status === 503 || err?.status === 429 || err?.message?.includes('high demand') || err?.message?.includes('Quota exceeded')) {
          await new Promise((resolve) => setTimeout(resolve, 3000 * (i + 1)));
          continue;
        }
        break;
      }
    }

    if (!response) {
      const errMessage = lastError?.message || '';
      if (errMessage.includes('Quota exceeded') || errMessage.includes('429')) {
        return NextResponse.json(
          { error: 'APIの利用回数制限（無料枠の上限）に達しました。1分〜数分ほど時間を置いてから再度お試しください。' },
          { status: 429 }
        );
      }
      if (errMessage.includes('high demand') || errMessage.includes('503')) {
        return NextResponse.json(
          { error: '現在AIサーバーが非常に混雑しています（503エラー）。少し時間を置いてから再度お試しください。' },
          { status: 503 }
        );
      }
      throw lastError || new Error('AIモデルへの接続に失敗しました。');
    }

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    console.error('API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}