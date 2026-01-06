# YouTube 자막 추출 및 요약 (YouTube Transcript Extraction)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐⭐
**상태:** 완료

## 개요

YouTube 영상 페이지에서 자막(Transcript)을 추출하고 AI가 요약해주는 기능. DOM 기반 추출 방식을 사용하여 YouTube의 자막 패널에서 직접 텍스트를 가져옵니다.

> **핵심 포인트:** YouTube의 `timedtext` API가 빈 응답을 반환하는 문제를 우회하기 위해 DOM 기반 추출 방식 채택

## 기능 상세

### 1. YouTube 페이지 감지
- URL 패턴 검사 (`youtube.com/watch?v=`)
- 탭 변경 시 자동 감지 (tabs.onActivated, tabs.onUpdated)
- YouTube 페이지일 때만 "영상 분석" 버튼 표시

### 2. 자막 추출 프로세스
1. Content Script를 통해 YouTube 페이지에 코드 주입
2. Transcript 패널이 열려있는지 확인
3. 없으면 "자막" 또는 "Transcript" 버튼 자동 클릭
4. `ytd-transcript-segment-renderer` 요소에서 자막 세그먼트 추출
5. 각 세그먼트의 타임스탬프와 텍스트 파싱

### 3. AI 요약 생성
- 짧은 영상 (< 50개 세그먼트): 전체 자막 요약
- 긴 영상: 청크 단위로 분할하여 첫 부분 요약
- 타임스탬프 포함 요약 생성

### 4. 타임스탬프 인터랙션
- 요약 결과에 타임스탬프 표시 (예: `[03:45]`)
- 사용자가 복사하여 YouTube 검색창에서 해당 시점으로 이동 가능

## 추가/수정 파일

| 파일 | 역할 |
|------|------|
| `src/lib/youtube.ts` | YouTube 유틸리티 함수 (URL 파싱, 자막 파싱) |
| `src/sidepanel.tsx` | YouTube 감지 및 분석 로직 |

## 코드 예시

### YouTube URL 감지
```typescript
// src/lib/youtube.ts
export function isYouTubeVideoUrl(url: string): boolean {
  const urlObj = new URL(url)
  return (
    (urlObj.hostname === "www.youtube.com" || urlObj.hostname === "youtube.com") &&
    urlObj.pathname === "/watch" &&
    urlObj.searchParams.has("v")
  )
}
```

### DOM 기반 자막 추출 (Content Script)
```typescript
// sidepanel.tsx - executeScript 내부
const transcriptPanel = document.querySelector("ytd-transcript-renderer")
const segmentElements = transcriptPanel.querySelectorAll(
  "ytd-transcript-segment-renderer"
)

segmentElements.forEach((segment) => {
  const timestampEl = segment.querySelector(
    ".segment-timestamp, [class*='timestamp']"
  )
  const textEl = segment.querySelector(
    ".segment-text, [class*='text'], yt-formatted-string"
  )
  // 타임스탬프 파싱 및 텍스트 추출
})
```

### 자막 XML/JSON 파싱
```typescript
// src/lib/youtube.ts
export function parseTranscriptXml(data: string): TranscriptSegment[] {
  const trimmed = data.trim()

  // JSON 형식 감지 (json3 format)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseTranscriptJson(trimmed)
  }

  // XML 형식 (srv3 format)
  return parseTranscriptXmlFormat(trimmed)
}
```

## 사용법 / 시나리오

### 기본 사용법
1. YouTube 영상 페이지로 이동
2. Memex 사이드 패널 열기 (Cmd+B)
3. "영상 분석" 버튼 클릭 (YouTube 아이콘)
4. 자막 추출 → AI 요약 자동 진행
5. 요약 결과 확인 (타임스탬프 포함)

### 지원되는 자막
- 영상에 자막(자동 생성 포함)이 있어야 함
- 한국어 자막 우선 → 영어 자막 → 기타 언어 순
- 자막이 없는 영상은 분석 불가

### 제한사항
- YouTube Premium 영상 일부 제한
- 라이브 스트리밍 자막 미지원
- 매우 긴 영상은 첫 부분만 요약

## 기술적 고려사항

### timedtext API 우회 이유
YouTube의 공식 자막 API(`/api/timedtext`)가 CORS 및 인증 문제로 빈 응답을 반환하는 경우가 많아, DOM 직접 접근 방식을 채택했습니다.

### Content Script 실행
```typescript
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  world: "MAIN",  // YouTube 페이지의 JS 컨텍스트에서 실행
  func: () => { /* 자막 추출 로직 */ }
})
```

`world: "MAIN"`을 사용하여 YouTube 페이지의 전역 객체(`ytInitialPlayerResponse` 등)에 접근 가능하게 합니다.
