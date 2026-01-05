import { useState } from "react"
import { MessageSquare, Trash2, Download, Plus, X, FileJson, FileText } from "lucide-react"
import clsx from "clsx"
import type { ChatSession } from "../types"
import {
  deleteSession,
  exportSession,
  exportSessionAsMarkdown,
  downloadFile,
} from "../lib/chat-storage"

interface SessionListProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (session: ChatSession) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
  onClose: () => void
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClose,
}: SessionListProps) {
  const [exportMenuId, setExportMenuId] = useState<string | null>(null)

  const handleExportJSON = (session: ChatSession) => {
    const content = exportSession(session)
    const filename = `memex-${session.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}-${Date.now()}.json`
    downloadFile(content, filename, "application/json")
    setExportMenuId(null)
  }

  const handleExportMarkdown = (session: ChatSession) => {
    const content = exportSessionAsMarkdown(session)
    const filename = `memex-${session.title.replace(/[^a-zA-Z0-9가-힣]/g, "_")}-${Date.now()}.md`
    downloadFile(content, filename, "text/markdown")
    setExportMenuId(null)
  }

  const handleDelete = async (sessionId: string) => {
    if (confirm("이 대화를 삭제하시겠습니까?")) {
      await deleteSession(sessionId)
      onDeleteSession(sessionId)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "어제"
    } else if (days < 7) {
      return `${days}일 전`
    } else {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    }
  }

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">대화 목록</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            새 대화
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">저장된 대화가 없습니다</p>
            <button
              onClick={onNewSession}
              className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
            >
              새 대화 시작하기
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={clsx(
                  "relative group",
                  currentSessionId === session.id && "bg-indigo-50"
                )}
              >
                <button
                  onClick={() => onSelectSession(session)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "p-2 rounded-lg shrink-0",
                        currentSessionId === session.id
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={clsx(
                            "font-medium text-sm truncate",
                            currentSessionId === session.id
                              ? "text-indigo-700"
                              : "text-slate-800"
                          )}
                        >
                          {session.title}
                        </h3>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {session.messages.length}개의 메시지
                      </p>
                    </div>
                  </div>
                </button>

                {/* Action Buttons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Export Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExportMenuId(exportMenuId === session.id ? null : session.id)
                      }}
                      className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                      title="내보내기"
                    >
                      <Download className="w-4 h-4 text-slate-500" />
                    </button>

                    {/* Export Menu */}
                    {exportMenuId === session.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 w-36">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportJSON(session)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <FileJson className="w-4 h-4" />
                          JSON으로 저장
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportMarkdown(session)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <FileText className="w-4 h-4" />
                          Markdown으로 저장
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(session.id)
                    }}
                    className="p-1.5 hover:bg-red-100 rounded transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-200 text-center">
        <p className="text-[10px] text-slate-400">
          총 {sessions.length}개의 대화 · 로컬 저장
        </p>
      </div>
    </div>
  )
}
