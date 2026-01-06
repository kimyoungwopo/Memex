/**
 * Translation Utility - 웹페이지 텍스트 번역 및 주입
 *
 * 기능:
 * 1. 선택된 텍스트 가져오기
 * 2. 번역된 텍스트를 선택 영역에 주입
 */

/**
 * 현재 탭에서 선택된 텍스트 가져오기
 */
export async function getSelectedText(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return ""

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || "",
    })

    return results?.[0]?.result || ""
  } catch (error) {
    console.error("[Translation] Failed to get selected text:", error)
    return ""
  }
}

/**
 * 번역된 텍스트를 웹페이지의 선택 영역에 주입
 */
export async function injectTranslatedText(translatedText: string): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return false

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text: string) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return false

        const range = selection.getRangeAt(0)

        // 선택 영역이 편집 가능한지 확인
        const container = range.commonAncestorContainer
        const parentElement = container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : container as Element

        if (!parentElement) return false

        // contenteditable 또는 input/textarea인 경우
        const isEditable =
          parentElement.isContentEditable ||
          parentElement.tagName === "INPUT" ||
          parentElement.tagName === "TEXTAREA" ||
          parentElement.closest("[contenteditable='true']")

        if (isEditable) {
          // 편집 가능한 영역: 직접 교체
          range.deleteContents()
          range.insertNode(document.createTextNode(text))
          return true
        }

        // 일반 텍스트 영역: 툴팁으로 표시
        const tooltip = document.createElement("div")
        tooltip.id = "memex-translation-tooltip"
        tooltip.innerHTML = `
          <div style="
            position: fixed;
            z-index: 999999;
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.6;
            animation: memex-fade-in 0.2s ease-out;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 1px solid rgba(255,255,255,0.2);
            ">
              <span style="font-size: 18px;">🌐</span>
              <span style="font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9;">번역 결과</span>
            </div>
            <div style="white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <div style="
              display: flex;
              gap: 8px;
              margin-top: 14px;
            ">
              <button id="memex-copy-btn" style="
                flex: 1;
                padding: 8px 12px;
                background: rgba(255,255,255,0.15);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: background 0.2s;
              ">📋 복사</button>
              <button id="memex-close-btn" style="
                padding: 8px 12px;
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.7);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
              ">✕ 닫기</button>
            </div>
          </div>
          <style>
            @keyframes memex-fade-in {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            #memex-copy-btn:hover { background: rgba(255,255,255,0.25) !important; }
            #memex-close-btn:hover { background: rgba(255,255,255,0.2) !important; color: white !important; }
          </style>
        `

        // 선택 영역 위치 계산
        const rect = range.getBoundingClientRect()
        const tooltipContent = tooltip.firstElementChild as HTMLElement
        if (tooltipContent) {
          tooltipContent.style.left = `${Math.max(10, rect.left)}px`
          tooltipContent.style.top = `${Math.max(10, rect.bottom + 10)}px`
        }

        // 기존 툴팁 제거
        document.getElementById("memex-translation-tooltip")?.remove()

        // 툴팁 추가
        document.body.appendChild(tooltip)

        // 복사 버튼 이벤트
        document.getElementById("memex-copy-btn")?.addEventListener("click", () => {
          navigator.clipboard.writeText(text)
          const btn = document.getElementById("memex-copy-btn")
          if (btn) {
            btn.textContent = "✓ 복사됨!"
            setTimeout(() => { btn.textContent = "📋 복사" }, 1500)
          }
        })

        // 닫기 버튼 이벤트
        document.getElementById("memex-close-btn")?.addEventListener("click", () => {
          document.getElementById("memex-translation-tooltip")?.remove()
        })

        // 외부 클릭 시 닫기
        setTimeout(() => {
          const closeOnClick = (e: MouseEvent) => {
            const tooltip = document.getElementById("memex-translation-tooltip")
            if (tooltip && !tooltip.contains(e.target as Node)) {
              tooltip.remove()
              document.removeEventListener("click", closeOnClick)
            }
          }
          document.addEventListener("click", closeOnClick)
        }, 100)

        // ESC 키로 닫기
        const closeOnEsc = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            document.getElementById("memex-translation-tooltip")?.remove()
            document.removeEventListener("keydown", closeOnEsc)
          }
        }
        document.addEventListener("keydown", closeOnEsc)

        return true
      },
      args: [translatedText],
    })

    return results?.[0]?.result || false
  } catch (error) {
    console.error("[Translation] Failed to inject text:", error)
    return false
  }
}

/**
 * 번역 프롬프트 생성
 */
export function getTranslationPrompt(text: string, targetLang: string = "한국어"): string {
  return `다음 텍스트를 ${targetLang}로 번역해주세요. 설명 없이 번역문만 출력하세요.

텍스트:
${text}

번역:`
}

/**
 * 지원 언어 목록
 */
export const SUPPORTED_LANGUAGES = [
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
] as const

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"]
