import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // 送信されてくる可能性のあるプロパティ名をすべて拾う
    const imageData = body.image || body.imageUrl || body.imageData || body.image_url;
    const { title, camera, lens, genre, tone } = body;

    if (!imageData) {
      return NextResponse.json(
        { error: '画像データが含まれていません。' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Base64データの整形
    const base64Data = typeof imageData === 'string' && imageData.includes('base64,')
      ? imageData.split('base64,')[1]
      : imageData;

    const mimeType = typeof imageData === 'string' && imageData.includes('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const prompt = `
以下の写真および撮影条件に基づいて、SNS投稿用の魅力的でセンスの良いキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'なし'}
- 撮影カメラ: ${camera || '未指定'}
- 使用レンズ: ${lens || '未指定'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'おまかせ'}

【出力フォーマット】
- 写真を引き立てるキャプション本文（2〜3文程度）
- 適切なハッシュタグ（5〜8個程度）
`;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    return NextResponse.json({ caption: responseText });
  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    return NextResponse.json(
      { error: error?.message || 'キャプション生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}