/**
 * MemoryPanel - 저장된 기억 목록 표시 및 관리
 */

import { useState, useEffect } from "react"
import {
  Brain,
  X,
  Trash2,
  ExternalLink,
  Clock,
  Search,
  AlertTriangle,
} from "lucide-react"
import clsx from "clsx"

interface MemoryItem {
  id: string
  url: string
  title: string
  summary: string
  createdAt: number
}

interface MemoryPanelProps {
  isOpen: boolean
  onClose: () => void
  memories: MemoryItem[]
  onDelete: (id: string) => Promise<boolean>
  onClearAll: () => Promise<void>
  isLoading: boolean
}

export function MemoryPanel({
  isOpen,
  onClose,
  memories,
  onDelete,
  onClearAll,
  isLoading,
}: MemoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 검색 필터링
  const filteredMemories = memories.filter(
    (mem) =>
      mem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.summary.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 날짜 포맷
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return "방금 전"
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    })
  }

  // 삭제 핸들러
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  // 전체 삭제 핸들러
  const handleClearAll = async () => {
    await onClearAll()
    setShowConfirmClear(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-sm bg-white shadow-xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-slate-800">저장된 기억</h2>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              {memories.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="기억 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? "검색 결과가 없습니다"
                  : "저장된 기억이 없습니다"}
              </p>
              {!searchQuery && (
                <p className="text-xs text-slate-400 mt-1">
                  "기억하기" 버튼으로 페이지를 저장하세요
                </p>
              )}
            </div>
          ) : (
            filteredMemories.map((mem) => (
              <div
                key={mem.id}
                className={clsx(
                  "group p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors",
                  deletingId === mem.id && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-slate-800 truncate">
                      {mem.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {mem.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-400">
                        {formatDate(mem.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={mem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="페이지 열기"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(mem.id)}
                      disabled={deletingId === mem.id}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {memories.length > 0 && (
          <div className="p-3 border-t border-slate-200">
            {showConfirmClear ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-amber-600 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>모든 기억을 삭제할까요?</span>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setShowConfirmClear(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="w-full text-xs text-slate-500 hover:text-red-600 py-2 transition-colors"
              >
                모든 기억 삭제
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
