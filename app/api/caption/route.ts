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
async function generateWithFallback(ai: GoogleGenAI, contents: any, config?: any) {
  let lastError: any;

  for (const model of MODEL_CHAIN) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, contents, ...(config ? { config } : {}) });
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
const PLATFORM_SPECS: Record<
  string,
  { label: string; captionGuide: string; hashtagMin: number; hashtagMax: number }
> = {
  x: {
    label: 'X(旧Twitter)',
    captionGuide: '全角80〜120文字程度で簡潔・インパクト重視。',
    hashtagMin: 3,
    hashtagMax: 5,
  },
  instagram: {
    label: 'Instagram',
    captionGuide: '世界観を伝える2〜4文。改行を活かした読みやすい構成。',
    hashtagMin: 8,
    hashtagMax: 15,
  },
  threads: {
    label: 'Threads',
    captionGuide: '会話的でカジュアルなトーンで3〜5文程度。',
    hashtagMin: 1,
    hashtagMax: 3,
  },
  tiktok: {
    label: 'TikTok',
    captionGuide: '短く勢いのあるキャッチコピー調。絵文字を効果的に使う。',
    hashtagMin: 4,
    hashtagMax: 7,
  },
  blog: {
    label: 'ブログ/note',
    captionGuide: '導入文として使える3〜5文の丁寧な文章。撮影の背景や意図が伝わるように。',
    hashtagMin: 0,
    hashtagMax: 0,
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

    const validPlatforms = requestedPlatforms.filter((p) => PLATFORM_SPECS[p]);

    const schemaFields = validPlatforms
      .map((p) => {
        const spec = PLATFORM_SPECS[p];
        const hashtagRule =
          spec.hashtagMax > 0
            ? `"hashtags": string[]  // 必ず${spec.hashtagMin}〜${spec.hashtagMax}個。1要素につきタグ1つ、"#"から始める`
            : `"hashtags": []  // このプラットフォームはハッシュタグ不要。必ず空配列にする`;
        return `  "${p}": {
    // ${spec.label}向け。${spec.captionGuide}
    "caption": string,  // 本文のみ。ハッシュタグは絶対に含めない
    ${hashtagRule}
  }`;
      })
      .join(',\n');

    const platformChecklist = validPlatforms
      .map((p) => `- ${PLATFORM_SPECS[p].label}: hashtagsは${PLATFORM_SPECS[p].hashtagMin}〜${PLATFORM_SPECS[p].hashtagMax}個(必ず下限以上)`)
      .join('\n');

    const affiliateSection =
      includeAffiliate && affiliateLink
        ? `\n- 使用機材の紹介として、以下のリンクをcaption本文の末尾に自然な形で1回だけ含めてください: ${affiliateLink}`
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

【出力形式】
前後に説明文・前置き・マークダウンのコードフェンス(\`\`\`)は一切付けず、以下のJSONオブジェクトのみを出力してください。指定したキー以外は含めないこと。

{
${schemaFields},
  "postingTip": string  // このジャンル・内容に最も適した投稿タイミング(曜日・時間帯)とその理由を1〜2文で
}

【ハッシュタグ個数チェックリスト・必ず守ること】
${platformChecklist}
上記の下限を1つでも下回った場合は出力として不正です。各hashtags配列は指定範囲内の個数になるまで具体的なタグを追加してください。
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

    const genConfig = { responseMimeType: 'application/json' };

    let response, modelUsed;
    try {
      const result = await generateWithFallback(ai, contents, genConfig);
      response = result.response;
      modelUsed = result.modelUsed;
    } catch (err) {
      // 画像付きで全モデル失敗した場合、テキストのみで最終フォールバック
      if (contents !== prompt) {
        console.warn('All models failed with image, retrying text-only');
        const result = await generateWithFallback(ai, prompt, genConfig);
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
