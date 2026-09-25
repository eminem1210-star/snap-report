import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 環境変数から API キーを取得
const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。' },
        { status: 500 }
      );
    }

    const { image, title, camera, lens, genre, tone } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: '画像データが含まれていません。' },
        { status: 400 }
      );
    }

    // GoogleGenerativeAI の初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 安定稼働モデルの指定
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Base64画像の整形処理
    const base64Data = image.includes('base64,')
      ? image.split('base64,')[1]
      : image;

    const mimeType = image.includes('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    // プロンプトの構築
    const prompt = `
以下の写真および撮影条件に基づいて、SNS（InstagramやXなど）投稿用の魅力的で魅力的なキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'なし'}
- 撮影カメラ: ${camera || '未指定'}
- 使用レンズ: ${lens || '未指定'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'おまかせ'}

【出力フォーマット】
- 写真を引き立てるキャプション本文（2〜3文程度）
- 適切なハッシュタグ（5〜8個程度）

自然でセンスのある日本語で出力してください。
`;

    // API呼び出し
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