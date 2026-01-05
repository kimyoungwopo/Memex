/**
 * YouTube 자막 추출 유틸리티
 *
 * YouTube 페이지에서 자막(Transcript) 데이터를 추출합니다.
 */

export interface TranscriptSegment {
  text: string
  start: number // 초 단위
  duration: number
}

export interface YouTubeVideoInfo {
  videoId: string
  title: string
  channelName: string
  duration: number // 총 길이 (초)
}

/**
 * 현재 탭이 YouTube 영상 페이지인지 확인
 */
export function isYouTubeVideoUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return (
      (urlObj.hostname === "www.youtube.com" || urlObj.hostname === "youtube.com") &&
      urlObj.pathname === "/watch" &&
      urlObj.searchParams.has("v")
    )
  } catch {
    return false
  }
}

/**
 * YouTube URL에서 비디오 ID 추출
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get("v")
  } catch {
    return null
  }
}

/**
 * 초를 타임스탬프 문자열로 변환 (예: 125 -> "02:05")
 */
export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * YouTube 페이지에서 자막 데이터 추출 (Content Script에서 실행)
 */
export async function extractTranscriptFromPage(): Promise<{
  transcript: TranscriptSegment[]
  videoInfo: YouTubeVideoInfo
} | null> {
  // YouTube 페이지의 ytInitialPlayerResponse에서 자막 정보 추출
  const script = `
    (function() {
      try {
        // 방법 1: ytInitialPlayerResponse에서 추출
        if (window.ytInitialPlayerResponse) {
          const playerResponse = window.ytInitialPlayerResponse;
          const videoDetails = playerResponse.videoDetails || {};
          const captions = playerResponse.captions;

          if (captions && captions.playerCaptionsTracklistRenderer) {
            const tracks = captions.playerCaptionsTracklistRenderer.captionTracks || [];
            // 한국어 자막 우선, 없으면 영어, 없으면 첫 번째
            let track = tracks.find(t => t.languageCode === 'ko') ||
                       tracks.find(t => t.languageCode === 'en') ||
                       tracks[0];

            if (track && track.baseUrl) {
              return {
                captionUrl: track.baseUrl,
                videoInfo: {
                  videoId: videoDetails.videoId || '',
                  title: videoDetails.title || document.title,
                  channelName: videoDetails.author || '',
                  duration: parseInt(videoDetails.lengthSeconds) || 0
                }
              };
            }
          }
        }

        // 방법 2: 페이지에서 자막 버튼 정보 찾기
        const ytPlayer = document.querySelector('#movie_player');
        if (ytPlayer && ytPlayer.getPlayerResponse) {
          const response = ytPlayer.getPlayerResponse();
          // ... 유사한 로직
        }

        return null;
      } catch (e) {
        console.error('[YouTube Transcript] Error:', e);
        return null;
      }
    })();
  `

  return null // Content Script 실행 결과를 받아야 함
}

/**
 * 자막 데이터를 파싱하여 세그먼트 배열로 변환
 * XML 형식(srv3)과 JSON 형식(json3) 모두 지원
 */
export function parseTranscriptXml(data: string): TranscriptSegment[] {
  const trimmed = data.trim()

  // JSON 형식 감지 (json3 format)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseTranscriptJson(trimmed)
  }

  // XML 형식 (srv3 format or default)
  return parseTranscriptXmlFormat(trimmed)
}

/**
 * JSON 형식 자막 파싱 (json3)
 */
function parseTranscriptJson(jsonStr: string): TranscriptSegment[] {
  try {
    const json = JSON.parse(jsonStr)
    const segments: TranscriptSegment[] = []

    // YouTube json3 format: { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }
    const events = json.events || []

    for (const event of events) {
      if (!event.segs) continue

      const start = (event.tStartMs || 0) / 1000 // ms to seconds
      const duration = (event.dDurationMs || 0) / 1000

      const text = event.segs
        .map((seg: any) => seg.utf8 || "")
        .join("")
        .replace(/\n/g, " ")
        .trim()

      if (text) {
        segments.push({ text, start, duration })
      }
    }

    return segments
  } catch (e) {
    console.error("[parseTranscriptJson] Failed to parse:", e)
    return []
  }
}

/**
 * XML 형식 자막 파싱 (srv3 or default)
 */
function parseTranscriptXmlFormat(xml: string): TranscriptSegment[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const texts = doc.querySelectorAll("text")

  const segments: TranscriptSegment[] = []

  texts.forEach((text) => {
    const start = parseFloat(text.getAttribute("start") || "0")
    const duration = parseFloat(text.getAttribute("dur") || "0")
    const content = text.textContent || ""

    // HTML 엔티티 디코딩
    const decoded = content
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .trim()

    if (decoded) {
      segments.push({
        text: decoded,
        start,
        duration,
      })
    }
  })

  return segments
}

/**
 * 자막 세그먼트를 요약에 적합한 텍스트로 변환
 * (타임스탬프를 포함한 청크로 분할)
 */
export function prepareTranscriptForSummary(
  segments: TranscriptSegment[],
  maxChunkLength: number = 4000
): { text: string; startTime: number; endTime: number }[] {
  const chunks: { text: string; startTime: number; endTime: number }[] = []
  let currentChunk = ""
  let chunkStartTime = 0
  let chunkEndTime = 0

  for (const segment of segments) {
    const segmentText = `[${formatTimestamp(segment.start)}] ${segment.text} `

    if (currentChunk.length + segmentText.length > maxChunkLength) {
      // 현재 청크 저장
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          startTime: chunkStartTime,
          endTime: chunkEndTime,
        })
      }
      // 새 청크 시작
      currentChunk = segmentText
      chunkStartTime = segment.start
      chunkEndTime = segment.start + segment.duration
    } else {
      if (!currentChunk) {
        chunkStartTime = segment.start
      }
      currentChunk += segmentText
      chunkEndTime = segment.start + segment.duration
    }
  }

  // 마지막 청크 저장
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      startTime: chunkStartTime,
      endTime: chunkEndTime,
    })
  }

  return chunks
}

/**
 * 전체 자막을 하나의 텍스트로 합치기 (짧은 영상용)
 */
export function combineTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
    .join("\n")
}
