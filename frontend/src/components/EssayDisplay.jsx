import { speak } from '../utils/tts'

export default function EssayDisplay({ essay, imageFile }) {
  const imageUrl = imageFile ? URL.createObjectURL(imageFile) : null

  return (
    <div className="card-kids border-green-300 w-full">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">📖</span>
        <h2 className="text-2xl font-bold text-green-600">我的作文</h2>
        <button
          onClick={() => speak(essay)}
          className="ml-auto btn-kids bg-green-400 text-base px-4 py-2"
          title="朗读作文"
        >
          🔊 朗读
        </button>
      </div>

      {imageUrl && (
        <img
          src={imageUrl}
          alt="上传的图片"
          className="w-full max-h-48 object-contain rounded-2xl mb-4 bg-gray-50"
        />
      )}

      <div className="bg-green-50 rounded-2xl p-5 border-2 border-green-200">
        <p className="text-xl leading-relaxed text-gray-700 whitespace-pre-wrap">{essay}</p>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {['🌟', '⭐', '✨', '🌟', '⭐'].map((star, i) => (
          <span key={i} className="text-2xl star-animate" style={{ animationDelay: `${i * 0.15}s` }}>
            {star}
          </span>
        ))}
      </div>
    </div>
  )
}
