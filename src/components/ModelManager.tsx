/**
 * Model Manager - AI 모델 상태 관리 및 온보딩 UI
 *
 * 기능:
 * - 모델 다운로드 진행률 표시
 * - 하드웨어 요구사항 체크
 * - 모델 재설치 버튼
 */

import { useState, useEffect, useCallback } from "react"
import {
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cpu,
  HardDrive,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
} from "lucide-react"
import {
  performHardwareCheck,
  formatGPUInfo,
  type HardwareCheckResult,
} from "../lib/hardware-check"

interface ModelManagerProps {
  onReady?: () => void
  compact?: boolean
}

type ModelStatus = "checking" | "downloading" | "ready" | "error" | "unsupported"

interface DownloadProgress {
  loaded: number
  total: number
  percentage: number
}

export function ModelManager({ onReady, compact = false }: ModelManagerProps) {
  const [status, setStatus] = useState<ModelStatus>("checking")
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [hardwareCheck, setHardwareCheck] = useState<HardwareCheckResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [showDetails, setShowDetails] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // 하드웨어 체크 및 모델 상태 확인
  const checkAndInitialize = useCallback(async () => {
    setStatus("checking")
    setErrorMessage("")
    setProgress(null)

    try {
      // 1. 하드웨어 체크
      const hwResult = await performHardwareCheck()
      setHardwareCheck(hwResult)

      if (!hwResult.overall.ready) {
        setStatus("unsupported")
        setErrorMessage(hwResult.overall.message)
        return
      }

      // 2. Chrome AI 상태 확인
      // @ts-ignore
      const availability = await LanguageModel.availability()

      if (availability === "no") {
        setStatus("unsupported")
        setErrorMessage("Chrome AI가 비활성화되어 있습니다.")
        return
      }

      if (availability === "readily") {
        setStatus("ready")
        onReady?.()
        return
      }

      // 3. 다운로드 필요 - 세션 생성으로 다운로드 트리거
      setStatus("downloading")
      await triggerDownload()
    } catch (error) {
      console.error("[ModelManager] Initialization error:", error)
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "초기화 중 오류가 발생했습니다.")
    }
  }, [onReady])

  // 모델 다운로드 트리거
  const triggerDownload = async () => {
    try {
      // @ts-ignore
      const session = await LanguageModel.create({
        monitor: (monitor: any) => {
          monitor.addEventListener("downloadprogress", (e: any) => {
            const loaded = e.loaded || 0
            const total = e.total || 1500000000 // ~1.5GB 추정
            const percentage = Math.round((loaded / total) * 100)

            setProgress({
              loaded,
              total,
              percentage: Math.min(percentage, 99), // 100%는 완료 시에만
            })
          })
        },
      })

      // 다운로드 완료
      session.destroy()
      setStatus("ready")
      setProgress({ loaded: 1, total: 1, percentage: 100 })
      onReady?.()
    } catch (error) {
      console.error("[ModelManager] Download error:", error)
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "모델 다운로드 중 오류가 발생했습니다.")
    }
  }

  // 재시도
  const handleRetry = async () => {
    setIsRetrying(true)
    await checkAndInitialize()
    setIsRetrying(false)
  }

  // 초기화
  useEffect(() => {
    checkAndInitialize()
  }, [checkAndInitialize])

  // 컴팩트 모드 (설정 패널용)
  if (compact) {
    return (
      <CompactModelStatus
        status={status}
        progress={progress}
        hardwareCheck={hardwareCheck}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    )
  }

  // 전체 온보딩 UI
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl">
      {/* 아이콘 및 상태 */}
      <StatusIcon status={status} progress={progress} />

      {/* 메인 메시지 */}
      <h2 className="text-xl font-bold text-white mt-6 mb-2">
        {getStatusTitle(status)}
      </h2>
      <p className="text-slate-400 text-center max-w-sm">
        {getStatusDescription(status, errorMessage)}
      </p>

      {/* 프로그레스 바 */}
      {status === "downloading" && progress && (
        <div className="w-full max-w-xs mt-6">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>AI 두뇌를 심는 중...</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
          </p>
        </div>
      )}

      {/* 하드웨어 정보 */}
      {hardwareCheck && (
        <div className="mt-6 w-full max-w-sm">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            시스템 정보
          </button>

          {showDetails && (
            <div className="mt-3 p-4 bg-slate-800/50 rounded-lg space-y-3 text-sm">
              {/* 브라우저 */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hardwareCheck.browser.isChrome ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  <Cpu className={`w-4 h-4 ${hardwareCheck.browser.isChrome ? "text-green-400" : "text-red-400"}`} />
                </div>
                <div>
                  <p className="text-slate-300">Chrome {hardwareCheck.browser.version}</p>
                  <p className="text-slate-500 text-xs">
                    {hardwareCheck.browser.isCanaryOrDev ? "호환 버전" : "업데이트 필요"}
                  </p>
                </div>
              </div>

              {/* GPU */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hardwareCheck.webGPU.supported ? "bg-green-500/20" : "bg-red-500/20"}`}>
                  <HardDrive className={`w-4 h-4 ${hardwareCheck.webGPU.supported ? "text-green-400" : "text-red-400"}`} />
                </div>
                <div>
                  <p className="text-slate-300">
                    {hardwareCheck.webGPU.supported ? "WebGPU 지원" : "WebGPU 미지원"}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {formatGPUInfo(hardwareCheck.webGPU.adapterInfo)}
                  </p>
                </div>
              </div>

              {/* Chrome AI */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hardwareCheck.chromeAI.available ? "bg-green-500/20" : "bg-yellow-500/20"}`}>
                  <Sparkles className={`w-4 h-4 ${hardwareCheck.chromeAI.available ? "text-green-400" : "text-yellow-400"}`} />
                </div>
                <div>
                  <p className="text-slate-300">
                    {getAIStatusText(hardwareCheck.chromeAI.status)}
                  </p>
                  <p className="text-slate-500 text-xs">Gemini Nano</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 제안사항 */}
      {(status === "unsupported" || status === "error") && hardwareCheck?.overall.suggestions.length > 0 && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg max-w-sm">
          <p className="text-amber-400 font-medium text-sm mb-2">해결 방법:</p>
          <ul className="text-slate-400 text-sm space-y-1">
            {hardwareCheck.overall.suggestions.map((suggestion, i) => (
              <li key={i} className={suggestion.startsWith("  •") ? "ml-4" : ""}>
                {suggestion.startsWith("  •") ? suggestion : `• ${suggestion}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 재시도 버튼 */}
      {(status === "error" || status === "unsupported") && (
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          {isRetrying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          다시 시도
        </button>
      )}

      {/* 준비 완료 */}
      {status === "ready" && (
        <div className="mt-6 px-6 py-2.5 bg-green-600/20 text-green-400 rounded-lg font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          AI 준비 완료
        </div>
      )}
    </div>
  )
}

// 상태 아이콘 컴포넌트
function StatusIcon({ status, progress }: { status: ModelStatus; progress: DownloadProgress | null }) {
  const baseClass = "w-20 h-20 rounded-full flex items-center justify-center"

  switch (status) {
    case "checking":
      return (
        <div className={`${baseClass} bg-slate-700`}>
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
        </div>
      )
    case "downloading":
      return (
        <div className={`${baseClass} bg-indigo-600/20 relative`}>
          <Download className="w-10 h-10 text-indigo-400" />
          {/* 원형 프로그레스 */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="rgba(99, 102, 241, 0.2)"
              strokeWidth="4"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="rgb(99, 102, 241)"
              strokeWidth="4"
              strokeDasharray={`${(progress?.percentage || 0) * 2.26} 226`}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
        </div>
      )
    case "ready":
      return (
        <div className={`${baseClass} bg-green-600/20`}>
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
      )
    case "error":
      return (
        <div className={`${baseClass} bg-red-600/20`}>
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
      )
    case "unsupported":
      return (
        <div className={`${baseClass} bg-amber-600/20`}>
          <AlertTriangle className="w-10 h-10 text-amber-400" />
        </div>
      )
  }
}

// 컴팩트 모드 (설정용)
function CompactModelStatus({
  status,
  progress,
  hardwareCheck,
  onRetry,
  isRetrying,
}: {
  status: ModelStatus
  progress: DownloadProgress | null
  hardwareCheck: HardwareCheckResult | null
  onRetry: () => void
  isRetrying: boolean
}) {
  return (
    <div className="p-4 bg-slate-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">AI 모델 상태</h3>
        <StatusBadge status={status} />
      </div>

      {/* 다운로드 진행률 */}
      {status === "downloading" && progress && (
        <div className="mb-3">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {progress.percentage}% - {formatBytes(progress.loaded)}
          </p>
        </div>
      )}

      {/* GPU 정보 */}
      {hardwareCheck?.webGPU.supported && (
        <p className="text-xs text-slate-500 mb-3">
          GPU: {formatGPUInfo(hardwareCheck.webGPU.adapterInfo)}
        </p>
      )}

      {/* 재다운로드 버튼 */}
      <button
        onClick={onRetry}
        disabled={isRetrying || status === "downloading"}
        className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {isRetrying ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        모델 다시 다운로드
      </button>
    </div>
  )
}

// 상태 배지
function StatusBadge({ status }: { status: ModelStatus }) {
  const configs = {
    checking: { bg: "bg-slate-600", text: "확인 중..." },
    downloading: { bg: "bg-indigo-600", text: "다운로드 중" },
    ready: { bg: "bg-green-600", text: "준비 완료" },
    error: { bg: "bg-red-600", text: "오류" },
    unsupported: { bg: "bg-amber-600", text: "미지원" },
  }
  const config = configs[status]

  return (
    <span className={`px-2 py-1 ${config.bg} text-white text-xs rounded-full`}>
      {config.text}
    </span>
  )
}

// 헬퍼 함수들
function getStatusTitle(status: ModelStatus): string {
  switch (status) {
    case "checking":
      return "시스템 확인 중..."
    case "downloading":
      return "AI 모델 다운로드 중"
    case "ready":
      return "Memex 준비 완료!"
    case "error":
      return "오류가 발생했습니다"
    case "unsupported":
      return "시스템 요구사항 미충족"
  }
}

function getStatusDescription(status: ModelStatus, errorMessage: string): string {
  switch (status) {
    case "checking":
      return "하드웨어와 브라우저 호환성을 확인하고 있습니다."
    case "downloading":
      return "Gemini Nano AI 모델을 다운로드하고 있습니다. 처음 한 번만 필요하며, 약 1.5GB입니다."
    case "ready":
      return "모든 준비가 완료되었습니다. AI 어시스턴트를 사용할 수 있습니다."
    case "error":
      return errorMessage || "알 수 없는 오류가 발생했습니다."
    case "unsupported":
      return errorMessage || "현재 시스템에서 AI 기능을 사용할 수 없습니다."
  }
}

function getAIStatusText(status: string): string {
  switch (status) {
    case "readily":
      return "모델 준비됨"
    case "after-download":
      return "다운로드 필요"
    case "no":
      return "비활성화됨"
    default:
      return "알 수 없음"
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
