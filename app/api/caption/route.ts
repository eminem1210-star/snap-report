import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { camera, lens, genre, tone, photoName, imageBase64 } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が環境変数に設定されていません。' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
あなたはプロの写真家兼SNSプロデューサーです。
提供された画像と以下の撮影データをもとに、InstagramやX(Twitter)で目を引く最高におしゃれな写真キャプションを生成してください。

【撮影・写真データ】
- 写真タイトル: ${photoName || '未指定'}
- カメラ: ${camera || '未指定'}
- レンズ: ${lens || '未指定'}
- ジャンル: ${genre || '未指定'}
- トーン/雰囲気: ${tone || '未指定'}

【指示】
1. 画像に写っている被写体、構図、色合い、光の入り方を深く観察して文章に反映してください。
2. 雰囲気が「${tone}」にぴったり合うような言葉遣いや絵文字を選んでください。
3. 出力フォーマットは以下の構成にしてください：

【タイトル・キャッチコピー】（絵文字を含めた印象的な短文）
【本文】（画像に写っているものの表現と感情を込めた2〜3行の描写）

------------------
Photo: ${photoName || 'タイトルなし'}
Cam: ${camera}
Lens: ${lens}

#${genre} #${tone.replace(/・/g, '')} #ファインダー越しの私の世界 #写真好きな人と繋がりたい
`;

    const contents: any[] = [prompt];

    if (imageBase64 && imageBase64.includes('base64,')) {
      const base64Data = imageBase64.split('base64,')[1];
      const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';

      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      });
    }

    const result = await model.generateContent(contents);
    const responseText = result.response.text();

    return NextResponse.json({ caption: responseText });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      { error: error.message || 'キャプションの生成中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}