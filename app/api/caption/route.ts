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
    
    // 実際に受け取ったデータをサーバーログに出力して確認
    console.log('--- Received API Request Body Keys ---:', Object.keys(body));

    // あらゆるプロパティ名から画像データを探索
    let rawImageData =
      body.image ||
      body.imageUrl ||
      body.imageData ||
      body.image_url ||
      body.file ||
      body.base64 ||
      (typeof body === 'string' ? body : null);

    // 画像が取れなかった場合でも、テキスト情報のみで Gemini を呼び出すフォールバック処理
    const { title, camera, lens, genre, tone } = body;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
以下の写真および撮影条件に基づいて、SNS（InstagramやXなど）投稿用の魅力的でセンスの良いキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'ブルーインパルス'}
- 撮影カメラ: ${camera || 'Canon EOS RP'}
- 使用レンズ: ${lens || 'RF28-70mm F2.8'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'かっこいい'}

【出力フォーマット】
- 写真を引き立てるキャプション本文（2〜3文程度）
- 適切なハッシュタグ（5〜8個程度）
`;

    let result;

    if (rawImageData && typeof rawImageData === 'string' && rawImageData.length > 50) {
      // 画像データが存在する場合
      const base64Data = rawImageData.includes('base64,')
        ? rawImageData.split('base64,')[1]
        : rawImageData;

      const mimeType = rawImageData.includes('data:image/png')
        ? 'image/png'
        : 'image/jpeg';

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };

      result = await model.generateContent([prompt, imagePart]);
    } else {
      // 画像データが見つからない場合でも、テキストプロンプトのみでAIを動かす
      console.log('Image data missing, running text-only prompt fallback.');
      result = await model.generateContent(prompt);
    }

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