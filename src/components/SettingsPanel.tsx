import { useState, useRef } from "react"
import {
  Settings,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Trash2,
  Info,
  FileJson,
  Shield,
} from "lucide-react"
import clsx from "clsx"
import {
  exportMemories,
  importMemories,
  downloadBackup,
  type MemoryBackup,
} from "../lib/vector-db"

interface SettingsPanelProps {
  memoryCount: number
  onClearAll: () => Promise<void>
  onMemoryCountChange: () => Promise<void>
}

export function SettingsPanel({
  memoryCount,
  onClearAll,
  onMemoryCountChange,
}: SettingsPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 백업 내보내기
  const handleExport = async () => {
    setIsExporting(true)
    setMessage(null)

    try {
      const backup = await exportMemories()
      downloadBackup(backup)
      setMessage({
        type: "success",
        text: `${backup.memoryCount}개의 기억을 백업했습니다.`,
      })
    } catch (error) {
      console.error("Export failed:", error)
      setMessage({
        type: "error",
        text: `백업 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      })
    } finally {
      setIsExporting(false)
    }
  }

  // 파일 선택 트리거
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  // 백업 파일 읽기 및 복원
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 파일 확장자 확인
    if (!file.name.endsWith(".json")) {
      setMessage({
        type: "error",
        text: "JSON 파일만 가져올 수 있습니다.",
      })
      return
    }

    setIsImporting(true)
    setMessage(null)

    try {
      // 파일 읽기
      const text = await file.text()
      const backup: MemoryBackup = JSON.parse(text)

      // 복원 모드 선택 (기존 데이터가 있으면 확인)
      let mode: "replace" | "merge" = "merge"
      if (memoryCount > 0) {
        const shouldReplace = confirm(
          `현재 ${memoryCount}개의 기억이 있습니다.\n\n` +
            `[확인] - 기존 기억을 삭제하고 백업으로 대체\n` +
            `[취소] - 기존 기억에 백업 추가 (중복 URL 건너뜀)`
        )
        mode = shouldReplace ? "replace" : "merge"
      }

      // 복원 실행
      const result = await importMemories(backup, mode)

      if (result.success) {
        setMessage({
          type: "success",
          text: result.message,
        })
        // 메모리 카운트 업데이트
        await onMemoryCountChange()
      } else {
        setMessage({
          type: "error",
          text: result.message,
        })
      }
    } catch (error) {
      console.error("Import failed:", error)
      setMessage({
        type: "error",
        text: `복원 실패: ${error instanceof Error ? error.message : "잘못된 파일 형식"}`,
      })
    } finally {
      setIsImporting(false)
      // 같은 파일 재선택 허용
      e.target.value = ""
    }
  }

  // 모든 기억 삭제
  const handleClearAll = async () => {
    if (memoryCount === 0) {
      setMessage({
        type: "info",
        text: "삭제할 기억이 없습니다.",
      })
      return
    }

    const confirmed = confirm(
      `정말로 ${memoryCount}개의 기억을 모두 삭제하시겠습니까?\n\n` +
        `이 작업은 되돌릴 수 없습니다.\n` +
        `먼저 백업을 권장합니다.`
    )

    if (!confirmed) return

    setIsClearing(true)
    setMessage(null)

    try {
      await onClearAll()
      setMessage({
        type: "success",
        text: "모든 기억을 삭제했습니다.",
      })
    } catch (error) {
      console.error("Clear failed:", error)
      setMessage({
        type: "error",
        text: `삭제 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" />
          <span className="text-sm font-semibold text-slate-700">설정</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Storage Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <HardDrive className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">저장소 현황</h3>
              <p className="text-xs text-slate-500">로컬 브라우저 저장소</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">저장된 기억</span>
            <span className="text-lg font-bold text-indigo-600">{memoryCount}개</span>
          </div>
        </div>

        {/* Backup Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">데이터 백업</h3>
              <p className="text-xs text-slate-500">내 기억을 안전하게 보관하세요</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting || memoryCount === 0}
              className={clsx(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
                "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100",
                (isExporting || memoryCount === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>백업 중...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>내 기억 백업하기 (.json)</span>
                </>
              )}
            </button>

            {/* Import Button */}
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className={clsx(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
                "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100",
                isImporting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>복원 중...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>백업에서 복원하기</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                백업 파일에는 모든 기억(URL, 제목, 내용, 요약, 태그, 임베딩)이 포함됩니다.
                컴퓨터를 바꾸거나 브라우저 데이터가 삭제되어도 복원할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-700">위험 구역</h3>
              <p className="text-xs text-red-500">되돌릴 수 없는 작업</p>
            </div>
          </div>

          <button
            onClick={handleClearAll}
            disabled={isClearing || memoryCount === 0}
            className={clsx(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all",
              "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
              (isClearing || memoryCount === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isClearing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>삭제 중...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>모든 기억 삭제</span>
              </>
            )}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={clsx(
              "flex items-center gap-2 p-3 rounded-xl text-sm",
              message.type === "success" && "bg-green-50 text-green-700",
              message.type === "error" && "bg-red-50 text-red-700",
              message.type === "info" && "bg-blue-50 text-blue-700"
            )}
          >
            {message.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {message.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.type === "info" && <Info className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Version Info */}
        <div className="text-center py-4">
          <p className="text-[10px] text-slate-400">
            Memex v0.0.1 • Local-First Privacy
          </p>
        </div>
      </div>
    </div>
  )
}
