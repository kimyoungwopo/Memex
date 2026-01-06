/**
 * Serendipity Engine Hook - 관련 기억 자동 알림
 *
 * 브라우징 중 현재 페이지와 관련된 저장된 기억을 자동으로 찾아 알림합니다.
 */

import { useState, useEffect, useCallback } from "react"
import type { MemorySearchResult } from "./use-memory"
import {
  SIMILARITY_THRESHOLD,
  MAX_RECALL_QUERY_LENGTH,
  RELATED_MEMORIES_LIMIT,
  MAX_SERENDIPITY_DISPLAY,
} from "../constants"

export interface SerendipityMemory {
  id: string
  url: string
  title: string
  summary: string
  score: number
  createdAt: number
}

interface UseSerendipityOptions {
  memoryStatus: "idle" | "loading" | "ready" | "error"
  recallMemories: (query: string, limit?: number) => Promise<MemorySearchResult[]>
}

export function useSerendipity({ memoryStatus, recallMemories }: UseSerendipityOptions) {
  const [serendipityMemories, setSerendipityMemories] = useState<SerendipityMemory[]>([])
  const [showBanner, setShowBanner] = useState(false)
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = useState("")

  // 배지 업데이트
  const updateBadge = useCallback((count: number) => {
    chrome.runtime.sendMessage({
      type: "SET_BADGE",
      count,
    }).catch(() => {
      // 메시지 전송 실패 무시 (사이드 패널이 닫혀있을 수 있음)
    })
  }, [])

  // 배너 닫기
  const closeBanner = useCallback(() => {
    setShowBanner(false)
    updateBadge(0)
  }, [updateBadge])

  // 세렌디피티 체크
  useEffect(() => {
    let mounted = true

    const checkSerendipity = async () => {
      // 메모리 시스템이 준비되지 않았으면 스킵
      if (memoryStatus !== "ready") return

      try {
        const result = await chrome.storage.local.get("serendipityPage")
        const pageData = result.serendipityPage

        if (!pageData || !pageData.content || pageData.content.length < 100) return

        // 이미 분석한 URL이면 스킵
        if (pageData.url === lastAnalyzedUrl) return

        if (!mounted) return

        console.log("[Serendipity] Checking for related memories:", pageData.title)
        setLastAnalyzedUrl(pageData.url)

        // 현재 페이지로 유사 기억 검색
        const relatedMemories = await recallMemories(
          pageData.content.slice(0, MAX_RECALL_QUERY_LENGTH),
          RELATED_MEMORIES_LIMIT
        )

        if (!mounted) return

        // 유사도 임계값 이상인 기억만 필터링
        const highSimilarityMemories = relatedMemories.filter(
          (m) => m.score >= SIMILARITY_THRESHOLD && m.url !== pageData.url
        )

        if (highSimilarityMemories.length > 0) {
          console.log("[Serendipity] Found", highSimilarityMemories.length, "related memories!")

          const memories: SerendipityMemory[] = highSimilarityMemories.slice(0, MAX_SERENDIPITY_DISPLAY).map((m) => ({
            id: m.id,
            url: m.url,
            title: m.title,
            summary: m.summary,
            score: m.score,
            createdAt: m.createdAt,
          }))

          setSerendipityMemories(memories)
          setShowBanner(true)
          updateBadge(memories.length)
        } else {
          setSerendipityMemories([])
          setShowBanner(false)
          updateBadge(0)
        }
      } catch (error) {
        console.error("[Serendipity] Search error:", error)
      }
    }

    // 초기 체크
    checkSerendipity()

    // Storage 변경 리스너
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.serendipityPage?.newValue) {
        checkSerendipity()
      }
    }

    chrome.storage.local.onChanged.addListener(listener)

    return () => {
      mounted = false
      chrome.storage.local.onChanged.removeListener(listener)
    }
  }, [memoryStatus, recallMemories, lastAnalyzedUrl, updateBadge])

  return {
    serendipityMemories,
    showBanner,
    closeBanner,
  }
}
