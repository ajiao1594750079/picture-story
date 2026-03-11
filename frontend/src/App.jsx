import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import QuestionCard from './components/QuestionCard'
import EssayDisplay from './components/EssayDisplay'
import VideoPlayer from './components/VideoPlayer'
import { preload } from './utils/tts'

// ─── Stages ───────────────────────────────────────────────────────────────────
// 'upload'   → user uploads image
// 'quiz'     → answering questions one by one
// 'loading'  → generating essay / video
// 'result'   → show essay + video
// ──────────────────────────────────────────────────────────────────────────────

function LoadingOverlay({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="flex gap-3">
        {['🌟', '⭐', '✨', '🌟', '⭐'].map((s, i) => (
          <span key={i} className="text-4xl star-animate" style={{ animationDelay: `${i * 0.2}s` }}>
            {s}
          </span>
        ))}
      </div>
      <p className="text-2xl font-bold text-purple-600 animate-pulse">{message}</p>
      <div className="flex gap-2">
        {['🐣', '🦋', '🌈', '🐥'].map((e, i) => (
          <span
            key={i}
            className="text-3xl"
            style={{ animation: `bounce 1s ${i * 0.25}s infinite` }}
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [stage, setStage] = useState('upload')
  const [imageFile, setImageFile] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState([])
  const [essay, setEssay] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')

  // ── Step 1: Upload image → call /analyze ──────────────────────────────────
  const handleUpload = async (file) => {
    setImageFile(file)
    setError('')
    setStage('loading')
    setLoadingMsg('🔍 正在识别图片内容...')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/analyze', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '图片分析失败')
      }
      const data = await res.json()
      setQuestions(data.questions)
      setAnswers([])
      setCurrentQ(0)
      // Kick off TTS preload for everything in background
      data.questions.forEach(q => {
        preload(q.question)
        q.options.forEach(opt => preload(opt))
      })
      // Wait only for first question's audio before showing quiz
      await preload(data.questions[0].question)
      setStage('quiz')
    } catch (e) {
      setError(e.message)
      setStage('upload')
    }
  }

  // ── Step 2: Each answered question ────────────────────────────────────────
  const handleAnswer = (selectedOption) => {
    const newAnswers = [
      ...answers,
      {
        question: questions[currentQ].question,
        selected_option: selectedOption,
      },
    ]
    setAnswers(newAnswers)

    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1)
    } else {
      // All questions answered → generate essay
      handleGenerateEssay(newAnswers)
    }
  }

  // ── Step 3: Generate essay → call /generate-essay ─────────────────────────
  const handleGenerateEssay = async (finalAnswers) => {
    setStage('loading')
    setLoadingMsg('✍️ 正在帮你写作文...')

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('answers', JSON.stringify(finalAnswers))

      const res = await fetch('/generate-essay', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '作文生成失败')
      }
      const data = await res.json()
      setEssay(data.essay)

      // Immediately generate video
      await handleGenerateVideo(data.essay)
    } catch (e) {
      setError(e.message)
      setStage('quiz')   // go back to last question on error
    }
  }

  // ── Step 4: Generate video → submit task, then poll ──────────────────────
  const handleGenerateVideo = async (essayText) => {
    setLoadingMsg('🎬 正在制作故事视频...')

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('essay_text', essayText)

      // Submit job, get task_id immediately
      const res = await fetch('/generate-video', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '视频生成失败')
      }
      const { task_id } = await res.json()

      // Poll every 3 seconds until done or error
      while (true) {
        await new Promise(r => setTimeout(r, 3000))
        const pollRes = await fetch(`/task/${task_id}`)
        if (!pollRes.ok) throw new Error('视频任务查询失败')
        const task = await pollRes.json()
        if (task.status === 'done') {
          setVideoUrl(task.video_url)
          setStage('result')
          return
        } else if (task.status === 'error') {
          throw new Error(task.detail || '视频生成失败')
        }
        // status === 'pending', keep waiting
      }
    } catch (e) {
      setError(e.message)
      // Still show essay even if video fails
      setStage('result')
    }
  }

  // ── Restart ────────────────────────────────────────────────────────────────
  const handleRestart = () => {
    setStage('upload')
    setImageFile(null)
    setQuestions([])
    setCurrentQ(0)
    setAnswers([])
    setEssay('')
    setVideoUrl('')
    setError('')
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">

        {/* Error banner */}
        {error && (
          <div className="card-kids border-red-300 bg-red-50 text-red-600 text-lg mb-4 flex items-center gap-3">
            <span className="text-3xl">😢</span>
            <div>
              <p className="font-bold">哎呀，出错了！</p>
              <p className="text-sm">{error}</p>
            </div>
            <button
              className="ml-auto text-red-400 hover:text-red-600 text-2xl"
              onClick={() => setError('')}
            >
              ✕
            </button>
          </div>
        )}

        {/* Stage: upload */}
        {stage === 'upload' && (
          <div className="mt-8">
            <ImageUpload onUpload={handleUpload} loading={false} />
          </div>
        )}

        {/* Stage: loading */}
        {stage === 'loading' && (
          <div className="mt-8">
            <LoadingOverlay message={loadingMsg} />
          </div>
        )}

        {/* Stage: quiz */}
        {stage === 'quiz' && questions.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-4">
            {/* Thumbnail */}
            {imageFile && (
              <img
                src={URL.createObjectURL(imageFile)}
                alt="你上传的图片"
                className="w-40 h-32 object-contain rounded-2xl shadow-md bg-white border-4 border-purple-200"
              />
            )}
            <QuestionCard
              key={currentQ}
              question={questions[currentQ].question}
              options={questions[currentQ].options}
              questionIndex={currentQ}
              totalQuestions={questions.length}
              onAnswer={handleAnswer}
            />
          </div>
        )}

        {/* Stage: result */}
        {stage === 'result' && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="text-center">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-3xl font-bold text-purple-600">太棒了！你完成了！</h2>
            </div>

            {/* Essay and Video side by side on wide screens */}
            <div className="flex flex-col gap-4">
              <EssayDisplay essay={essay} imageFile={imageFile} />
              {videoUrl && <VideoPlayer videoUrl={videoUrl} />}
              {!videoUrl && (
                <div className="card-kids border-yellow-300 bg-yellow-50 text-center text-gray-500">
                  <p className="text-xl">🎬 视频生成中断，但作文已完成！</p>
                </div>
              )}
            </div>

            <button
              className="btn-kids bg-gradient-to-r from-purple-500 to-pink-500 text-2xl py-4 mx-auto"
              onClick={handleRestart}
            >
              🔄 再来一次！
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
