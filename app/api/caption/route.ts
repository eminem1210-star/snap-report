import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { camera, lens, genre, tone, photoName, imageBase64 } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        caption: `【${genre}】${tone}なひとコマ。✨\n\n一瞬の光を切り取りました。${camera ? `（${camera}）` : ''}\n\n------------------\n${photoName ? `Photo ${photoName}\n` : ''}${camera ? `Cam: ${camera}\n` : ''}${lens ? `Lens: ${lens}\n` : ''}\n#${genre} #ファインダー越しの私の世界 #写真好きな人と繋がりたい`,
      });
    }

    const prompt = `あなたはSNSで人気のプロフォトグラファーです。
ユーザーから提供された写真の情報（機材・ジャンル・雰囲気）をもとに、SNS（InstagramやX/Twitter）で注目を集めるような魅力的で自然な投稿用キャプションを作成してください。

【設定条件】
・文章のトーン: ${tone}
・写真ジャンル: ${genre}
・使用カメラ: ${camera || '未設定'}
・使用レンズ: ${lens || '未設定'}
・撮影者クレジット: ${photoName || '未設定'}

【出力ルール】
1. 指定されたトーン（${tone}）に合わせて、撮影時の情景や想いが伝わる印象的な本文（2〜4文）を作成してください。
2. 読んだ人が共感したりコメントしたくなるような、自然な日本語にしてください。
3. 適度に絵文字や改行を入れて読みやすくしてください。
4. 本文の後に「------------------」で区切りを入れ、撮影クレジット（Photo名, Cam, Lens）を記載してください。
5. 最後にハッシュタグを6〜8個ほど生成してください（例: #写真好きな人と繋がりたい #ファインダー越しの私の世界 など）。`;

    const contents: any[] = [{ parts: [] }];

    // 画像が添付されている場合は画像データも送る
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents[0].parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    contents[0].parts.push({ text: prompt });

    // モデル名を gemini-1.5-flash に指定
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );

    const data = await response.json();

    // APIからエラーが返ってきた場合ログを記録
    if (!response.ok) {
      console.error('Gemini API Error:', data);
      throw new Error(data.error?.message || 'API request failed');
    }

    const caption = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!caption) throw new Error('No caption generated');

    return NextResponse.json({ caption });
  } catch (error: any) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate caption' },
      { status: 500 }
    );
  }
}