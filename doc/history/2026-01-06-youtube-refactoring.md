# YouTube 요약 기능 구조 개선 (YouTube Summary Refactoring)

**날짜:** 2026-01-06
**난이도:** ⭐⭐⭐⭐
**상태:** 완료

## 개요

YouTube 자막 추출 및 요약 기능의 세 가지 핵심 문제를 해결하기 위한 전체 리팩토링:
1. **자막 추출 실패**: DOM 기반 → API 기반(`ytInitialPlayerResponse`) 전환
2. **긴 영상 부분 요약**: 전체 내용을 청크별로 요약 후 통합
3. **코드 구조 개선**: 480+ 라인의 인라인 로직을 커스텀 훅으로 분리

## 기능 상세

### 1. useYouTube 커스텀 훅 생성
- 모든 YouTube 관련 상태 관리 통합
- `src/hooks/use-youtube.ts` 신규 생성 (340+ 라인)
- 단일 책임 원칙 준수

### 2. API 기반 자막 추출
- `ytInitialPlayerResponse.captions` 직접 접근
- 한국어 → 영어 → 기타 언어 우선순위 자동 선택
- Background Script를 통한 CORS 우회 fetch

### 3. 청크별 전체 요약 (긴 영상 지원)
- 4000자 미만: 전체 한번에 요약
- 4000자 이상: 3000자 단위로 청크 분할
  1. 각 청크별 핵심 내용 요약
  2. 모든 청크 요약을 통합한 최종 요약 생성
- 진행률 표시 (예: "청크 분석 중... (3/7)")

### 4. 실시간 진행 상태 표시
- `progress` 상태를 통한 UI 업데이트
- 단계별 진행 메시지:
  - "자막 정보 확인 중..."
  - "자막 다운로드 중..."
  - "청크 분석 중... (n/total)"
  - "최종 요약 생성 중..."

## 추가/수정 파일

| 파일 | 변경 | 역할 |
|------|------|------|
| `src/hooks/use-youtube.ts` | 신규 | YouTube 커스텀 훅 (상태, 자막추출, 요약, 타임스탬프 이동) |
| `src/sidepanel.tsx` | 수정 | 480+ 라인 제거, 훅 적용 (60 라인으로 축소) |

## 코드 예시

### useYouTube 훅 사용
```typescript
const {
  isYouTubePage,
  videoId: youtubeVideoId,
  isAnalyzing: isAnalyzingVideo,
  transcript: videoTranscript,
  lastAnalysis: lastVideoAnalysis,
  progress: youtubeProgress,
  error: youtubeError,
  analyzeVideo,
  jumpToTimestamp,
} = useYouTube({ generate, aiStatus: status })
```

### API 기반 자막 추출
```typescript
// Content Script로 ytInitialPlayerResponse 접근
const extractResult = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => {
    const playerResponse = window.ytInitialPlayerResponse
    const captions = playerResponse.captions
    const tracks = captions.playerCaptionsTracklistRenderer.captionTracks

    // 한국어 → 영어 → 첫 번째 순으로 선택
    const track = tracks.find(t => t.languageCode === "ko") ||
                  tracks.find(t => t.languageCode === "en") ||
                  tracks[0]

    return { captionUrl: track.baseUrl, ... }
  }
})

// Background Script에서 자막 fetch (CORS 우회)
const captionResponse = await chrome.runtime.sendMessage({
  type: "FETCH_URL",
  url: result.captionUrl,
})
```

### 청크별 요약 로직
```typescript
const summarizeChunks = async (segments, title, channelName, duration) => {
  // 짧은 영상: 전체 한번에 요약
  if (totalText.length < 4000) {
    return await generate(shortVideoPrompt)
  }

  // 긴 영상: 청크 분할
  const CHUNK_SIZE = 3000
  const chunks = splitIntoChunks(segments, CHUNK_SIZE)

  // 각 청크별 핵심 추출
  const chunkSummaries = []
  for (let i = 0; i < chunks.length; i++) {
    updateProgress(`청크 분석 중... (${i + 1}/${chunks.length})`)
    const summary = await generate(chunkPrompt)
    chunkSummaries.push(summary)
  }

  // 최종 통합 요약
  updateProgress("최종 요약 생성 중...")
  return await generate(integrationPrompt)
}
```

## 사용법 / 시나리오

### 기본 사용법 (변경 없음)
1. YouTube 영상 페이지로 이동
2. Memex 사이드 패널 열기 (Cmd+B)
3. "영상 분석" 버튼 클릭
4. 자막 추출 → AI 요약 자동 진행
5. 요약 결과 확인

### 긴 영상 요약 개선
- **이전**: 긴 영상은 첫 부분만 요약
- **현재**: 전체 내용을 청크별로 분석 후 통합 요약
- 진행률 표시로 사용자가 대기 시간 인지 가능

### 자막 추출 개선
- **이전**: DOM 기반 (Transcript 패널 필요)
- **현재**: API 기반 (`ytInitialPlayerResponse`)
- 자막 패널 열지 않아도 추출 가능

## 기술적 고려사항

### API vs DOM 추출
| 방식 | 장점 | 단점 |
|------|------|------|
| API 기반 | 안정적, 패널 불필요 | CORS 우회 필요 |
| DOM 기반 | CORS 없음 | 패널 열어야 함, 불안정 |

### 청크 크기 선택 근거
- 3000자: Gemini Nano의 컨텍스트 창 고려
- 청크가 너무 작으면 맥락 손실
- 청크가 너무 크면 요약 품질 저하

### CORS 우회 패턴
Background Script에서 `chrome.runtime.sendMessage`를 통해 fetch 수행:
```typescript
// background.ts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_URL") {
    fetch(request.url)
      .then(res => res.text())
      .then(data => sendResponse({ success: true, data }))
    return true // 비동기 응답
  }
})
```

---

## SPA 네비게이션 대응 개선 (2026-01-06 추가)

### 문제점
YouTube는 SPA(Single Page Application)로 동작하여 영상 간 이동 시 페이지가 새로고침되지 않습니다. 이로 인해:
- `ytInitialPlayerResponse`가 초기화되거나 이전 영상의 데이터가 남아있음
- 플레이어 API(`movie_player.getPlayerResponse()`)가 즉시 준비되지 않음

### 해결 방법

#### 1. Polling 메커니즘 추가
플레이어가 준비될 때까지 최대 5초간 100ms 간격으로 재시도:
```typescript
const waitForPlayer = (maxWait = 5000): Promise<any | null> => {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const check = () => {
      // 여러 방법 시도...
      if (Date.now() - startTime > maxWait) return resolve(null)
      setTimeout(check, 100)
    }
    check()
  })
}
```

#### 2. 다중 Fallback 전략 (우선순위 순)
1. **`movie_player.getPlayerResponse()`** - SPA에서 가장 신뢰성 높음
2. **`yt.player.getPlayerByElement()`** - 대체 플레이어 API
3. **`ytInitialPlayerResponse`** - 초기 로드 또는 캐시
4. **`ytplayer.config.args.raw_player_response`** - 레거시 지원
5. **`ytplayer.config.args.player_response`** - 문자열 형태 (파싱 필요)
6. **`ytcfg.data_.PLAYER_VARS.embedded_player_response`** - 임베드 설정
7. **스크립트 태그 파싱** - 최후의 수단

#### 3. 개선된 오류 메시지
상황에 맞는 구체적인 안내 제공:
- 플레이어 없음: "영상이 로드될 때까지 기다린 후 다시 시도해주세요"
- 데이터 없음: "SPA 네비게이션으로 인해 데이터가 초기화되었을 수 있습니다. 페이지를 새로고침(F5)해주세요"

### 콘솔 로그 디버깅
각 방법에서 성공 시 로그 출력:
```
[YouTube] Found via movie_player.getPlayerResponse()
[YouTube] Found via yt.player.getPlayerByElement()
[YouTube] Found via ytInitialPlayerResponse
[YouTube] Found via script tag (ytInitialPlayerResponse)
```
