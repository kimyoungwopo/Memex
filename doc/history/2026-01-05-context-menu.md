# 우클릭 퀵 액션 (Context Menu)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐
**상태:** 완료

## 개요

웹 페이지에서 텍스트를 드래그 선택한 후 우클릭하면 Memex 퀵 액션 메뉴가 나타남. 선택한 텍스트에 대해 즉시 AI 분석 실행.

## 지원 액션

| 액션 | 설명 | 프롬프트 |
|------|------|----------|
| 쉽게 설명해줘 | 복잡한 내용 쉽게 풀이 | "다음 내용을 초등학생도 이해할 수 있게 쉽게 설명해주세요" |
| 한국어로 번역해줘 | 영어/외국어 번역 | "다음 텍스트를 자연스러운 한국어로 번역해주세요" |
| 요약해줘 | 3줄 핵심 요약 | "다음 내용을 3줄로 핵심만 요약해주세요" |
| 이게 뭐야? | 단어/개념 설명 | "다음 단어 또는 개념이 무엇인지 설명해주세요" |

## 수정/추가 파일

- `src/background.ts` - NEW: Context Menu 등록 및 이벤트 처리
- `package.json` - `contextMenus` 권한 추가

## 동작 흐름

```
1. 텍스트 드래그 선택
2. 우클릭 → "Memex" 메뉴 표시
3. 액션 선택 (예: "쉽게 설명해줘")
4. chrome.storage.local에 선택 텍스트 + 액션 저장
5. 사이드 패널 자동 오픈
6. sidepanel.tsx에서 storage 변경 감지
7. AI가 즉시 응답 생성
```

## 코드 예시

```typescript
// background.ts
chrome.contextMenus.create({
  id: "memex-explain",
  title: "쉽게 설명해줘",
  contexts: ["selection"],
  parentId: "memex-parent",
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.storage.local.set({
    quickAction: {
      action: info.menuItemId,
      text: info.selectionText,
      timestamp: Date.now(),
    },
  })
  await chrome.sidePanel.open({ tabId: tab.id })
})
```
