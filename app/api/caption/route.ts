import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

// ==============================
// モデル設定
// ==============================
// 上から順に試す。新しいモデルが混雑/クォータ超過でも、
// 枯れたモデルにフォールバックして生成を続行する。
const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

type ErrorKind = 'rate_limit' | 'overloaded' | 'other';

function classifyError(err: any): ErrorKind {
  const status = err?.status || err?.error?.status;
  const code = err?.code ?? err?.error?.code;
  if (status === 'RESOURCE_EXHAUSTED' || code === 429) return 'rate_limit';
  if (status === 'UNAVAILABLE' || code === 503) return 'overloaded';
  return 'other';
}

// 503(混雑)は短いリトライで回復することが多いが、
// 429(クォータ超過)はリトライしても無駄なので即座に次のモデルへ。
async function generateWithFallback(ai: GoogleGenAI, contents: any) {
  let lastError: any;

  for (const model of MODEL_CHAIN) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, contents });
        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const kind = classifyError(err);

        if (kind === 'rate_limit') {
          // クォータ超過はこのモデルでは回復しないので即次のモデルへ
          console.warn(`[${model}] rate limited, switching model`);
          break;
        }
        if (kind === 'overloaded' && attempt < maxRetries) {
          const delay = 400 * Math.pow(2, attempt) + Math.random() * 200;
          console.warn(`[${model}] overloaded, retry in ${Math.round(delay)}ms`);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
        // overloadedでリトライ上限に達した場合、またはその他のエラーは次のモデルへ
        console.warn(`[${model}] failed (${kind}), switching model`);
        break;
      }
    }
  }

  throw lastError;
}

// ==============================
// プラットフォーム定義
// ==============================
const PLATFORM_PROMPTS: Record<string, { tag: string; instruction: string }> = {
  x: {
    tag: 'X_CAPTION',
    instruction:
      'X(旧Twitter)用: 全角80〜120文字程度で簡潔・インパクト重視。ハッシュタグは3〜5個。',
  },
  instagram: {
    tag: 'INSTAGRAM_CAPTION',
    instruction:
      'Instagram用: 世界観を伝える文章を2〜4文+改行を活かした読みやすい構成。ハッシュタグは8〜15個、最後にまとめて記載。',
  },
  threads: {
    tag: 'THREADS_CAPTION',
    instruction:
      'Threads用: 会話的でカジュアルなトーン。3〜5文程度。ハッシュタグは1〜3個、控えめに。',
  },
  tiktok: {
    tag: 'TIKTOK_CAPTION',
    instruction:
      'TikTok用: 短く勢いのあるキャッチコピー調。絵文字を効果的に使い、ハッシュタグは4〜7個(トレンド系タグを意識)。',
  },
  blog: {
    tag: 'BLOG_CAPTION',
    instruction:
      'ブログ/note用: 導入文として使える3〜5文の丁寧な文章。撮影の背景や意図が伝わるように。ハッシュタグは不要。',
  },
};

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。' },
        { status: 500 }
      );
    }

    const body = await req.json();

    const {
      title,
      photographer,
      camera,
      lens,
      genre,
      tone,
      userComment,
      exifSummary,
      platforms,
      includeAffiliate,
      affiliateLink,
      adjustInstruction,
    } = body;

    let rawImageData =
      body.image ||
      body.imageUrl ||
      body.imageData ||
      body.image_url ||
      body.file ||
      body.base64;

    const ai = new GoogleGenAI({ apiKey });

    const requestedPlatforms: string[] =
      Array.isArray(platforms) && platforms.length > 0 ? platforms : ['x', 'instagram'];

    const platformSection = requestedPlatforms
      .filter((p) => PLATFORM_PROMPTS[p])
      .map((p) => {
        const { tag, instruction } = PLATFORM_PROMPTS[p];
        return `【${tag}】
${instruction}
以下の形式で必ず出力すること:
---${tag}_START---
(ここに本文とハッシュタグ)
---${tag}_END---`;
      })
      .join('\n\n');

    const affiliateSection =
      includeAffiliate && affiliateLink
        ? `\n- 使用機材の紹介として、以下のリンクを本文の末尾に自然な形で1回だけ含めてください: ${affiliateLink}`
        : '';

    const adjustSection = adjustInstruction
      ? `\n【追加の調整指示】前回の生成結果に対して、次の指示を反映してください: ${adjustInstruction}`
      : '';

    const prompt = `
あなたはSNS運用のプロのコピーライターです。以下の写真および撮影条件に基づいて、指定された各プラットフォーム向けのキャプションを作成してください。

【写真情報】
- タイトル/主題: ${title || 'なし'}
- 撮影者: ${photographer || '未指定'}
- 撮影カメラ: ${camera || '未指定'}
- 使用レンズ: ${lens || '未指定'}
- ジャンル: ${genre || 'スナップ'}
- 雰囲気/トーン: ${tone || 'かっこいい'}
- 撮影者のこだわり・メモ: ${userComment || 'なし'}
- 撮影データ(EXIF): ${exifSummary || '不明'}
${affiliateSection}
${adjustSection}

【出力してほしいプラットフォーム】
${platformSection}

【投稿タイミングの提案】
上記すべてに加えて、このジャンル・内容に最も適した投稿タイミング(曜日・時間帯)とその理由を1〜2文で、以下の形式で出力してください:
---POSTING_TIP_START---
(ここに投稿タイミングの提案)
---POSTING_TIP_END---

必ず指定した区切り記号(---TAG_START---〜---TAG_END---)を守り、それ以外の前置きや説明文は一切出力しないでください。
`;

    let contents: any;

    if (rawImageData && typeof rawImageData === 'string' && rawImageData.length > 50) {
      const base64Data = rawImageData.includes('base64,')
        ? rawImageData.split('base64,')[1]
        : rawImageData;
      const mimeType = rawImageData.includes('data:image/png') ? 'image/png' : 'image/jpeg';

      contents = [
        prompt,
        { inlineData: { data: base64Data, mimeType } },
      ];
    } else {
      contents = prompt;
    }

    let response, modelUsed;
    try {
      const result = await generateWithFallback(ai, contents);
      response = result.response;
      modelUsed = result.modelUsed;
    } catch (err) {
      // 画像付きで全モデル失敗した場合、テキストのみで最終フォールバック
      if (contents !== prompt) {
        console.warn('All models failed with image, retrying text-only');
        const result = await generateWithFallback(ai, prompt);
        response = result.response;
        modelUsed = result.modelUsed;
      } else {
        throw err;
      }
    }

    return NextResponse.json({ caption: response.text, modelUsed });
  } catch (error: any) {
    console.error('Gemini API Error Detail:', error);
    const kind = classifyError(error);

    const messages: Record<ErrorKind, string> = {
      rate_limit:
        'APIの利用上限(クォータ)に達しました。しばらく時間をおくか、Google AI Studioで請求先アカウントの設定をご確認ください。',
      overloaded: 'Gemini APIが現在混雑しています。しばらくしてから再度お試しください。',
      other: error?.message || 'キャプション生成中にエラーが発生しました。',
    };

    return NextResponse.json(
      { error: messages[kind] },
      { status: kind === 'rate_limit' ? 429 : kind === 'overloaded' ? 503 : 500 }
    );
  }
}
