import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

// 混雑時（503等）に自動で数回リトライするヘルパー関数
async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 3, delay = 1500): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent(params);
      if (response) {
        return response;
      }
    } catch (error: any) {
      const isOverloaded = 
        error?.status === 503 || 
        error?.code === 503 || 
        error?.message?.includes('high demand') ||
        error?.message?.includes('UNAVAILABLE');

      if (isOverloaded && i < retries - 1) {
        // 少し待ってから再試行（1.5秒、3秒...と待機時間を増やす）
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('モデルからの応答を取得できませんでした。');
}

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

    // 表示項目の指定をプロンプトに反映
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

    // リトライ機能付きでモデルを呼び出し
    const response = await generateWithRetry(ai, {
      model: 'gemini-3.8-flash',
      contents: contents,
    });

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    console.error('API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。しばらく待ってから再度お試しください。' },
      { status: 500 }
    );
  }
}