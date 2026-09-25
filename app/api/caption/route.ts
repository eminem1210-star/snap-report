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

    // 混雑時（503エラーなど）に自動で最大3回まで再試行する処理
    let response: any = null;
    let retries = 3;
    let lastError: any = null;

    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents,
        });
        break; // 成功したらループを抜ける
      } catch (err: any) {
        lastError = err;
        // 503や429などの混雑・制限エラーの場合のみ少し待ってリトライ
        if (err?.status === 503 || err?.status === 429 || err?.message?.includes('high demand') || err?.message?.includes('Quota exceeded')) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1))); // 2秒、4秒と待機時間を増やす
          continue;
        }
        break; // その他のエラーは即座に中断
      }
    }

    if (!response) {
      throw lastError || new Error('AIモデルへの接続に失敗しました。');
    }

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    console.error('API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。少し時間を置いて再度お試しください。' },
      { status: 500 }
    );
  }
}