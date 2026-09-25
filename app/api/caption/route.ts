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
    let lastError: any = null;
    const maxRetries = 3;

    // 混雑エラー（503や429）が発生した場合に自動で数秒空けて再試行するループ
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: contents,
        });
        break; // 成功したらループを抜ける
      } catch (err: any) {
        lastError = err;
        const errStr = JSON.stringify(err);
        // 503 (UNAVAILABLE) または 429 (TooManyRequests / high demand) の場合のみリトライ
        if (errStr.includes('503') || errStr.includes('429') || errStr.includes('high demand') || errStr.includes('UNAVAILABLE')) {
          if (attempt < maxRetries) {
            // 試行回数に応じて待機時間を長くする（2秒、4秒…）
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
            continue;
          }
        }
        break; // その他のエラーやリトライ回数上限ならループ終了
      }
    }

    if (!response) {
      const errMessage = lastError?.message || JSON.stringify(lastError);
      if (errMessage.includes('503') || errMessage.includes('high demand') || errMessage.includes('UNAVAILABLE')) {
        return NextResponse.json(
          { error: '現在AIサーバーが非常に混雑しています。少し時間（1〜2分）を置いてから再度お試しください。' },
          { status: 503 }
        );
      }
      if (errMessage.includes('429') || errMessage.includes('Quota exceeded')) {
        return NextResponse.json(
          { error: 'APIの利用回数制限に達しました。少し時間を置いてから再度お試しください。' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `キャプション生成中にエラーが発生しました: ${errMessage}` },
        { status: 500 }
      );
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