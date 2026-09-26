import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, photographer, camera, lens, genre, tone, userComment, image } = body;

    const prompt = `
以下の条件と写真情報を元に、SNSに投稿するためのキャプションを「X（旧Twitter）用」と「Instagram用」の2つ作成してください。

- 写真タイトル: ${title || 'なし'}
- 撮影者: ${photographer || 'オーレリアン二郎'}
- カメラ: ${camera || 'なし'}
- レンズ: ${lens || 'なし'}
- ジャンル: ${genre || 'スナップ'}
- トーン・雰囲気: ${tone || '爽やか・透明感'}
- 撮影者のこだわり・思い・メモ: ${userComment || 'なし'}

条件:
1. 必ず以下の見出しをつけて出力してください。
【X用キャプション】
（ここにX用を作成。文字数やインプレッションを意識し、ハッシュタグは3〜5個程度）

【Instagram用キャプション】
（ここにInstagram用を作成。世界観をしっかり伝え、ハッシュタグは上限の範囲内で関連性の高いものを15〜20個程度つけてください）

2. 挨拶や説明などの余計なテキストは一切含めず、出力結果のキャプションのみを返してください。
`;

    const contents: any[] = [prompt];

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg',
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
    });

    return NextResponse.json({ caption: response.text });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: `キャプション生成中にエラーが発生しました: ${error.message}` },
      { status: 500 }
    );
  }
}