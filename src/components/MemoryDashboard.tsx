import { useState, useCallback } from "react"
import {
  Trash2,
  ExternalLink,
  Calendar,
  Globe,
  Loader2,
  Brain,
  AlertCircle,
  Search,
  X,
  Sparkles,
  Network,
} from "lucide-react"
import clsx from "clsx"
import { KnowledgeGraph } from "./KnowledgeGraph"

interface MemoryItem {
  id: string
  url: string
  title: string
  summary: string
  tags: string[]
  createdAt: number
  score?: number // 검색 시 유사도 점수
}

interface MemoryWithEmbedding extends MemoryItem {
  embedding?: number[]
}

interface MemoryDashboardProps {
  memories: MemoryItem[]
  isLoading: boolean
  onDelete: (id: string) => Promise<boolean>
  onClearAll: () => Promise<void>
  onRefresh: () => Promise<void>
  onSearch?: (query: string) => Promise<MemoryItem[]> // 시맨틱 검색
  onGetMemoriesWithEmbeddings?: () => Promise<MemoryWithEmbedding[]> // 그래프용
}

export function MemoryDashboard({
  memories,
  isLoading,
  onDelete,
  onClearAll,
  onRefresh,
  onSearch,
  onGetMemoriesWithEmbeddings,
}: MemoryDashboardProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 시맨틱 검색 상태
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MemoryItem[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // Knowledge Graph 상태
  const [showGraph, setShowGraph] = useState(false)
  const [graphMemories, setGraphMemories] = useState<MemoryWithEmbedding[]>([])
  const [isLoadingGraph, setIsLoadingGraph] = useState(false)

  // 그래프 열기
  const handleOpenGraph = useCallback(async () => {
    if (!onGetMemoriesWithEmbeddings) return

    setIsLoadingGraph(true)
    try {
      const memoriesWithEmbeddings = await onGetMemoriesWithEmbeddings()
      setGraphMemories(memoriesWithEmbeddings)
      setShowGraph(true)
    } catch (error) {
      console.error("Failed to load graph data:", error)
    } finally {
      setIsLoadingGraph(false)
    }
  }, [onGetMemoriesWithEmbeddings])

  // 모든 고유 태그 추출
  const allTags = Array.from(
    new Set(memories.flatMap((m) => m.tags || []))
  ).sort()

  // 표시할 메모리 결정: 검색결과 > 태그필터 > 전체
  const displayMemories = searchResults !== null
    ? searchResults
    : selectedTag
      ? memories.filter((m) => m.tags?.includes(selectedTag))
      : memories

  // 시맨틱 검색 실행
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !onSearch) return

    setIsSearching(true)
    setSelectedTag(null) // 태그 필터 초기화
    try {
      const results = await onSearch(searchQuery.trim())
      setSearchResults(results)
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, onSearch])

  // 검색 초기화
  const clearSearch = useCallback(() => {
    setSearchQuery("")
    setSearchResults(null)
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    const success = await onDelete(id)
    setDeletingId(null)

    // 검색 결과에서 삭제된 항목 제거 (검색 모드일 때)
    if (success && searchResults !== null) {
      setSearchResults((prev) =>
        prev ? prev.filter((m) => m.id !== id) : null
      )
    }
  }

  const handleClearAll = async () => {
    if (!confirm("모든 기억을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return
    }
    setIsClearing(true)
    await onClearAll()
    setIsClearing(false)
    // 검색 상태도 초기화
    clearSearch()
  }

  const handleCardClick = (url: string) => {
    chrome.tabs.create({ url })
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return "오늘"
    } else if (diffDays === 1) {
      return "어제"
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    } else {
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      })
    }
  }

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "")
    } catch {
      return url
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">기억을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (memories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            저장된 기억이 없습니다
          </h3>
          <p className="text-sm text-slate-500 max-w-xs">
            웹 페이지를 읽고 "기억하기" 버튼을 눌러
            <br />
            나만의 지식 저장소를 만들어보세요!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              {searchResults !== null ? "검색 결과" : "저장된 기억"}
            </span>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
              {displayMemories.length}개
              {(selectedTag || searchResults !== null) && ` / ${memories.length}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Graph View Button */}
            {onGetMemoriesWithEmbeddings && memories.length > 0 && (
              <button
                onClick={handleOpenGraph}
                disabled={isLoadingGraph}
                className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50 flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                title="지식 그래프로 보기"
              >
                {isLoadingGraph ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Network className="w-3 h-3" />
                )}
                그래프
              </button>
            )}
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isClearing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              전체 삭제
            </button>
          </div>
        </div>

        {/* Semantic Search Bar */}
        {onSearch && (
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="의미로 검색... 예: '그때 본 에러 해결법'"
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || isSearching}
                className={clsx(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5",
                  searchQuery.trim()
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Search Mode Indicator */}
            {searchResults !== null && (
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  "{searchQuery}" 시맨틱 검색 결과
                </span>
                <button
                  onClick={clearSearch}
                  className="text-[10px] text-slate-500 hover:text-slate-700"
                >
                  검색 초기화
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tag Filter Bar - 검색 중이 아닐 때만 표시 */}
        {searchResults === null && allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTag(null)}
              className={clsx(
                "px-2 py-1 text-[10px] font-medium rounded-full transition-colors",
                !selectedTag
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              전체
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={clsx(
                  "px-2 py-1 text-[10px] font-medium rounded-full transition-colors",
                  selectedTag === tag
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Memory Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayMemories.map((memory, index) => (
          <div
            key={memory.id}
            onClick={() => handleCardClick(memory.url)}
            className={clsx(
              "bg-white rounded-xl border border-slate-200 p-4 cursor-pointer",
              "hover:border-indigo-300 hover:shadow-md transition-all duration-200",
              "group"
            )}
          >
            {/* Title Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                {/* Score Badge - 검색 결과일 때만 표시 */}
                {memory.score !== undefined && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded text-white text-[10px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      {Math.round(memory.score * 100)}%
                    </div>
                    <span className="text-[10px] text-slate-400">유사도</span>
                  </div>
                )}
                <h3 className="font-medium text-slate-800 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {memory.title}
                </h3>
              </div>
              <button
                onClick={(e) => handleDelete(e, memory.id)}
                disabled={deletingId === memory.id}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="삭제"
              >
                {deletingId === memory.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Summary */}
            <p className="text-xs text-slate-500 line-clamp-2 mb-2">
              {memory.summary}
            </p>

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {memory.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-medium rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Meta Row */}
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span className="truncate max-w-[120px]">
                  {getDomain(memory.url)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(memory.createdAt)}</span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-3 h-3" />
                <span>열기</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Knowledge Graph Modal */}
      <KnowledgeGraph
        memories={graphMemories}
        isOpen={showGraph}
        onClose={() => setShowGraph(false)}
      />
    </div>
  )
}
