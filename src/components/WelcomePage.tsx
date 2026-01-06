/**
 * Welcome Page - 온보딩 페이지
 *
 * 설치 직후 또는 모델 다운로드가 필요할 때 표시되는 환영 페이지
 */

import { useState } from "react"
import { Brain, Sparkles, Shield, Zap, ArrowRight } from "lucide-react"
import { ModelManager } from "./ModelManager"

interface WelcomePageProps {
  onComplete: () => void
}

export function WelcomePage({ onComplete }: WelcomePageProps) {
  const [step, setStep] = useState<"intro" | "setup">("intro")

  if (step === "setup") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <ModelManager onReady={onComplete} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
      {/* 헤더 */}
      <header className="p-6 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-indigo-400" />
          <span className="text-2xl font-bold text-white">Memex</span>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* 히어로 섹션 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full text-indigo-300 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            On-Device AI Brain
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            당신만의 AI 두뇌를
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              브라우저에 심으세요
            </span>
          </h1>

          <p className="text-slate-400 text-lg max-w-md mx-auto">
            모든 AI 처리가 로컬에서 이루어집니다.
            <br />
            데이터는 절대 외부로 나가지 않습니다.
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mb-12">
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-green-400" />}
            title="100% 프라이버시"
            description="모든 데이터가 로컬에 저장됩니다"
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-yellow-400" />}
            title="오프라인 지원"
            description="인터넷 없이도 AI 사용 가능"
          />
          <FeatureCard
            icon={<Brain className="w-6 h-6 text-indigo-400" />}
            title="개인 지식 베이스"
            description="읽은 페이지를 기억하고 연결"
          />
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={() => setStep("setup")}
          className="group px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg flex items-center gap-3 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
        >
          AI 두뇌 설치하기
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-slate-500 text-sm mt-4">
          약 1.5GB의 AI 모델이 다운로드됩니다 (처음 한 번만)
        </p>
      </main>

      {/* 푸터 */}
      <footer className="p-6 text-center text-slate-500 text-sm">
        <p>Chrome 131+ 및 WebGPU 지원 GPU 필요</p>
      </footer>
    </div>
  )
}

// 기능 카드 컴포넌트
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-4 bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl">
      <div className="w-12 h-12 bg-slate-700/50 rounded-lg flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  )
}
