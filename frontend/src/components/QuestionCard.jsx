import { useState, useEffect } from 'react'
import { speak } from '../utils/tts'

const COLORS = [
  { bg: 'bg-pink-100', border: 'border-pink-400', selected: 'bg-pink-400', text: 'text-pink-700' },
  { bg: 'bg-blue-100', border: 'border-blue-400', selected: 'bg-blue-400', text: 'text-blue-700' },
  { bg: 'bg-yellow-100', border: 'border-yellow-400', selected: 'bg-yellow-400', text: 'text-yellow-700' },
]

export default function QuestionCard({ question, options, questionIndex, totalQuestions, onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  // Auto-play question when it appears, reset state
  useEffect(() => {
    setSelected(null)
    setConfirmed(false)
    const ac = new AbortController()
    speak(question, ac.signal)
    return () => ac.abort()  // cancels if fetch is still in-flight on cleanup
  }, [question])

  const handleOptionClick = (option, idx) => {
    if (confirmed) return
    if (selected === idx) {
      // Second click on same option = confirm
      setConfirmed(true)
      onAnswer(option)
    } else {
      // First click = read aloud + highlight
      setSelected(idx)
      speak(option)
    }
  }

  const progress = ((questionIndex) / totalQuestions) * 100

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl">
      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between text-sm text-gray-400 mb-1 font-bold">
          <span>第 {questionIndex + 1} 题</span>
          <span>共 {totalQuestions} 题</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Star indicators */}
        <div className="flex justify-center gap-2 mt-2">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <span key={i} className={`text-2xl transition-all duration-300 ${i < questionIndex ? 'opacity-100' : 'opacity-30'}`}>
              ⭐
            </span>
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="card-kids border-purple-300 w-full">
        <div className="flex items-start gap-3 mb-6">
          <span className="text-4xl">🤔</span>
          <div>
            <p className="text-2xl font-bold text-purple-700 leading-relaxed">{question}</p>
            <button
              onClick={() => speak(question)}
              className="mt-1 text-sm text-purple-400 hover:text-purple-600 flex items-center gap-1"
            >
              🔊 再听一遍
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {options.map((option, idx) => {
            const color = COLORS[idx % COLORS.length]
            const isSelected = selected === idx
            return (
              <button
                key={idx}
                disabled={confirmed}
                onClick={() => handleOptionClick(option, idx)}
                className={`
                  flex items-center gap-3 p-4 rounded-2xl border-4 text-left
                  transition-all duration-200 active:scale-95
                  ${isSelected
                    ? `${color.selected} border-white text-white shadow-xl scale-105`
                    : `${color.bg} ${color.border} ${color.text} hover:scale-102 hover:shadow-md`}
                  ${confirmed ? 'opacity-70 cursor-default' : 'cursor-pointer'}
                `}
              >
                <span className="text-2xl">{['🅰️', '🅱️', '🅾️'][idx]}</span>
                <span className="text-xl font-bold flex-1">{option}</span>
                <span className="text-xl">🔊</span>
              </button>
            )
          })}
        </div>

        {selected !== null && !confirmed && (
          <p className="text-center text-sm text-gray-400 mt-4 animate-pulse">
            💡 再点一次确认选择，或点其他选项重新选
          </p>
        )}
      </div>
    </div>
  )
}
