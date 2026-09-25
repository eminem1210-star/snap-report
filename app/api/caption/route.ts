import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが未設定です' }, { status: 500 });
    }

    const { title, camera, lens, genre, tone } = await req.json();
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
以下の写真情報と撮影条件をもとに、Instagramで「いいね」やエンゲージメントが伸びやすい魅力的なキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || '航空写真'}
- カメラ: ${camera || '未指定'}
- レンズ: ${lens || '未指定'}
- ジャンル: ${genre || 'スナップ'}
- トーン: ${tone || 'かっこいい'}

【重要指示】
1. 写真の世界観を引き立てる文章（2〜3文）を作成してください。
2. Instagramで絶対に外せない以下の【必須ハッシュタグ】を必ず含めてください：
   #aviationphotography #飛行機好きな人と繋がりたい #ヒコーキ #ig_airplane_club #hikoki_club
3. その他、カメラ・レンズ・ジャンルに合わせたトレンドのタグを5〜8個ほど追加してください。
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'エラーが発生しました' }, { status: 500 });
  }
}