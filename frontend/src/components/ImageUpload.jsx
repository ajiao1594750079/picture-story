import { useState, useRef } from 'react'

export default function ImageUpload({ onUpload, loading }) {
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const handleFile = (file) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      alert('请上传 JPG、PNG、GIF 或 WebP 格式的图片！')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('图片太大了！请上传小于 10MB 的图片。')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    onUpload(file)
  }

  const handleChange = (e) => handleFile(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-6xl mb-3">🖼️</div>
        <h1 className="text-4xl font-bold text-purple-600 mb-2">小小故事家</h1>
        <p className="text-xl text-gray-500">上传一张图片，开始你的故事吧！</p>
      </div>

      {/* Drop zone */}
      <div
        className={`card-kids border-dashed border-purple-300 w-full max-w-lg cursor-pointer
          flex flex-col items-center justify-center gap-4 min-h-[220px]
          transition-all duration-200
          ${dragOver ? 'border-purple-500 bg-purple-50 scale-105' : 'hover:border-purple-400 hover:bg-purple-50'}`}
        onClick={() => !loading && fileRef.current.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        {preview ? (
          <img
            src={preview}
            alt="上传的图片"
            className="max-h-48 max-w-full rounded-2xl object-contain shadow-md"
          />
        ) : (
          <>
            <div className="text-6xl">📸</div>
            <p className="text-xl text-gray-400 font-bold">点击这里上传图片</p>
            <p className="text-sm text-gray-300">或者把图片拖到这里</p>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      {/* Start button */}
      {preview && (
        <button
          className="btn-kids bg-gradient-to-r from-purple-500 to-pink-500 text-2xl px-10 py-4"
          onClick={() => fileRef.current.click()}
          disabled={loading}
        >
          {loading ? '🔍 正在分析图片...' : '✨ 换一张图片'}
        </button>
      )}

      {!preview && (
        <div className="flex gap-3 text-3xl animate-bounce">
          <span>⭐</span><span>🌟</span><span>✨</span>
        </div>
      )}
    </div>
  )
}
