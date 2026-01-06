# 세렌디피티 엔진 (Serendipity Engine)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐
**상태:** 완료

## 개요

브라우징 중 자동으로 관련 기억을 찾아 알려주는 프로액티브 AI 기능. 사용자가 탭을 전환하거나 새 페이지를 방문할 때, 저장된 기억 중 현재 페이지와 유사한 내용을 자동으로 검색하여 알림을 표시합니다.

## 기능 상세

### 페이지 변경 감지 (Background)
- `chrome.tabs.onUpdated` - 페이지 로딩 완료 시
- `chrome.tabs.onActivated` - 탭 전환 시
- 1.5초 디바운스로 중복 분석 방지
- 특수 페이지 제외 (chrome://, chrome-extension://, about:)

### 자동 유사도 검색
- 현재 페이지 텍스트 추출 (최대 3000자)
- 벡터 유사도 검색 (하이브리드: Vector 70% + Keyword 30%)
- 유사도 임계값: 25% 이상

### 알림 UI
- 사이드 패널 상단 보라색 배너
- 관련 기억 최대 3개 표시
- 유사도 % 배지
- 클릭 시 해당 URL로 이동
- 배지 알림 (아이콘에 숫자 표시)

## 추가/수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/background.ts` | 탭 변경 감지, 페이지 텍스트 추출, Storage 저장, 배지 설정 |
| `src/sidepanel.tsx` | Storage 리스너, 유사도 검색, 세렌디피티 배너 UI |

## 코드 예시

### 탭 변경 감지 (background.ts)
```typescript
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return

  // 특수 페이지 제외
  if (tab.url.startsWith("chrome://")) return

  // 같은 URL 중복 방지
  if (tab.url === lastAnalyzedUrl) return
  lastAnalyzedUrl = tab.url

  // 디바운스 (1.5초)
  if (analysisDebounceTimer) clearTimeout(analysisDebounceTimer)

  analysisDebounceTimer = setTimeout(async () => {
    const pageData = await extractPageText(tabId)
    if (!pageData || pageData.content.length < 100) return

    // Storage에 저장 (Side Panel에서 분석)
    await chrome.storage.local.set({
      serendipityPage: {
        ...pageData,
        timestamp: Date.now(),
      },
    })
  }, 1500)
})
```

### 유사도 검색 및 알림 (sidepanel.tsx)
```typescript
useEffect(() => {
  const SIMILARITY_THRESHOLD = 0.25 // 25% 이상

  const checkSerendipity = async () => {
    const result = await chrome.storage.local.get("serendipityPage")
    const pageData = result.serendipityPage

    // 현재 페이지로 유사 기억 검색
    const relatedMemories = await recallMemories(pageData.content.slice(0, 1000), 5)

    // 유사도 임계값 이상인 기억만 필터링
    const highSimilarityMemories = relatedMemories.filter(
      (m) => m.score >= SIMILARITY_THRESHOLD && m.url !== pageData.url
    )

    if (highSimilarityMemories.length > 0) {
      setSerendipityMemories(highSimilarityMemories.slice(0, 3))
      setShowSerendipityBanner(true)

      // 배지 표시
      chrome.runtime.sendMessage({
        type: "SET_BADGE",
        count: highSimilarityMemories.length,
      })
    }
  }

  // Storage 변경 리스너
  chrome.storage.local.onChanged.addListener(listener)
}, [memoryStatus, recallMemories])
```

## 사용법 / 시나리오

### 시나리오 1: 관련 정보 발견
1. 이전에 "React 성능 최적화" 관련 페이지를 기억에 저장
2. 나중에 "useMemo 사용법" 관련 페이지 방문
3. 세렌디피티 엔진이 자동으로 유사도 감지
4. 보라색 배너로 관련 기억 알림
5. 클릭하여 이전 기억 페이지로 이동

### 시나리오 2: 배지 알림
1. 탭 전환 시 관련 기억 발견
2. 확장 프로그램 아이콘에 빨간색 배지 (숫자) 표시
3. 사이드 패널 열면 관련 기억 확인 가능

## UI 디자인

- **배너 색상**: 보라색 그라데이션 (`from-purple-50 to-pink-50`)
- **유사도 배지**: 보라색 라운드 태그 (`bg-purple-100`)
- **아이콘 배지**: 빨간색 (`#EF4444`)

## 설정

- 유사도 임계값: 25% (너무 낮으면 노이즈, 너무 높으면 놓침)
- 페이지 텍스트 제한: 3000자 (세렌디피티용)
- 검색 쿼리 제한: 1000자
- 표시 기억 수: 최대 3개
