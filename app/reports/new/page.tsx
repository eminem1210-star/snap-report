'use client';
import { useState, useEffect } from 'react';
import exifr from 'exifr';

const INITIAL_LENS_DATA: { [key: string]: string[] } = {
  'Canon (RFマウント)': [
    'RF28-70mm F2.8 IS STM',
    'RF100-400mm F5.6-8 IS USM',
    'RF24-105mm F4 L IS USM',
    'RF70-200mm F2.8 L IS USM',
    'RF100-500mm F4.5-7.1 L IS USM',
  ],
  'Canon (EFマウント)': [
    'EF24-105mm F4L IS USM',
    'EF24-70mm F2.8L II USM',
    'EF70-200mm F2.8L IS III USM',
    'EF100-400mm F4.5-5.6L IS II USM',
  ],
  'Sony (Eマウント)': [
    'FE 24-70mm F2.8 GM II',
    'FE 70-200mm F2.8 GM OSS II',
    'FE 200-600mm F5.6-6.3 G OSS',
  ],
  'Nikon (Zマウント)': [
    'NIKKOR Z 24-70mm f/2.8 S',
    'NIKKOR Z 180-600mm f/5.6-6.3 VR',
  ],
  'オールドレンズ・その他': [
    'Super-Takumar 55mm F1.8',
    'Yashica Electro 35',
    'Konica C35 EF',
    'RICOH GRレンズ (内蔵)',
  ],
  'EXIF検出': [],
};

const INITIAL_CAMERAS = [
  'Canon EOS RP',
  'Canon EOS 6D',
  'Canon EOS R8',
  'Sony α7 IV',
  'RICOH GR III',
  'RICOH GR IIIx',
  'Minolta α-303si',
];

const PLATFORM_OPTIONS = [
  { id: 'x', label: 'X (旧Twitter)', icon: '🐦', maxLen: 280, accent: 'cyan' },
  { id: 'instagram', label: 'Instagram', icon: '📷', maxLen: 2200, accent: 'pink' },
  { id: 'threads', label: 'Threads', icon: '🧵', maxLen: 500, accent: 'purple' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', maxLen: 2200, accent: 'emerald' },
  { id: 'blog', label: 'ブログ/note', icon: '📝', maxLen: 100000, accent: 'amber' },
] as const;

type PlatformId = (typeof PLATFORM_OPTIONS)[number]['id'];

const ACCENT_CLASSES: Record<string, { text: string; border: string }> = {
  cyan: { text: 'text-cyan-400', border: 'border-cyan-500' },
  pink: { text: 'text-pink-400', border: 'border-pink-500' },
  purple: { text: 'text-purple-400', border: 'border-purple-500' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500' },
  amber: { text: 'text-amber-400', border: 'border-amber-500' },
};

const TONE_ADJUST_PRESETS = [
  'もっとカジュアルで親しみやすく',
  'もっと詩的・情緒的に',
  'もっと簡潔に、要点だけ',
  'もっと熱量高く、テンション上げて',
];

const WATERMARK_POSITIONS = [
  { id: 'bottom-right', label: '右下' },
  { id: 'bottom-left', label: '左下' },
  { id: 'top-right', label: '右上' },
  { id: 'top-left', label: '左上' },
  { id: 'center', label: '中央' },
] as const;

const WATERMARK_FONTS = [
  { id: 'sans-serif', label: 'ゴシック体' },
  { id: 'serif', label: '明朝体' },
  { id: "'Courier New', monospace", label: '等幅' },
] as const;

const CROP_RATIOS = [
  { id: 'original', label: 'オリジナル', ratio: null as number | null },
  { id: '1:1', label: '正方形 1:1 (Instagram)', ratio: 1 },
  { id: '4:5', label: '縦長 4:5 (Instagramフィード)', ratio: 4 / 5 },
  { id: '9:16', label: '縦長 9:16 (Stories/Reels)', ratio: 9 / 16 },
  { id: '16:9', label: '横長 16:9 (Xカード)', ratio: 16 / 9 },
] as const;

type HistoryItem = {
  id: string;
  timestamp: number;
  title: string;
  thumbnail: string;
  captions: Record<string, string>;
  postingTip: string;
};

type BatchPhoto = {
  id: string;
  title: string;
  imageDataUrl: string;
  previewUrl: string;
  exifSummary: string;
  captions: Record<string, string>;
  postingTip: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
};

function buildExifSummary(tags: any): string {
  if (!tags) return '';
  const parts: string[] = [];
  if (tags.FocalLength) parts.push(`${Math.round(tags.FocalLength)}mm`);
  if (tags.FNumber) parts.push(`f/${tags.FNumber}`);
  if (tags.ExposureTime) {
    const et = tags.ExposureTime;
    parts.push(et >= 1 ? `${et}s` : `1/${Math.round(1 / et)}s`);
  }
  if (tags.ISO) parts.push(`ISO${tags.ISO}`);
  return parts.join(' ・ ');
}

// 履歴用の軽量サムネイルを作る(localStorage容量対策)
function makeThumbnail(dataUrl: string, maxSize = 240): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

// 指定アスペクト比に合わせた中央クロップの矩形を計算
function getCropRect(width: number, height: number, targetRatio: number | null) {
  if (!targetRatio) return { sx: 0, sy: 0, sw: width, sh: height };
  const currentRatio = width / height;
  let sw: number, sh: number;
  if (currentRatio > targetRatio) {
    sh = height;
    sw = height * targetRatio;
  } else {
    sw = width;
    sh = width / targetRatio;
  }
  return { sx: (width - sw) / 2, sy: (height - sh) / 2, sw, sh };
}

function resizeToDataUrl(file: File, maxSize = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewReportPage() {
  const [lensData, setLensData] = useState(INITIAL_LENS_DATA);
  const [cameras, setCameras] = useState(INITIAL_CAMERAS);

  const [selectedMaker, setSelectedMaker] = useState('Canon (RFマウント)');
  const [selectedLens, setSelectedLens] = useState('RF28-70mm F2.8 IS STM');
  const [customLensInput, setCustomLensInput] = useState('');

  const [title, setTitle] = useState('');
  const [photographer, setPhotographer] = useState('オーレリアン二郎');
  const [camera, setCamera] = useState('Canon EOS RP');
  const [customCameraInput, setCustomCameraInput] = useState('');

  const [genre, setGenre] = useState('鉄道・航空');

  const [toneSelect, setToneSelect] = useState('爽やか・透明感');
  const [customToneInput, setCustomToneInput] = useState('');

  // 透かし設定
  const [watermarkColor, setWatermarkColor] = useState('#ffffff');
  const [watermarkPosition, setWatermarkPosition] =
    useState<(typeof WATERMARK_POSITIONS)[number]['id']>('bottom-right');
  const [watermarkFont, setWatermarkFont] = useState<string>('sans-serif');
  const [handleName, setHandleName] = useState('');

  // クロップ・ライト補正設定(共通)
  const [cropRatioId, setCropRatioId] = useState<(typeof CROP_RATIOS)[number]['id']>('original');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const [userComment, setUserComment] = useState('');

  const [showTitle, setShowTitle] = useState(true);
  const [showCamera, setShowCamera] = useState(true);
  const [showLens, setShowLens] = useState(true);
  const [showPhotographer, setShowPhotographer] = useState(true);
  const [showHandle, setShowHandle] = useState(true);

  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  const [exifTags, setExifTags] = useState<any>(null);
  const [exifApplied, setExifApplied] = useState(false);

  // マルチプラットフォーム
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['x', 'instagram']);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [postingTip, setPostingTip] = useState('');

  // アフィリエイト
  const [includeAffiliate, setIncludeAffiliate] = useState(false);
  const [affiliateLink, setAffiliateLink] = useState('');

  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ==== 複数枚モード ====
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [batchPhotos, setBatchPhotos] = useState<BatchPhoto[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const savedLenses = localStorage.getItem('snap_report_custom_lenses');
    if (savedLenses) {
      try { setLensData(JSON.parse(savedLenses)); } catch (e) { console.error(e); }
    }
    const savedCameras = localStorage.getItem('snap_report_custom_cameras');
    if (savedCameras) {
      try { setCameras(JSON.parse(savedCameras)); } catch (e) { console.error(e); }
    }
    const savedHandle = localStorage.getItem('snap_report_handle');
    if (savedHandle) setHandleName(savedHandle);
    const savedHistory = localStorage.getItem('snap_report_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) { console.error(e); }
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const handleMakerChange = (maker: string) => {
    setSelectedMaker(maker);
    setSelectedLens(lensData[maker]?.[0] || '');
  };

  const handleAddCamera = () => {
    const target = customCameraInput.trim() || camera;
    if (target && !cameras.includes(target)) {
      const updated = [target, ...cameras];
      setCameras(updated);
      setCamera(target);
      setCustomCameraInput('');
      localStorage.setItem('snap_report_custom_cameras', JSON.stringify(updated));
      showToast(`✨ カメラ「${target}」をリストに登録しました！`);
    } else {
      showToast('⚠️ 登録するカメラ名が空か、すでにリストに存在します。');
    }
  };

  const handleAddLens = () => {
    const target = customLensInput.trim() || selectedLens;
    if (target) {
      const currentMakerLenses = lensData[selectedMaker] || [];
      if (!currentMakerLenses.includes(target)) {
        const updatedMakerLenses = [target, ...currentMakerLenses];
        const updatedLensData = { ...lensData, [selectedMaker]: updatedMakerLenses };
        setLensData(updatedLensData);
        setSelectedLens(target);
        setCustomLensInput('');
        localStorage.setItem('snap_report_custom_lenses', JSON.stringify(updatedLensData));
        showToast(`✨ レンズ「${target}」を【${selectedMaker}】のリストに登録しました！`);
      } else {
        showToast('⚠️ すでにこのリストに登録されています。');
      }
    } else {
      showToast('⚠️ レンズ名を入力してください。');
    }
  };

  // EXIFを解析してフォームに自動反映(共通カメラ/レンズ欄用)
  const applyExif = (tags: any, currentLensData: typeof lensData, currentCameras: string[]) => {
    if (!tags) return;
    setExifTags(tags);

    const cameraFromExif = [tags.Make, tags.Model].filter(Boolean).join(' ').trim();
    if (cameraFromExif) {
      if (!currentCameras.includes(cameraFromExif)) {
        const updated = [cameraFromExif, ...currentCameras];
        setCameras(updated);
        localStorage.setItem('snap_report_custom_cameras', JSON.stringify(updated));
      }
      setCamera(cameraFromExif);
    }

    const lensFromExif = tags.LensModel || tags.LensMake || '';
    if (lensFromExif) {
      const updatedLensData = {
        ...currentLensData,
        'EXIF検出': [lensFromExif, ...(currentLensData['EXIF検出'] || []).filter((l) => l !== lensFromExif)],
      };
      setLensData(updatedLensData);
      setSelectedMaker('EXIF検出');
      setSelectedLens(lensFromExif);
    }

    if (cameraFromExif || lensFromExif) {
      setExifApplied(true);
      showToast('📸 EXIF情報を自動反映しました');
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExifApplied(false);
    setExifTags(null);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      const tags = await exifr.parse(file, {
        pick: ['Make', 'Model', 'LensModel', 'LensMake', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal'],
      });
      if (tags) applyExif(tags, lensData, cameras);
    } catch (err) {
      console.warn('EXIF読み込み失敗(写真にEXIFが無い可能性があります):', err);
    }

    try {
      const dataUrl = await resizeToDataUrl(file);
      setImage(dataUrl);
    } catch (err) {
      console.error(err);
    }
  };

  // 複数枚アップロード
  const handleBatchFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos: BatchPhoto[] = [];
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      let exifSummary = '';
      try {
        const tags = await exifr.parse(file, {
          pick: ['FocalLength', 'FNumber', 'ExposureTime', 'ISO'],
        });
        exifSummary = buildExifSummary(tags);
      } catch (err) {
        // EXIF無しは無視
      }
      let dataUrl = '';
      try {
        dataUrl = await resizeToDataUrl(file);
      } catch (err) {
        console.error(err);
        continue;
      }
      newPhotos.push({
        id,
        title: '',
        imageDataUrl: dataUrl,
        previewUrl,
        exifSummary,
        captions: {},
        postingTip: '',
        status: 'pending',
      });
    }
    setBatchPhotos((prev) => [...prev, ...newPhotos]);
    showToast(`📸 ${newPhotos.length}枚を追加しました`);
  };

  const updateBatchPhotoTitle = (id: string, newTitle: string) => {
    setBatchPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, title: newTitle } : p)));
  };

  const removeBatchPhoto = (id: string) => {
    setBatchPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // 透かし込みでベイクした画像(クロップ・ライト補正・透かし適用)を生成
  const bakeImage = (sourceDataUrl: string, titleOverride: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const targetRatioConf = CROP_RATIOS.find((r) => r.id === cropRatioId);
        const { sx, sy, sw, sh } = getCropRect(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          targetRatioConf?.ratio ?? null
        );

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas未対応')); return; }

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.filter = 'none';

        const hasContent = showTitle || showPhotographer || showCamera || showLens || (showHandle && handleName);
        if (hasContent) {
          const baseScale = Math.max(canvas.width, canvas.height) / 1000;
          const mainFontSize = Math.round(18 * baseScale);
          const subFontSize = Math.round(13 * baseScale);
          const padding = Math.round(35 * baseScale);

          let x: number, y: number, align: CanvasTextAlign, lineDir: number;
          switch (watermarkPosition) {
            case 'bottom-left':
              x = padding; y = canvas.height - padding; align = 'left'; lineDir = -1; break;
            case 'top-right':
              x = canvas.width - padding; y = padding; align = 'right'; lineDir = 1; break;
            case 'top-left':
              x = padding; y = padding; align = 'left'; lineDir = 1; break;
            case 'center':
              x = canvas.width / 2; y = canvas.height / 2; align = 'center'; lineDir = 1; break;
            case 'bottom-right':
            default:
              x = canvas.width - padding; y = canvas.height - padding; align = 'right'; lineDir = -1; break;
          }

          ctx.textAlign = align;
          ctx.textBaseline = watermarkPosition === 'center' ? 'middle' : (lineDir === -1 ? 'bottom' : 'top');
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8 * baseScale;
          ctx.shadowOffsetX = 1 * baseScale;
          ctx.shadowOffsetY = 2 * baseScale;

          const lines: { text: string; font: string; color: string }[] = [];
          if (showTitle && titleOverride) lines.push({ text: `📌 ${titleOverride}`, font: `bold ${Math.round(mainFontSize * 0.9)}px ${watermarkFont}`, color: watermarkColor });
          const subText = [showCamera ? camera : '', showLens ? selectedLens : ''].filter(Boolean).join(' · ');
          if (subText) lines.push({ text: subText, font: `300 ${subFontSize}px ${watermarkFont}`, color: watermarkColor === '#000000' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' });
          if (showPhotographer && photographer) lines.push({ text: `Shot by ${photographer}`, font: `500 ${mainFontSize}px ${watermarkFont}`, color: watermarkColor });
          if (showHandle && handleName) lines.push({ text: handleName.startsWith('@') ? handleName : `@${handleName}`, font: `500 ${subFontSize}px ${watermarkFont}`, color: watermarkColor });

          const ordered = lineDir === -1 ? [...lines].reverse() : lines;
          ordered.forEach((line) => {
            ctx.font = line.font;
            ctx.fillStyle = line.color;
            ctx.fillText(line.text, x, y);
            y += mainFontSize * 1.3 * lineDir;
          });
        }

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = reject;
      img.src = sourceDataUrl;
    });
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBakedImage = async () => {
    const targetSource = image || imagePreview;
    if (!targetSource) {
      showToast('⚠️ 先に写真をアップロードしてください。');
      return;
    }
    try {
      const baked = await bakeImage(targetSource, title);
      downloadDataUrl(baked, `snap-report-${Date.now()}.jpg`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ 画像の書き出しに失敗しました。');
    }
  };

  const downloadBatchPhoto = async (photo: BatchPhoto) => {
    try {
      const baked = await bakeImage(photo.imageDataUrl, photo.title || title);
      downloadDataUrl(baked, `snap-report-${photo.id}.jpg`);
    } catch (err) {
      console.error(err);
      showToast('⚠️ 画像の書き出しに失敗しました。');
    }
  };

  const togglePlatform = (id: PlatformId) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const parseResponse = (raw: string) => {
    const result: Record<string, string> = {};
    PLATFORM_OPTIONS.forEach(({ id }) => {
      const tag = { x: 'X_CAPTION', instagram: 'INSTAGRAM_CAPTION', threads: 'THREADS_CAPTION', tiktok: 'TIKTOK_CAPTION', blog: 'BLOG_CAPTION' }[id];
      const startTag = `---${tag}_START---`;
      const endTag = `---${tag}_END---`;
      const s = raw.indexOf(startTag);
      const e = raw.indexOf(endTag);
      if (s !== -1 && e !== -1) {
        result[id] = raw.substring(s + startTag.length, e).trim();
      }
    });

    const tipStart = raw.indexOf('---POSTING_TIP_START---');
    const tipEnd = raw.indexOf('---POSTING_TIP_END---');
    const tip = tipStart !== -1 && tipEnd !== -1
      ? raw.substring(tipStart + '---POSTING_TIP_START---'.length, tipEnd).trim()
      : '';

    return { result, tip };
  };

  const saveToHistory = async (caps: Record<string, string>, tip: string, sourceImage: string, itemTitle: string) => {
    const thumb = await makeThumbnail(sourceImage);
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      title: itemTitle || '(無題)',
      thumbnail: thumb,
      captions: caps,
      postingTip: tip,
    };
    setHistory((prev) => {
      const updated = [item, ...prev].slice(0, 30);
      try {
        localStorage.setItem('snap_report_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('履歴の保存に失敗しました(容量超過の可能性):', e);
      }
      return updated;
    });
  };

  const callCaptionApi = async (payload: any) => {
    const res = await fetch('/api/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'サーバーエラーが発生しました');
    return parseResponse(data.caption || '');
  };

  const handleGenerate = async (adjustInstruction?: string) => {
    if (selectedPlatforms.length === 0) {
      showToast('⚠️ 出力するSNSを1つ以上選んでください。');
      return;
    }
    if (adjustInstruction) setAdjusting(adjustInstruction);
    else setLoading(true);

    const finalTone = toneSelect === '自由入力（フリー）' ? (customToneInput || '標準') : toneSelect;

    try {
      const { result, tip } = await callCaptionApi({
        title, photographer, camera, lens: selectedLens, genre, tone: finalTone,
        userComment, image,
        exifSummary: buildExifSummary(exifTags),
        platforms: selectedPlatforms,
        includeAffiliate, affiliateLink,
        adjustInstruction,
      });
      setCaptions(result);
      setPostingTip(tip);
      if (handleName) localStorage.setItem('snap_report_handle', handleName);
      await saveToHistory(result, tip, image || imagePreview, title);
    } catch (err: any) {
      showToast(`⚠️ 生成に失敗しました: ${err.message}`);
    } finally {
      setLoading(false);
      setAdjusting(null);
    }
  };

  // 複数枚を順番に処理(APIのレート制限を避けるため一定間隔を空ける)
  const handleBatchGenerate = async () => {
    if (selectedPlatforms.length === 0) {
      showToast('⚠️ 出力するSNSを1つ以上選んでください。');
      return;
    }
    if (batchPhotos.length === 0) {
      showToast('⚠️ 写真を追加してください。');
      return;
    }
    setBatchRunning(true);
    setBatchProgress({ done: 0, total: batchPhotos.length });
    const finalTone = toneSelect === '自由入力（フリー）' ? (customToneInput || '標準') : toneSelect;

    for (let i = 0; i < batchPhotos.length; i++) {
      const photo = batchPhotos[i];
      setBatchPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'generating' } : p)));

      try {
        const { result, tip } = await callCaptionApi({
          title: photo.title || title,
          photographer, camera, lens: selectedLens, genre, tone: finalTone,
          userComment,
          image: photo.imageDataUrl,
          exifSummary: photo.exifSummary,
          platforms: selectedPlatforms,
          includeAffiliate, affiliateLink,
        });
        setBatchPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, captions: result, postingTip: tip, status: 'done' } : p)));
        await saveToHistory(result, tip, photo.imageDataUrl, photo.title || title);
      } catch (err: any) {
        setBatchPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error', error: err.message } : p)));
      }

      setBatchProgress({ done: i + 1, total: batchPhotos.length });
      // APIのレート制限に配慮して次のリクエストまで少し待つ
      if (i < batchPhotos.length - 1) {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }

    setBatchRunning(false);
    showToast('✨ 一括生成が完了しました');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(null), 2500);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setCaptions(item.captions);
    setPostingTip(item.postingTip);
    setTitle(item.title === '(無題)' ? '' : item.title);
    setShowHistory(false);
    setMode('single');
    showToast('📂 履歴から復元しました');
  };

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem('snap_report_history', JSON.stringify(updated));
  };

  const previewFilterStyle = { filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` };
  const activeCropRatioConf = CROP_RATIOS.find((r) => r.id === cropRatioId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="border-b border-slate-800 pb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
              SNAP REPORT
            </h1>
            <p className="text-sm text-slate-400 mt-1">プロ仕様・撮影レポート＆SNSキャプションジェネレーター</p>
          </div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition flex items-center gap-1.5"
          >
            🕘 履歴 ({history.length})
          </button>
        </header>

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-bold max-w-xs">
            {toast}
          </div>
        )}
        {copyStatus && (
          <div className="fixed top-6 right-6 z-50 bg-cyan-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce font-bold text-sm">
            ✨ {copyStatus}のキャプションをコピーしました！
          </div>
        )}

        {showHistory && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <h2 className="text-lg font-bold text-slate-200">🕘 生成履歴(直近30件)</h2>
            {history.length === 0 && <p className="text-sm text-slate-500">まだ履歴がありません。</p>}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-2">
                  {h.thumbnail && <img src={h.thumbnail} className="w-14 h-14 object-cover rounded-lg" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{h.title}</p>
                    <p className="text-xs text-slate-500">{new Date(h.timestamp).toLocaleString('ja-JP')}</p>
                  </div>
                  <button onClick={() => loadFromHistory(h)} className="px-2.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg cursor-pointer">復元</button>
                  <button onClick={() => deleteHistoryItem(h.id)} className="px-2.5 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-400 text-xs font-bold rounded-lg cursor-pointer">削除</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* モード切替 */}
        <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
          <button
            onClick={() => setMode('single')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${mode === 'single' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            🖼️ 1枚ずつ
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${mode === 'batch' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            🗂️ 複数枚まとめて
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-cyan-400">レポート＆透かし設定</h2>

          {mode === 'single' ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">写真アップロード</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer bg-slate-950/50 p-2 rounded-xl border border-slate-800"
                />
                {exifApplied && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                    📸 EXIF情報を検出し、カメラ・レンズ欄に自動反映しました
                    {buildExifSummary(exifTags) && ` (${buildExifSummary(exifTags)})`}
                  </p>
                )}
              </div>

              {(imagePreview || image) && (
                <div
                  className="mt-2 relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner group mx-auto"
                  style={activeCropRatioConf?.ratio ? { aspectRatio: `${activeCropRatioConf.ratio}`, maxWidth: activeCropRatioConf.ratio >= 1 ? '100%' : '360px' } : {}}
                >
                  <img
                    src={imagePreview || image}
                    alt="Preview"
                    style={previewFilterStyle}
                    className={activeCropRatioConf?.ratio ? 'w-full h-full object-cover' : 'w-full max-h-[450px] object-contain'}
                  />

                  {(showTitle || showPhotographer || showCamera || showLens || (showHandle && handleName)) && (
                    <div
                      className={`absolute text-right drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none space-y-0.5 ${
                        watermarkPosition === 'bottom-right' ? 'bottom-4 right-4' :
                        watermarkPosition === 'bottom-left' ? 'bottom-4 left-4 text-left' :
                        watermarkPosition === 'top-right' ? 'top-4 right-4' :
                        watermarkPosition === 'top-left' ? 'top-4 left-4 text-left' :
                        'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center'
                      }`}
                      style={{ fontFamily: watermarkFont }}
                    >
                      {showPhotographer && photographer && (
                        <p className="text-xs font-medium tracking-wide" style={{ color: watermarkColor }}>Shot by {photographer}</p>
                      )}
                      {(showCamera || showLens) && (
                        <p className="text-[10px] tracking-wider opacity-85" style={{ color: watermarkColor }}>
                          {[showCamera ? camera : '', showLens ? selectedLens : ''].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {showTitle && title && (
                        <p className="text-[11px] font-bold pt-0.5" style={{ color: watermarkColor }}>📌 {title}</p>
                      )}
                      {showHandle && handleName && (
                        <p className="text-[10px] pt-0.5" style={{ color: watermarkColor }}>
                          {handleName.startsWith('@') ? handleName : `@${handleName}`}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadBakedImage}
                    className="absolute top-3 right-3 px-3 py-2 bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer border border-cyan-400/30 z-10"
                  >
                    📥 透かし入り画像を保存
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">写真を複数選択してアップロード</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBatchFilesChange}
                className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500 cursor-pointer bg-slate-950/50 p-2 rounded-xl border border-slate-800"
              />
              <p className="text-xs text-slate-500">カメラ・レンズ・ジャンル・トーン・透かし設定は下のフォームで共通指定します。写真ごとに「タイトル」だけ個別に入力できます。</p>

              {batchPhotos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {batchPhotos.map((photo) => (
                    <div key={photo.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-2">
                      <div className="relative rounded-lg overflow-hidden aspect-square bg-slate-900">
                        <img src={photo.previewUrl} style={previewFilterStyle} className="w-full h-full object-cover" alt="" />
                        <span className={`absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          photo.status === 'done' ? 'bg-emerald-700 text-white' :
                          photo.status === 'generating' ? 'bg-amber-600 text-white' :
                          photo.status === 'error' ? 'bg-red-700 text-white' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {photo.status === 'done' ? '完了' : photo.status === 'generating' ? '生成中' : photo.status === 'error' ? '失敗' : '待機'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={photo.title}
                        onChange={(e) => updateBatchPhotoTitle(photo.id, e.target.value)}
                        placeholder="この写真のタイトル"
                        className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => removeBatchPhoto(photo.id)} className="flex-1 py-1.5 bg-slate-800 hover:bg-red-900 text-slate-400 text-[11px] font-bold rounded-lg cursor-pointer">削除</button>
                        {photo.status === 'done' && (
                          <button onClick={() => downloadBatchPhoto(photo)} className="flex-1 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-[11px] font-bold rounded-lg cursor-pointer">📥 保存</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {batchRunning && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>一括生成中...</span>
                    <span>{batchProgress.done} / {batchProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 transition-all" style={{ width: `${(batchProgress.done / Math.max(batchProgress.total, 1)) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 透かしカスタム設定 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <label className="block text-sm font-bold text-cyan-300">🎨 透かしデザイン設定</label>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">文字色</p>
              <div className="flex flex-wrap gap-2 items-center">
                {[
                  { label: 'ホワイト', value: '#ffffff' },
                  { label: 'シアン', value: '#67e8f9' },
                  { label: 'イエロー', value: '#fde047' },
                  { label: 'オレンジ', value: '#fb923c' },
                  { label: 'ブラック', value: '#000000' },
                ].map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setWatermarkColor(c.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer flex items-center gap-1.5 ${
                      watermarkColor === c.value ? 'bg-cyan-600 text-white border-cyan-400 shadow-md' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full border border-white/40" style={{ backgroundColor: c.value }}></span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">配置</p>
              <div className="flex flex-wrap gap-2">
                {WATERMARK_POSITIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setWatermarkPosition(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      watermarkPosition === p.id ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400 mb-1.5">フォント</p>
                <select value={watermarkFont} onChange={(e) => setWatermarkFont(e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200">
                  {WATERMARK_FONTS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5">SNSハンドル名(任意)</p>
                <input type="text" value={handleName} onChange={(e) => setHandleName(e.target.value)} placeholder="@your_handle" className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200" />
              </div>
            </div>
          </div>

          {/* クロップ・ライト補正設定 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <label className="block text-sm font-bold text-amber-300">✂️ クロップ・ライト補正</label>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">出力アスペクト比</p>
              <div className="flex flex-wrap gap-2">
                {CROP_RATIOS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setCropRatioId(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      cropRatioId === r.id ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">中央を基準にクロップされます。プレビューは概算です。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>明るさ</span><span>{brightness}%</span>
                </div>
                <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>コントラスト</span><span>{contrast}%</span>
                </div>
                <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>彩度</span><span>{saturation}%</span>
                </div>
                <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
            </div>
            {(brightness !== 100 || contrast !== 100 || saturation !== 100) && (
              <button
                type="button"
                onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); }}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                補正をリセット
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>写真名</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showPhotographer} onChange={(e) => setShowPhotographer(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>撮影者</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showCamera} onChange={(e) => setShowCamera(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>カメラ名</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showLens} onChange={(e) => setShowLens(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>レンズ名</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={showHandle} onChange={(e) => setShowHandle(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-cyan-500" />
              <span>ハンドル名</span>
            </label>
          </div>

          {mode === 'single' && (
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">写真タイトル</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 紅葉と高揚" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">撮影者名</label>
            <input type="text" value={photographer} onChange={(e) => setPhotographer(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">💬 撮影者のこだわり・思い・現場のメモ（任意・全枚共通）</label>
            <textarea value={userComment} onChange={(e) => setUserComment(e.target.value)} placeholder="例: 真っ赤なモミジの隙間から、大はしゃぎの娘がピョンとジャンプした瞬間を狙いました。" rows={3} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 text-sm leading-relaxed" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">カメラ選択</label>
              <select value={camera} onChange={(e) => setCamera(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2">
                {cameras.map((cam) => (<option key={cam} value={cam}>{cam}</option>))}
              </select>
              <div className="flex gap-2">
                <input type="text" value={customCameraInput} onChange={(e) => setCustomCameraInput(e.target.value)} placeholder="新しいカメラ名を正式名称で入力" className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-300" />
                <button type="button" onClick={handleAddCamera} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition">➕ リストに登録</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">レンズメーカー</label>
              <select value={selectedMaker} onChange={(e) => handleMakerChange(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100">
                {Object.keys(lensData).map((maker) => (<option key={maker} value={maker}>{maker}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">レンズ選択</label>
            <select value={selectedLens} onChange={(e) => setSelectedLens(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2">
              {lensData[selectedMaker]?.map((lens) => (<option key={lens} value={lens}>{lens}</option>))}
            </select>
            <div className="flex gap-2">
              <input type="text" value={customLensInput} onChange={(e) => setCustomLensInput(e.target.value)} placeholder="新しいレンズ名を正式名称で入力（例: EF24-105mm F4L IS USM）" className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-cyan-500 text-slate-300" />
              <button type="button" onClick={handleAddLens} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition">➕ リストに登録</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">ジャンル</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100">
                <option>鉄道・航空</option>
                <option>スナップ</option>
                <option>ポートレート</option>
                <option>風景・ネイチャー</option>
                <option>植物・ガジェット</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">トーン / 雰囲気（AI生成用）</label>
              <select value={toneSelect} onChange={(e) => setToneSelect(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-100 mb-2">
                <option>爽やか・透明感</option>
                <option>かっこいい・重厚感</option>
                <option>エモく・ノスタルジック</option>
                <option>鮮やか・ポップ</option>
                <option>自由入力（フリー）</option>
              </select>
              {toneSelect === '自由入力（フリー）' && (
                <input type="text" value={customToneInput} onChange={(e) => setCustomToneInput(e.target.value)} placeholder="例: 早朝の静けさと幻想的な雰囲気" className="w-full p-2.5 bg-slate-950 border border-cyan-600 rounded-xl text-sm focus:outline-none text-slate-100" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">出力するSNS/媒体を選択</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const active = selectedPlatforms.includes(p.id);
                const accent = ACCENT_CLASSES[p.accent];
                return (
                  <button key={p.id} type="button" onClick={() => togglePlatform(p.id)} className={`px-3 py-2 rounded-xl text-sm font-bold transition border cursor-pointer flex items-center gap-1.5 ${active ? `bg-slate-800 ${accent.text} ${accent.border}` : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-slate-900'}`}>
                    <span>{p.icon}</span>{p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-amber-300 cursor-pointer">
              <input type="checkbox" checked={includeAffiliate} onChange={(e) => setIncludeAffiliate(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-amber-500" />
              🔗 使用機材のリンクをキャプションに含める
            </label>
            {includeAffiliate && (
              <input type="text" value={affiliateLink} onChange={(e) => setAffiliateLink(e.target.value)} placeholder="https://... (Amazonアソシエイト等のリンク)" className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-slate-100" />
            )}
          </div>

          {mode === 'single' ? (
            <button onClick={() => handleGenerate()} disabled={loading} className="w-full py-4 mt-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer">
              {loading ? '✨ Gemini AIが写真を解析・生成中...' : '✨ 各SNS用キャプションを生成する'}
            </button>
          ) : (
            <button onClick={handleBatchGenerate} disabled={batchRunning || batchPhotos.length === 0} className="w-full py-4 mt-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer">
              {batchRunning ? `✨ 生成中... (${batchProgress.done}/${batchProgress.total})` : `✨ ${batchPhotos.length}枚まとめて生成する`}
            </button>
          )}
        </div>

        {mode === 'single' && Object.keys(captions).length > 0 && (
          <div className="space-y-6">
            {postingTip && (
              <div className="bg-indigo-950/50 border border-indigo-800 rounded-2xl p-4 flex items-start gap-2.5">
                <span className="text-lg">🕐</span>
                <div>
                  <p className="text-xs font-bold text-indigo-300 mb-0.5">おすすめ投稿タイミング</p>
                  <p className="text-sm text-indigo-100">{postingTip}</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-400">🔄 気に入らない場合は微調整して再生成</p>
              <div className="flex flex-wrap gap-2">
                {TONE_ADJUST_PRESETS.map((preset) => (
                  <button key={preset} onClick={() => handleGenerate(preset)} disabled={loading || !!adjusting} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition disabled:opacity-40">
                    {adjusting === preset ? '生成中...' : preset}
                  </button>
                ))}
              </div>
            </div>

            {PLATFORM_OPTIONS.filter((p) => captions[p.id]).map((p) => {
              const text = captions[p.id] || '';
              const accent = ACCENT_CLASSES[p.accent];
              const overLimit = text.length > p.maxLen;
              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className={`text-lg font-bold flex items-center gap-2 ${accent.text}`}>{p.icon} {p.label}用</h2>
                    <span className={`text-xs px-2.5 py-1 rounded-lg border ${overLimit ? 'bg-red-950 text-red-300 border-red-800' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                      文字数: {text.length} / {p.maxLen >= 100000 ? '制限なし' : p.maxLen}{overLimit && ' ⚠️ 超過'}
                    </span>
                  </div>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl whitespace-pre-wrap text-slate-200 leading-relaxed font-sans text-sm">{text}</div>
                  <button onClick={() => copyToClipboard(text, p.label)} className={`w-full py-3 bg-slate-800 hover:bg-slate-700 text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border border-slate-700 ${accent.text}`}>
                    📋 {p.label}用キャプションをコピーする
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {mode === 'batch' && batchPhotos.some((p) => p.status === 'done') && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-200">🗂️ 生成結果一覧</h2>
            {batchPhotos.filter((p) => p.status === 'done').map((photo) => (
              <div key={photo.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center gap-3">
                  <img src={photo.previewUrl} className="w-12 h-12 object-cover rounded-lg" alt="" />
                  <p className="font-bold text-slate-200">{photo.title || '(無題)'}</p>
                </div>
                {photo.postingTip && <p className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-900 rounded-lg p-2">🕐 {photo.postingTip}</p>}
                {PLATFORM_OPTIONS.filter((p) => photo.captions[p.id]).map((p) => {
                  const text = photo.captions[p.id] || '';
                  const accent = ACCENT_CLASSES[p.accent];
                  return (
                    <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                      <p className={`text-xs font-bold ${accent.text}`}>{p.icon} {p.label}用 ({text.length}文字)</p>
                      <p className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">{text}</p>
                      <button onClick={() => copyToClipboard(text, `${photo.title || '無題'} / ${p.label}`)} className={`w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer ${accent.text}`}>📋 コピー</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
