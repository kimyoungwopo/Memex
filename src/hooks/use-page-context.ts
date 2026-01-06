/**
 * Page Context Hook - 현재 페이지 텍스트 추출
 *
 * 현재 활성 탭의 페이지 내용을 추출하고 관리합니다.
 */

import { useState, useCallback, useEffect } from "react"
import { isYouTubeVideoUrl, extractVideoId } from "../lib/youtube"
import { isPdfUrl } from "../lib/pdf"
import { MAX_PAGE_CONTENT_LENGTH } from "../constants"

export interface PageContext {
  title: string
  url: string
  content: string
}

export type PageType = "normal" | "youtube" | "pdf"

export function usePageContext() {
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pageType, setPageType] = useState<PageType>("normal")
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null)

  // 페이지 타입 감지
  useEffect(() => {
    const checkPageType = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.url) {
          // YouTube 체크
          if (isYouTubeVideoUrl(tab.url)) {
            setPageType("youtube")
            setYoutubeVideoId(extractVideoId(tab.url))
          } else if (isPdfUrl(tab.url)) {
            setPageType("pdf")
            setYoutubeVideoId(null)
          } else {
            setPageType("normal")
            setYoutubeVideoId(null)
          }
        }
      } catch (error) {
        console.error("Page type check failed:", error)
      }
    }

    // 초기 체크
    checkPageType()

    // 탭 변경 리스너
    const handleTabChange = () => {
      checkPageType()
    }

    const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url) {
        checkPageType()
      }
    }

    chrome.tabs.onActivated.addListener(handleTabChange)
    chrome.tabs.onUpdated.addListener(handleTabUpdate)

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange)
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
    }
  }, [])

  // 현재 페이지 텍스트 추출
  const extractPageContent = useCallback(async (): Promise<PageContext | null> => {
    setIsLoading(true)
    try {
      // 현재 활성 탭 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.id || !tab.url) {
        throw new Error("탭 정보를 가져올 수 없습니다.")
      }

      // chrome:// 페이지는 스크립트 실행 불가
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        throw new Error("Chrome 내부 페이지에서는 사용할 수 없습니다.")
      }

      // 페이지 텍스트 추출
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 불필요한 요소 제거 후 텍스트 추출
          const clone = document.body.cloneNode(true) as HTMLElement
          clone.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove())

          // 본문 텍스트 정리
          let text = clone.innerText || ""
          // 연속 공백/줄바꿈 정리
          text = text.replace(/\s+/g, " ").trim()
          // 최대 길이 제한 (상수는 content script 내에서 직접 사용 불가)
          const MAX_LENGTH = 8000
          if (text.length > MAX_LENGTH) {
            text = text.substring(0, MAX_LENGTH) + "..."
          }
          return text
        },
      })

      const content = results[0]?.result || ""

      if (!content || content.length < 50) {
        throw new Error("페이지에서 충분한 텍스트를 찾을 수 없습니다.")
      }

      const context: PageContext = {
        title: tab.title || "제목 없음",
        url: tab.url,
        content,
      }

      setPageContext(context)
      return context
    } catch (error) {
      console.error("페이지 추출 실패:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 컨텍스트 초기화
  const clearPageContext = useCallback(() => {
    setPageContext(null)
  }, [])

  return {
    pageContext,
    setPageContext,
    isLoading,
    pageType,
    youtubeVideoId,
    extractPageContent,
    clearPageContext,
  }
}
