/**
 * YouTube Hook - YouTube 영상 분석 및 자막 추출
 *
 * YouTube 페이지 감지, 자막 추출, 요약 생성을 담당합니다.
 */

import { useState, useEffect, useCallback } from "react"
import {
  isYouTubeVideoUrl,
  extractVideoId,
  parseTranscriptXml,
  formatTimestamp,
  type TranscriptSegment,
} from "../lib/youtube"

export interface VideoAnalysis {
  url: string
  title: string
  channelName: string
  duration: number
  summary: string
  transcript: string
}

export interface YouTubeState {
  isYouTubePage: boolean
  videoId: string | null
  isAnalyzing: boolean
  transcript: TranscriptSegment[] | null
  lastAnalysis: VideoAnalysis | null
  error: string | null
  progress: string | null
}

interface UseYouTubeOptions {
  generate: (prompt: string) => Promise<string>
  aiStatus: string
}

export function useYouTube({ generate, aiStatus }: UseYouTubeOptions) {
  const [state, setState] = useState<YouTubeState>({
    isYouTubePage: false,
    videoId: null,
    isAnalyzing: false,
    transcript: null,
    lastAnalysis: null,
    error: null,
    progress: null,
  })

  // 페이지 타입 감지
  useEffect(() => {
    const checkPageType = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.url) {
          const isYT = isYouTubeVideoUrl(tab.url)
          const videoId = isYT ? extractVideoId(tab.url) : null
          setState(prev => ({
            ...prev,
            isYouTubePage: isYT,
            videoId,
            // 페이지 변경 시 이전 분석 결과 초기화
            ...(prev.videoId !== videoId ? {
              transcript: null,
              lastAnalysis: null,
              error: null,
            } : {}),
          }))
        }
      } catch (error) {
        console.error("[useYouTube] Page type check failed:", error)
      }
    }

    checkPageType()

    const handleTabChange = () => checkPageType()
    const handleTabUpdate = (_: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url) checkPageType()
    }

    chrome.tabs.onActivated.addListener(handleTabChange)
    chrome.tabs.onUpdated.addListener(handleTabUpdate)

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange)
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
    }
  }, [])

  // 프로그레스 업데이트 헬퍼
  const updateProgress = useCallback((progress: string | null) => {
    setState(prev => ({ ...prev, progress }))
  }, [])

  // DOM에서 자막 추출 (스크립트 패널 활용)
  const extractTranscriptFromDOM = useCallback(async (tabId: number): Promise<{
    segments: TranscriptSegment[]
    title: string
    channelName: string
    duration: number
  } | null> => {
    updateProgress("스크립트 패널에서 자막 추출 중...")

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        // 비디오 정보 추출
        const getVideoInfo = () => ({
          title: document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
                 document.title.replace(" - YouTube", ""),
          channelName: document.querySelector("#owner #channel-name a, ytd-channel-name a")?.textContent?.trim() || "",
          duration: (document.querySelector("video") as HTMLVideoElement)?.duration || 0,
        })

        // 스크립트 패널 찾기 함수
        const findTranscriptPanel = () => {
          return document.querySelector(
            "ytd-transcript-renderer, " +
            "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript'], " +
            "#panels ytd-engagement-panel-section-list-renderer"
          )
        }

        // 이미 열려있는 스크립트 패널 확인
        let transcriptPanel = findTranscriptPanel()

        // 스크립트 패널이 없으면 열기 시도
        if (!transcriptPanel) {
          console.log("[YouTube DOM] Transcript panel not found, trying to open...")

          // 방법 1: 설명란 펼치기 → "스크립트 표시" 버튼 찾기
          const expandButton = document.querySelector("#expand, tp-yt-paper-button#expand") as HTMLElement
          if (expandButton) {
            expandButton.click()
            await new Promise(r => setTimeout(r, 800))
          }

          // 설명란 내 "스크립트 표시" 버튼 찾기
          const descriptionSection = document.querySelector("#description-inner, ytd-text-inline-expander")
          if (descriptionSection) {
            const transcriptBtn = descriptionSection.querySelector("button, ytd-button-renderer") as HTMLElement
            if (transcriptBtn && (transcriptBtn.textContent?.includes("스크립트") || transcriptBtn.textContent?.includes("transcript"))) {
              transcriptBtn.click()
              await new Promise(r => setTimeout(r, 1500))
            }
          }

          transcriptPanel = findTranscriptPanel()

          // 방법 2: 더보기(...) 메뉴 → "스크립트 표시"
          if (!transcriptPanel) {
            const moreButtons = document.querySelectorAll(
              "ytd-menu-renderer yt-icon-button, " +
              "ytd-menu-renderer button[aria-label], " +
              "#top-level-buttons-computed > ytd-button-renderer"
            )

            for (const btn of moreButtons) {
              const ariaLabel = btn.getAttribute("aria-label")?.toLowerCase() || ""
              if (ariaLabel.includes("more") || ariaLabel.includes("기타") || ariaLabel.includes("actions")) {
                (btn as HTMLElement).click()
                await new Promise(r => setTimeout(r, 600))
                break
              }
            }

            // 메뉴에서 "스크립트 표시" 클릭
            const menuItems = document.querySelectorAll(
              "ytd-menu-service-item-renderer, " +
              "tp-yt-paper-item, " +
              "ytd-menu-popup-renderer tp-yt-paper-listbox > *"
            )

            for (const item of menuItems) {
              const text = item.textContent?.toLowerCase() || ""
              if (text.includes("transcript") || text.includes("스크립트")) {
                console.log("[YouTube DOM] Found transcript menu item, clicking...")
                ;(item as HTMLElement).click()
                await new Promise(r => setTimeout(r, 1500))
                break
              }
            }

            // ESC로 메뉴 닫기 (패널은 유지)
            document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

            transcriptPanel = findTranscriptPanel()
          }

          // 방법 3: engagement panels에서 직접 찾기
          if (!transcriptPanel) {
            const panels = document.querySelectorAll("ytd-engagement-panel-section-list-renderer")
            for (const panel of panels) {
              if (panel.querySelector("ytd-transcript-segment-renderer, ytd-transcript-segment-list-renderer")) {
                transcriptPanel = panel
                break
              }
            }
          }
        }

        if (!transcriptPanel) {
          console.log("[YouTube DOM] Transcript panel not found after all attempts")
          return { success: false, error: "스크립트 패널을 찾을 수 없습니다. YouTube에서 직접 '스크립트' 버튼을 눌러주세요." }
        }

        console.log("[YouTube DOM] Transcript panel found:", transcriptPanel.tagName)

        // 스크립트 세그먼트 추출
        const segments: { start: number; duration: number; text: string }[] = []

        // 새로운 YouTube UI의 transcript segments
        const transcriptSegments = transcriptPanel.querySelectorAll(
          "ytd-transcript-segment-renderer, " +
          "ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer, " +
          "[class*='transcript-segment'], " +
          "div[class*='segment-']"
        )

        console.log("[YouTube DOM] Found segments:", transcriptSegments.length)

        for (const segment of transcriptSegments) {
          // 타임스탬프 추출
          const timestampEl = segment.querySelector(
            ".segment-timestamp, " +
            "[class*='timestamp'], " +
            "div[class*='time']"
          )
          const textEl = segment.querySelector(
            ".segment-text, " +
            "[class*='segment-text'], " +
            "yt-formatted-string[class*='segment']"
          )

          if (!timestampEl && !textEl) {
            // 대체 방법: 직접 자식 요소에서 추출
            const children = segment.children
            if (children.length >= 2) {
              const timeText = children[0]?.textContent?.trim() || "0:00"
              const contentText = children[1]?.textContent?.trim() || ""

              if (contentText) {
                const parts = timeText.split(":").map(Number)
                let seconds = 0
                if (parts.length === 2) seconds = parts[0] * 60 + parts[1]
                else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]

                segments.push({
                  start: seconds,
                  duration: 5,
                  text: contentText,
                })
              }
            }
            continue
          }

          const timeText = timestampEl?.textContent?.trim() || "0:00"
          const text = textEl?.textContent?.trim() || segment.textContent?.replace(timeText, "").trim() || ""

          if (text) {
            const parts = timeText.split(":").map(Number)
            let seconds = 0
            if (parts.length === 2) seconds = parts[0] * 60 + parts[1]
            else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]

            segments.push({
              start: seconds,
              duration: 5,
              text,
            })
          }
        }

        if (segments.length === 0) {
          return { success: false, error: "스크립트 세그먼트를 찾을 수 없습니다" }
        }

        const videoInfo = getVideoInfo()
        return {
          success: true,
          segments,
          ...videoInfo,
        }
      },
    })

    const data = result[0]?.result
    if (!data?.success || !data.segments) {
      console.log("[useYouTube] DOM extraction failed:", data?.error)
      return null
    }

    return {
      segments: data.segments,
      title: data.title,
      channelName: data.channelName,
      duration: data.duration,
    }
  }, [updateProgress])

  // 자막 추출 (DOM 우선, API fallback)
  const extractTranscript = useCallback(async (): Promise<{
    segments: TranscriptSegment[]
    title: string
    channelName: string
    duration: number
  }> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab.id) throw new Error("탭을 찾을 수 없습니다.")

    updateProgress("자막 정보 확인 중...")

    // 현재 URL에서 videoId 추출
    const currentVideoId = tab.url ? new URL(tab.url).searchParams.get("v") : null
    if (!currentVideoId) {
      throw new Error("YouTube 영상 ID를 찾을 수 없습니다.")
    }

    // 1차 시도: DOM에서 직접 추출 (가장 안정적)
    updateProgress("스크립트 패널 확인 중...")
    const domResult = await extractTranscriptFromDOM(tab.id)
    if (domResult && domResult.segments.length > 0) {
      updateProgress(`자막 ${domResult.segments.length}개 세그먼트 추출 완료 (DOM)`)
      return domResult
    }

    // 2차 시도: API 기반 추출
    updateProgress("API로 자막 추출 시도 중...")

    // Content Script 실행: 여러 방법으로 자막 URL 추출 시도 (SPA 대응 강화)
    const extractResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (expectedVideoId: string) => {
        // videoId 검증 헬퍼 - stale 데이터 방지
        const isValidResponse = (response: any): boolean => {
          const foundId = response?.videoDetails?.videoId
          if (!foundId) return false
          if (foundId !== expectedVideoId) {
            console.log(`[YouTube] Stale data detected: found ${foundId}, expected ${expectedVideoId}`)
            return false
          }
          return true
        }

        // JSON 객체 추출 헬퍼 (bracket matching)
        const extractJsonObject = (text: string, startIndex: number): string | null => {
          let depth = 0
          let inString = false
          let escape = false
          let start = -1

          for (let i = startIndex; i < text.length; i++) {
            const char = text[i]

            if (escape) {
              escape = false
              continue
            }

            if (char === "\\") {
              escape = true
              continue
            }

            if (char === '"' && !escape) {
              inString = !inString
              continue
            }

            if (inString) continue

            if (char === "{") {
              if (depth === 0) start = i
              depth++
            } else if (char === "}") {
              depth--
              if (depth === 0 && start !== -1) {
                return text.slice(start, i + 1)
              }
            }
          }
          return null
        }

        // 여러 소스에서 playerResponse 추출 시도
        const tryGetPlayerResponse = (): any | null => {
          // 방법 1: movie_player API (SPA에서 가장 신뢰성 높음)
          try {
            const player = document.querySelector("#movie_player") as any
            if (player?.getPlayerResponse) {
              const response = player.getPlayerResponse()
              if (isValidResponse(response)) {
                console.log("[YouTube] Found via movie_player.getPlayerResponse()")
                return response
              }
            }
          } catch (e) {
            console.log("[YouTube] movie_player error:", e)
          }

          // 방법 2: yt.player.getPlayerByElement (대체 API)
          try {
            const player = document.querySelector("#movie_player")
            // @ts-ignore
            if (window.yt?.player?.getPlayerByElement) {
              // @ts-ignore
              const ytPlayer = window.yt.player.getPlayerByElement(player)
              if (ytPlayer?.getPlayerResponse) {
                const response = ytPlayer.getPlayerResponse()
                if (isValidResponse(response)) {
                  console.log("[YouTube] Found via yt.player.getPlayerByElement()")
                  return response
                }
              }
            }
          } catch (e) {
            console.log("[YouTube] yt.player error:", e)
          }

          // 방법 3: ytInitialPlayerResponse (초기 로드 시)
          try {
            // @ts-ignore
            if (window.ytInitialPlayerResponse && isValidResponse(window.ytInitialPlayerResponse)) {
              console.log("[YouTube] Found via ytInitialPlayerResponse")
              // @ts-ignore
              return window.ytInitialPlayerResponse
            }
          } catch {}

          // 방법 4: ytplayer.config (레거시)
          try {
            // @ts-ignore
            const config = window.ytplayer?.config?.args
            if (config?.raw_player_response && isValidResponse(config.raw_player_response)) {
              console.log("[YouTube] Found via ytplayer.config.args.raw_player_response")
              return config.raw_player_response
            }
            if (config?.player_response) {
              const parsed = JSON.parse(config.player_response)
              if (isValidResponse(parsed)) {
                console.log("[YouTube] Found via ytplayer.config.args.player_response (parsed)")
                return parsed
              }
            }
          } catch {}

          // 방법 5: 스크립트 태그에서 추출 (bracket matching 사용)
          try {
            const scripts = document.querySelectorAll("script")
            for (const script of scripts) {
              const text = script.textContent || ""
              const marker = "ytInitialPlayerResponse"
              const idx = text.indexOf(marker)
              if (idx === -1) continue

              // '=' 다음의 '{' 찾기
              const eqIdx = text.indexOf("=", idx + marker.length)
              if (eqIdx === -1) continue

              const jsonStr = extractJsonObject(text, eqIdx + 1)
              if (jsonStr) {
                try {
                  const parsed = JSON.parse(jsonStr)
                  if (isValidResponse(parsed)) {
                    console.log("[YouTube] Found via script tag parsing")
                    return parsed
                  }
                } catch {}
              }
            }
          } catch {}

          return null
        }

        try {
          // 기본 비디오 정보 (fallback)
          const defaultInfo = {
            title: document.title.replace(" - YouTube", "").replace(/ - YouTube$/, ""),
            channelName: document.querySelector("#channel-name a, #owner #channel-name yt-formatted-string, ytd-channel-name yt-formatted-string")?.textContent?.trim() || "",
            duration: 0,
          }

          // 즉시 시도
          let playerResponse = tryGetPlayerResponse()

          // 없으면 잠시 대기 후 재시도 (플레이어 로딩 대기)
          if (!playerResponse) {
            console.log("[YouTube] First attempt failed, waiting for player...")
          }

          // 3단계: 여전히 없으면 비디오 요소 확인 후 안내
          if (!playerResponse) {
            const videoElement = document.querySelector("video")
            if (!videoElement) {
              return {
                status: "error",
                message: "YouTube 영상 플레이어를 찾을 수 없습니다. 영상이 로드될 때까지 기다린 후 다시 시도해주세요."
              }
            }
            return {
              status: "error",
              message: "YouTube 플레이어 정보를 가져올 수 없습니다. 페이지를 새로고침(F5) 후 영상이 재생되면 다시 시도해주세요.",
              needsRefresh: true,
            }
          }

          const videoDetails = playerResponse.videoDetails || {}
          const captions = playerResponse.captions

          // 비디오 정보
          const videoInfo = {
            title: videoDetails.title || defaultInfo.title,
            channelName: videoDetails.author || defaultInfo.channelName,
            duration: parseInt(videoDetails.lengthSeconds) || 0,
          }

          // 자막 트랙 찾기
          if (captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            const tracks = captions.playerCaptionsTracklistRenderer.captionTracks
            // 한국어 → 영어 → 첫 번째 순으로 선택
            const track = tracks.find((t: any) => t.languageCode === "ko") ||
                         tracks.find((t: any) => t.languageCode === "en") ||
                         tracks[0]

            if (track?.baseUrl) {
              // Caption URL 만료 검증
              try {
                const captionUrl = new URL(track.baseUrl)
                const expire = captionUrl.searchParams.get("expire")
                if (expire) {
                  const expireTime = parseInt(expire) * 1000
                  if (expireTime < Date.now()) {
                    console.log("[YouTube] Caption URL expired, need page refresh")
                    return {
                      status: "error",
                      message: "자막 URL이 만료되었습니다. 페이지를 새로고침(F5) 후 다시 시도해주세요.",
                      needsRefresh: true,
                      ...videoInfo,
                    }
                  }
                }
              } catch (urlErr) {
                console.warn("[YouTube] Failed to parse caption URL:", urlErr)
              }

              return {
                status: "caption_url",
                captionUrl: track.baseUrl,
                language: track.languageCode,
                ...videoInfo,
              }
            }
          }

          // 자막이 없는 경우
          return {
            status: "no_transcript",
            message: "이 영상에는 자막이 없습니다.",
            ...videoInfo,
          }
        } catch (e) {
          console.error("[YouTube] Extract error:", e)
          return { status: "error", message: "자막 정보 추출 실패: " + (e as Error).message }
        }
      },
      args: [currentVideoId],
    })

    // 첫 번째 시도 실패 시 재시도 (플레이어 로딩 대기)
    let result = extractResult[0]?.result
    if (!result || result.status === "error") {
      updateProgress("플레이어 로딩 대기 중...")

      // 2초 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 2000))

      const retryResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: (expectedVideoId: string) => {
          // 동일한 로직 재실행 (간소화 버전)
          try {
            const player = document.querySelector("#movie_player") as any
            if (player?.getPlayerResponse) {
              const response = player.getPlayerResponse()
              if (response?.videoDetails?.videoId === expectedVideoId) {
                console.log("[YouTube] Retry: Found via movie_player")

                const videoDetails = response.videoDetails || {}
                const captions = response.captions

                const videoInfo = {
                  title: videoDetails.title || document.title.replace(" - YouTube", ""),
                  channelName: videoDetails.author || "",
                  duration: parseInt(videoDetails.lengthSeconds) || 0,
                }

                if (captions?.playerCaptionsTracklistRenderer?.captionTracks) {
                  const tracks = captions.playerCaptionsTracklistRenderer.captionTracks
                  const track = tracks.find((t: any) => t.languageCode === "ko") ||
                               tracks.find((t: any) => t.languageCode === "en") ||
                               tracks[0]

                  if (track?.baseUrl) {
                    return {
                      status: "caption_url",
                      captionUrl: track.baseUrl,
                      language: track.languageCode,
                      ...videoInfo,
                    }
                  }
                }

                return {
                  status: "no_transcript",
                  message: "이 영상에는 자막이 없습니다.",
                  ...videoInfo,
                }
              }
            }
            return { status: "error", message: "재시도 실패: 플레이어 정보를 찾을 수 없습니다." }
          } catch (e) {
            return { status: "error", message: "재시도 실패: " + (e as Error).message }
          }
        },
        args: [currentVideoId],
      })

      result = retryResult[0]?.result
    }

    if (!result || result.status === "error") {
      throw new Error(result?.message || "자막 정보를 가져올 수 없습니다.")
    }

    if (result.status === "no_transcript") {
      throw new Error("이 영상에는 자막이 없습니다. 영상에서 자막(CC) 아이콘을 확인해주세요.")
    }

    // 자막 다운로드
    updateProgress("자막 다운로드 중...")

    let captionData: string

    // Blob URL 감지: blob URL은 생성된 탭에서만 접근 가능
    if (result.captionUrl.startsWith("blob:")) {
      console.log("[useYouTube] Blob URL detected, fetching via Content Script")

      // Content Script에서 직접 fetch (같은 origin이므로 접근 가능)
      const blobFetchResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: async (url: string) => {
          try {
            const res = await fetch(url)
            if (!res.ok) {
              return { success: false, error: `HTTP ${res.status}` }
            }
            const text = await res.text()
            return { success: true, data: text }
          } catch (e) {
            return { success: false, error: (e as Error).message }
          }
        },
        args: [result.captionUrl],
      })

      const blobResult = blobFetchResult[0]?.result
      if (!blobResult?.success || !blobResult.data) {
        throw new Error(`Blob URL 자막 다운로드 실패: ${blobResult?.error || "알 수 없는 오류"}`)
      }
      captionData = blobResult.data
    } else {
      // Content Script에서 fetch (YouTube 쿠키/세션 포함)
      console.log("[useYouTube] Fetching caption via content script:", result.captionUrl.slice(0, 100))

      const fetchResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: async (url: string) => {
          try {
            // Content Script 컨텍스트에서 fetch → YouTube 쿠키 자동 포함
            const res = await fetch(url, {
              credentials: "include", // 쿠키 포함
              headers: {
                "Accept": "text/xml, application/xml, */*",
              },
            })

            if (!res.ok) {
              return { success: false, error: `HTTP ${res.status} ${res.statusText}` }
            }

            const text = await res.text()
            console.log("[YouTube] Caption fetched, length:", text.length)

            if (!text || text.length < 10) {
              return { success: false, error: "서버가 빈 응답을 반환했습니다" }
            }

            return { success: true, data: text }
          } catch (e) {
            return { success: false, error: (e as Error).message }
          }
        },
        args: [result.captionUrl],
      })

      const captionResult = fetchResult[0]?.result
      if (!captionResult?.success || !captionResult.data) {
        const errorMsg = captionResult?.error || "응답 데이터 없음"
        console.error("[useYouTube] Caption fetch failed:", errorMsg)

        if (errorMsg.includes("403") || errorMsg.includes("410") || errorMsg.includes("expired")) {
          throw new Error("자막 URL이 만료되었습니다. 페이지를 새로고침(F5) 후 다시 시도해주세요.")
        }
        throw new Error(`자막 데이터를 다운로드할 수 없습니다: ${errorMsg}`)
      }
      captionData = captionResult.data
    }

    // 자막 파싱
    const segments = parseTranscriptXml(captionData)
    if (segments.length === 0) {
      throw new Error("자막을 파싱할 수 없습니다.")
    }

    updateProgress(`자막 ${segments.length}개 세그먼트 추출 완료`)

    return {
      segments,
      title: result.title,
      channelName: result.channelName,
      duration: result.duration,
    }
  }, [updateProgress])

  // 청크별 요약 후 통합 (긴 영상용)
  const summarizeChunks = useCallback(async (
    segments: TranscriptSegment[],
    title: string,
    channelName: string,
    duration: number
  ): Promise<string> => {
    const totalText = segments.map(s => s.text).join(" ")
    const durationMin = Math.ceil(duration / 60)

    // 짧은 영상 (4000자 미만): 전체 한번에 요약
    if (totalText.length < 4000) {
      updateProgress("AI 요약 생성 중...")

      const prompt = `다음 YouTube 영상 자막을 분석하여 요약해줘.

**영상 제목:** ${title}
**채널:** ${channelName}
**길이:** ${durationMin}분

**자막 내용:**
${segments.map(s => `[${formatTimestamp(s.start)}] ${s.text}`).join("\n")}

---

다음 형식으로 답변해줘:

## 📺 영상 요약

### 핵심 내용 (3줄)
1.
2.
3.

### 주요 타임스탬프
- [MM:SS] 주요 내용 설명
- [MM:SS] 주요 내용 설명
- [MM:SS] 주요 내용 설명

### 한 줄 결론`

      return await generate(prompt)
    }

    // 긴 영상: 청크별 요약 후 통합
    const CHUNK_SIZE = 3000
    const chunks: { text: string; startTime: number; endTime: number }[] = []
    let currentChunk = ""
    let chunkStartTime = 0
    let chunkEndTime = 0

    for (const segment of segments) {
      const segmentText = `[${formatTimestamp(segment.start)}] ${segment.text} `

      if (currentChunk.length + segmentText.length > CHUNK_SIZE) {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            startTime: chunkStartTime,
            endTime: chunkEndTime,
          })
        }
        currentChunk = segmentText
        chunkStartTime = segment.start
        chunkEndTime = segment.start + segment.duration
      } else {
        if (!currentChunk) chunkStartTime = segment.start
        currentChunk += segmentText
        chunkEndTime = segment.start + segment.duration
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startTime: chunkStartTime,
        endTime: chunkEndTime,
      })
    }

    // 각 청크별 핵심 추출
    const chunkSummaries: string[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      updateProgress(`청크 분석 중... (${i + 1}/${chunks.length})`)

      const chunkPrompt = `다음은 YouTube 영상 "${title}"의 일부 자막이야.
시간대: ${formatTimestamp(chunk.startTime)} ~ ${formatTimestamp(chunk.endTime)}

${chunk.text}

---
이 구간의 핵심 내용을 2-3문장으로 요약하고, 중요한 타임스탬프가 있다면 [MM:SS] 형식으로 1-2개 포함해줘.`

      const chunkSummary = await generate(chunkPrompt)
      chunkSummaries.push(`**[${formatTimestamp(chunk.startTime)} ~ ${formatTimestamp(chunk.endTime)}]**\n${chunkSummary}`)
    }

    // 최종 통합 요약
    updateProgress("최종 요약 생성 중...")

    const integrationPrompt = `다음은 ${durationMin}분 길이 YouTube 영상 "${title}"(채널: ${channelName})의 구간별 요약이야.

${chunkSummaries.join("\n\n")}

---

위 내용을 바탕으로 전체 영상을 다음 형식으로 종합 요약해줘:

## 📺 영상 요약

### 핵심 내용 (3-5줄)
1.
2.
3.

### 주요 타임스탬프
- [MM:SS] 내용
- [MM:SS] 내용
- [MM:SS] 내용
(가장 중요한 5개 이내)

### 한 줄 결론`

    return await generate(integrationPrompt)
  }, [generate, updateProgress])

  // 분석 강제 취소
  const cancelAnalysis = useCallback(() => {
    console.log("[useYouTube] Cancelling analysis")
    setState(prev => ({
      ...prev,
      isAnalyzing: false,
      error: null,
      progress: null,
    }))
  }, [])

  // 영상 분석 실행 (타임아웃 포함)
  const analyzeVideo = useCallback(async (): Promise<VideoAnalysis | null> => {
    if (!state.isYouTubePage || !state.videoId) {
      console.log("[useYouTube] Not a YouTube page or no videoId")
      return null
    }

    if (aiStatus !== "ready") {
      console.log("[useYouTube] AI not ready, status:", aiStatus)
      // AI가 준비되지 않았을 때는 상태 변경 없이 null 반환
      return null
    }

    // 이미 분석 중이면 무시
    if (state.isAnalyzing) {
      console.log("[useYouTube] Already analyzing, ignoring")
      return null
    }

    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      error: null,
      progress: "분석 시작...",
    }))

    // 타임아웃 (60초)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("분석 시간 초과 (60초). 페이지를 새로고침 후 다시 시도해주세요.")), 60000)
    })

    try {
      const analysisPromise = (async () => {
        // 1. 자막 추출
        const { segments, title, channelName, duration } = await extractTranscript()

        setState(prev => ({ ...prev, transcript: segments }))

        // 2. 요약 생성
        const summary = await summarizeChunks(segments, title, channelName, duration)

        // 3. 결과 저장
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const analysis: VideoAnalysis = {
          url: tab?.url || "",
          title,
          channelName,
          duration,
          summary,
          transcript: segments.map(s => s.text).join(" ").slice(0, 8000),
        }

        return analysis
      })()

      const analysis = await Promise.race([analysisPromise, timeoutPromise])

      setState(prev => ({
        ...prev,
        lastAnalysis: analysis,
        isAnalyzing: false,
        progress: null,
      }))

      return analysis
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
      console.error("[useYouTube] Analysis error:", errorMessage)
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: errorMessage,
        progress: null,
      }))
      // 에러를 다시 throw하지 않고 null 반환 (UI에서 error state로 표시)
      return null
    }
  }, [state.isYouTubePage, state.videoId, state.isAnalyzing, aiStatus, extractTranscript, summarizeChunks])

  // 타임스탬프로 이동
  const jumpToTimestamp = useCallback(async (seconds: number) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id || !state.isYouTubePage) return

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (time: number) => {
          const video = document.querySelector("video")
          if (video) {
            video.currentTime = time
            video.play()
          }
        },
        args: [seconds],
      })
    } catch (error) {
      console.error("[useYouTube] Jump to timestamp failed:", error)
    }
  }, [state.isYouTubePage])

  // 상태 초기화
  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: null,
      lastAnalysis: null,
      error: null,
      progress: null,
    }))
  }, [])

  return {
    ...state,
    analyzeVideo,
    cancelAnalysis,
    jumpToTimestamp,
    reset,
  }
}
