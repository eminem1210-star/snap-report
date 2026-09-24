'use client'

import { useState, useEffect } from 'react'

const DEFAULT_CAMERAS = [
  'Canon EOS RP',
  'Canon EOS 6D',
  'Yashica Electro 35',
  'Konica C35 EF',
  'Minolta α-303si',
  'FUJIFILM X-A2',
  'Nikon F801',
]

const DEFAULT_LENSES = [
  'RF100-400mm F5.6-8 IS USM',
  'EF24-105mm F4L IS USM',
  'RF24-105mm F4 L IS USM',
  'Super-Takumar 50mm F1.4',
  'Carl Zeiss Jena Pancolar 50mm F1.8',
  'RF 50mm F1.8 STM',
  'EF 50mm F1.8 STM',
]

const DEFAULT_TONES = [
  'エモい・フィルム風・青み',
  'ノスタルジック・レトロ・温かみ',
  'シネマティック・静寂・重厚感',
  'クリア・透明感・鮮やか',
  'モノクロ・ハイコントラスト',
  'ミニマル・シンプル',
]

export default function NewReportPage() {
  const [loading, setLoading] = useState(false)

  const [cameraOptions, setCameraOptions] = useState<string[]>(DEFAULT_CAMERAS)
  const [lensOptions, setLensOptions] = useState<string[]>(DEFAULT_LENSES)
  const [toneOptions, setToneOptions] = useState<string[]>(DEFAULT_TONES)

  const [customCamera, setCustomCamera] = useState('')
  const [customLens, setCustomLens] = useState('')
  const [customTone, setCustomTone] = useState('')

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [generatedText, setGeneratedText] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    genre: 'スナップ・風景',
    tone: DEFAULT_TONES[0],
    camera_body: DEFAULT_CAMERAS[0],
    lens_model: DEFAULT_LENSES[0],
  })

  useEffect(() => {
    const savedCustomCameras = JSON.parse(localStorage.getItem('snap_custom_cameras') || '[]')
    const savedCustomLenses = JSON.parse(localStorage.getItem('snap_custom_lenses') || '[]')
    const savedCustomTones = JSON.parse(localStorage.getItem('snap_custom_tones') || '[]')

    const updatedCameras = Array.from(new Set([...DEFAULT_CAMERAS, ...savedCustomCameras]))
    const updatedLenses = Array.from(new Set([...DEFAULT_LENSES, ...savedCustomLenses]))
    const updatedTones = Array.from(new Set([...DEFAULT_TONES, ...savedCustomTones]))

    setCameraOptions(updatedCameras)
    setLensOptions(updatedLenses)
    setToneOptions(updatedTones)

    const savedCamera = localStorage.getItem('snap_last_camera')
    const savedLens = localStorage.getItem('snap_last_lens')
    const savedTone = localStorage.getItem('snap_last_tone')

    setFormData((prev) => ({
      ...prev,
      camera_body: savedCamera && updatedCameras.includes(savedCamera) ? savedCamera : updatedCameras[0],
      lens_model: savedLens && updatedLenses.includes(savedLens) ? savedLens : updatedLenses[0],
      tone: savedTone && updatedTones.includes(savedTone) ? savedTone : updatedTones[0],
    }))
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleCameraChange = (val: string) => {
    setFormData((prev) => ({ ...prev, camera_body: val }))
    if (val !== 'その他（手入力）') localStorage.setItem('snap_last_camera', val)
  }

  const handleLensChange = (val: string) => {
    setFormData((prev) => ({ ...prev, lens_model: val }))
    if (val !== 'その他（手入力）') localStorage.setItem('snap_last_lens', val)
  }

  const handleToneChange = (val: string) => {
    setFormData((prev) => ({ ...prev, tone: val }))
    if (val !== 'その他（手入力）') localStorage.setItem('snap_last_tone', val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setGeneratedText('')

    let finalCamera = formData.camera_body
    let finalLens = formData.lens_model
    let finalTone = formData.tone

    if (formData.camera_body === 'その他（手入力）' && customCamera.trim() !== '') {
      finalCamera = customCamera.trim()
      if (!cameraOptions.includes(finalCamera)) {
        const newCameras = [...cameraOptions, finalCamera]
        setCameraOptions(newCameras)
        localStorage.setItem('snap_custom_cameras', JSON.stringify(newCameras.filter((c) => !DEFAULT_CAMERAS.includes(c))))
      }
      localStorage.setItem('snap_last_camera', finalCamera)
    }

    if (formData.lens_model === 'その他（手入力）' && customLens.trim() !== '') {
      finalLens = customLens.trim()
      if (!lensOptions.includes(finalLens)) {
        const newLenses = [...lensOptions, finalLens]
        setLensOptions(newLenses)
        localStorage.setItem('snap_custom_lenses', JSON.stringify(newLenses.filter((l) => !DEFAULT_LENSES.includes(l))))
      }
      localStorage.setItem('snap_last_lens', finalLens)
    }

    if (formData.tone === 'その他（手入力）' && customTone.trim() !== '') {
      finalTone = customTone.trim()
      if (!toneOptions.includes(finalTone)) {
        const newTones = [...toneOptions, finalTone]
        setToneOptions(newTones)
        localStorage.setItem('snap_custom_tones', JSON.stringify(newTones.filter((t) => !DEFAULT_TONES.includes(t))))
      }
      localStorage.setItem('snap_last_tone', finalTone)
    }

    setTimeout(() => {
      const mockResult = `📸 【${formData.title}】

${finalTone}の解像感と質感を大切に、その場の空気ごと切り取った一枚。
機材は ${finalCamera} と ${finalLens} の組み合わせ。

ファインダー越しに感じた光の描写と繊細なグラデーションが、この一枚の魅力をより引き立ててくれました。

#写真好きな人と繋がりたい #ファインダー越しの私の世界 #${formData.genre} #${finalCamera.replace(/\s+/g, '')} #${finalLens.replace(/\s+/g, '')}`

      setGeneratedText(mockResult)
      setLoading(false)
    }, 1200)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText)
    alert('キャプションをクリップボードにコピーしました！')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    fontSize: '16px', // スマホでズームされない文字サイズ
    borderRadius: '8px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px 16px 40px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
        📸 SnapReport - 撮影レポート生成
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 写真アップロード */}
        <div>
          <label style={labelStyle}>写真をアップロード (任意)</label>
          <div
            style={{
              border: '2px dashed #bbb',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              backgroundColor: '#fafafa',
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
              id="photo-upload"
            />
            <label htmlFor="photo-upload" style={{ cursor: 'pointer', display: 'block' }}>
              {imagePreview ? (
                <div>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }}
                  />
                  <p style={{ marginTop: '8px', fontSize: '13px', color: '#0070f3' }}>タップして変更</p>
                </div>
              ) : (
                <div style={{ padding: '12px 0' }}>
                  <p style={{ fontSize: '32px', margin: '0 0 4px 0' }}>📷</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                    タップしてライブラリから選択
                  </p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* 撮影タイトル */}
        <div>
          <label style={labelStyle}>撮影タイトル *</label>
          <input
            required
            placeholder="例: 夕暮れの海辺スナップ"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={inputStyle}
          />
        </div>

        {/* ジャンル & 雰囲気 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>ジャンル</label>
            <input
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>雰囲気・トーン</label>
            <select
              value={formData.tone}
              onChange={(e) => handleToneChange(e.target.value)}
              style={inputStyle}
            >
              {toneOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="その他（手入力）">その他（手入力）</option>
            </select>

            {formData.tone === 'その他（手入力）' && (
              <input
                type="text"
                required
                placeholder="新しいトーンを入力"
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                style={{ ...inputStyle, marginTop: '8px' }}
              />
            )}
          </div>
        </div>

        {/* カメラ & レンズ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>使用カメラ</label>
            <select
              value={formData.camera_body}
              onChange={(e) => handleCameraChange(e.target.value)}
              style={inputStyle}
            >
              {cameraOptions.map((cam) => (
                <option key={cam} value={cam}>
                  {cam}
                </option>
              ))}
              <option value="その他（手入力）">その他（手入力）</option>
            </select>

            {formData.camera_body === 'その他（手入力）' && (
              <input
                type="text"
                required
                placeholder="新しいカメラ名を入力"
                value={customCamera}
                onChange={(e) => setCustomCamera(e.target.value)}
                style={{ ...inputStyle, marginTop: '8px' }}
              />
            )}
          </div>

          <div>
            <label style={labelStyle}>使用レンズ</label>
            <select
              value={formData.lens_model}
              onChange={(e) => handleLensChange(e.target.value)}
              style={inputStyle}
            >
              {lensOptions.map((lens) => (
                <option key={lens} value={lens}>
                  {lens}
                </option>
              ))}
              <option value="その他（手入力）">その他（手入力）</option>
            </select>

            {formData.lens_model === 'その他（手入力）' && (
              <input
                type="text"
                required
                placeholder="新しいレンズ名を入力"
                value={customLens}
                onChange={(e) => setCustomLens(e.target.value)}
                style={{ ...inputStyle, marginTop: '8px' }}
              />
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '14px',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '8px'
          }}
        >
          {loading ? 'AI解析＆文章生成中...' : '✨ AIでSNS投稿文を生成する'}
        </button>
      </form>

      {/* 生成結果 */}
      {generatedText && (
        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f7f9fa', borderRadius: '12px', border: '1px solid #e1e8ed' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '10px' }}>✨ 生成されたキャプション</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', lineHeight: '1.6' }}>
            {generatedText}
          </pre>
          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#1da1f2',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            📋 文章をコピーする
          </button>
        </div>
      )}
    </div>
  )
}