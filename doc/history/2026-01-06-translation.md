# 실시간 번역 (Real-time Translation)

**날짜:** 2026-01-06
**난이도:** ⭐⭐⭐
**상태:** 완료

## 개요

웹페이지에서 선택한 텍스트를 Gemini Nano로 번역하고, 번역 결과를 페이지에 직접 표시하는 기능. 외부 번역 서비스 없이 100% 로컬에서 동작합니다.

## 기능 상세

### 1. 텍스트 선택 및 가져오기
- 웹페이지에서 드래그로 텍스트 선택
- "선택 텍스트 가져오기" 버튼으로 사이드패널에 로드
- 직접 입력도 지원

### 2. 다국어 번역
- **지원 언어**: 한국어, English, 日本語, 中文, Español, Français, Deutsch, Tiếng Việt
- 자동 언어 감지 (원문)
- 대상 언어 드롭다운 선택

### 3. 번역 결과 표시
- 사이드패널에서 번역 결과 확인
- 복사 버튼
- **"페이지에 표시하기"** 버튼으로 웹페이지에 직접 주입

### 4. 웹페이지 주입
- **편집 가능 영역** (contenteditable, input, textarea): 선택 영역 직접 교체
- **일반 텍스트 영역**: 예쁜 툴팁으로 번역 결과 표시
- 툴팁 기능:
  - 복사 버튼
  - 닫기 버튼
  - 외부 클릭/ESC로 닫기

## 추가/수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/translation.ts` | (신규) 번역 유틸리티 (선택 텍스트 가져오기, 주입) |
| `src/components/TranslationPanel.tsx` | (신규) 번역 탭 UI 컴포넌트 |
| `src/sidepanel.tsx` | 번역 탭 추가, Languages 아이콘 추가 |

## 코드 예시

### 선택된 텍스트 가져오기
```typescript
export async function getSelectedText(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return ""

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString() || "",
  })

  return results?.[0]?.result || ""
}
```

### 번역 프롬프트
```typescript
export function getTranslationPrompt(text: string, targetLang: string): string {
  return `다음 텍스트를 ${targetLang}로 번역해주세요. 설명 없이 번역문만 출력하세요.

텍스트:
${text}

번역:`
}
```

### 번역 결과 웹페이지 주입
```typescript
export async function injectTranslatedText(translatedText: string): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (text: string) => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return false

      const range = selection.getRangeAt(0)
      const isEditable = /* 편집 가능 여부 확인 */

      if (isEditable) {
        // 직접 교체
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        return true
      }

      // 툴팁으로 표시
      const tooltip = document.createElement("div")
      tooltip.innerHTML = `<예쁜 툴팁 UI>`
      document.body.appendChild(tooltip)
      return true
    },
    args: [translatedText],
  })

  return results?.[0]?.result || false
}
```

## 사용법 / 시나리오

### 시나리오 1: 영어 기사 번역
1. 영어 뉴스 기사에서 문단 선택 (드래그)
2. Memex 사이드패널 → **[번역]** 탭 클릭
3. **[선택 텍스트 가져오기]** 버튼 클릭
4. 대상 언어: **한국어** 선택
5. **[번역하기]** 클릭
6. 결과 확인 후 **[페이지에 표시하기]** 클릭
7. 웹페이지에 보라색 툴팁으로 번역 결과 표시

### 시나리오 2: 한국어 → 영어 번역
1. 한국어 텍스트 선택
2. 대상 언어: **English** 선택
3. 번역 결과 **[복사]** 버튼으로 클립보드에 복사

### 시나리오 3: 편집 가능 영역에서 번역
1. Google Docs나 Notion 등에서 텍스트 선택
2. 번역 후 **[페이지에 표시하기]** 클릭
3. 선택한 텍스트가 번역문으로 **직접 교체**됨

## UI 디자인

### 번역 탭
- **원문 영역**: 텍스트 에어리어 + "선택 텍스트 가져오기" 버튼
- **언어 선택**: 자동 감지 → [대상 언어 드롭다운]
- **번역 버튼**: 그라데이션 (indigo → purple)
- **결과 영역**: 그라데이션 배경 (indigo-50 → purple-50)

### 툴팁 (웹페이지 주입)
- **배경**: 그라데이션 (dark purple)
- **헤더**: 🌐 번역 결과
- **버튼**: 복사 / 닫기
- **애니메이션**: fade-in 효과

## 기술적 특징

1. **100% 로컬 처리**: 외부 번역 API 없이 Gemini Nano로 번역
2. **프라이버시 보장**: 번역 내용이 외부로 전송되지 않음
3. **오프라인 지원**: 인터넷 연결 없이도 번역 가능
4. **DOM 주입**: chrome.scripting.executeScript로 안전하게 주입
