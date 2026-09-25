import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { camera, lens, genre, tone, photoName } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;

    // APIキーがない場合のバックアップ（フォールバック）
    if (!apiKey) {
      return NextResponse.json({
        caption: `【${genre}】${tone}なひとコマ。✨\n\n一瞬の光を切り取りました。${camera ? `（${camera}）` : ''}\n\n------------------\n${photoName ? `Photo ${photoName}\n` : ''}${camera ? `Cam: ${camera}\n` : ''}${lens ? `Lens: ${lens}\n` : ''}\n#${genre} #ファインダー越しの私の世界 #写真好きな人と繋がりたい`,
      });
    }

    const prompt = `あなたはSNS（Instagram/X）で大人気のフォトグラファー兼ライターです。
以下の情報をもとに、投稿を見た人が思わず「いいね」したくなるような、目を引くSNSキャプションを作成してください。

【撮影情報】
・カメラ: ${camera || '指定なし'}
・レンズ: ${lens || '指定なし'}
・写真ジャンル: ${genre}
・指示トーン: ${tone}
・クレジット: ${photoName ? `Photo ${photoName}` : '指定なし'}

【作成ルール】
1. 冒頭1行目はスクロールを止める強いフック（目を引く一言）にしてください。
2. 指示トーン（${tone}）の空気感を存分に表現してください。
3. 適度に改行・絵文字を入れて読みやすくしてください。
4. 末尾には、写真・ジャンル・機材に関連するハッシュタグを「6〜10個」添えてください。（ハッシュタグ内の記号やスペースは除外）
5. 本文の中に「------------------」の区切りを入れ、その下に機材クレジット（Photo名、Cam、Lens）を載せてください。`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const caption = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!caption) throw new Error('Generation failed');

    return NextResponse.json({ caption });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate caption' },
      { status: 500 }
    );
  }
}