export default function VideoPlayer({ videoUrl }) {
  if (!videoUrl) return null

  return (
    <div className="card-kids border-blue-300 w-full">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">🎬</span>
        <h2 className="text-2xl font-bold text-blue-600">我的故事视频</h2>
      </div>

      <video
        src={videoUrl}
        controls
        autoPlay
        className="w-full rounded-2xl shadow-lg"
        style={{ maxHeight: '400px' }}
      >
        您的浏览器不支持视频播放。
      </video>

      <div className="flex justify-center mt-4">
        <a
          href={videoUrl}
          download="我的故事.mp4"
          className="btn-kids bg-gradient-to-r from-blue-400 to-cyan-400 text-lg"
        >
          💾 下载视频
        </a>
      </div>
    </div>
  )
}
