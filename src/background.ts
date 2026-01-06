// Background script for handling side panel and context menus

// 확장 프로그램 아이콘 클릭 시 사이드 패널 열기
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set panel behavior:", error))

// ========== 세렌디피티 엔진: 탭 변경 감지 ==========
let lastAnalyzedUrl = ""
let analysisDebounceTimer: ReturnType<typeof setTimeout> | null = null

// 페이지 텍스트 추출 함수
async function extractPageText(tabId: number): Promise<{ url: string; title: string; content: string } | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 불필요한 요소 제거
        const excludeSelectors = "nav, footer, header, aside, script, style, noscript, iframe, .ad, .ads, .advertisement, [role='banner'], [role='navigation']"
        const clone = document.body.cloneNode(true) as HTMLElement
        clone.querySelectorAll(excludeSelectors).forEach(el => el.remove())

        const text = clone.innerText
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 3000) // 세렌디피티용은 3000자로 제한

        return {
          url: window.location.href,
          title: document.title,
          content: text,
        }
      },
    })
    return results[0]?.result || null
  } catch (error) {
    console.error("[Serendipity] Failed to extract page:", error)
    return null
  }
}

// 탭 URL 변경 감지
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URL이 변경되고 로딩이 완료되었을 때만
  if (changeInfo.status !== "complete" || !tab.url) return

  // 특수 페이지 제외
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("about:")) return

  // 같은 URL 중복 분석 방지
  if (tab.url === lastAnalyzedUrl) return
  lastAnalyzedUrl = tab.url

  // 디바운스 (빠른 탭 전환 시 중복 방지)
  if (analysisDebounceTimer) clearTimeout(analysisDebounceTimer)

  analysisDebounceTimer = setTimeout(async () => {
    console.log("[Serendipity] Analyzing page:", tab.url)

    const pageData = await extractPageText(tabId)
    if (!pageData || pageData.content.length < 100) return

    // Storage에 현재 페이지 정보 저장 (Side Panel에서 분석)
    await chrome.storage.local.set({
      serendipityPage: {
        ...pageData,
        timestamp: Date.now(),
      },
    })

    console.log("[Serendipity] Page data saved for analysis")
  }, 1500) // 1.5초 디바운스
})

// 탭 전환 감지
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (!tab.url || tab.url.startsWith("chrome://")) return

    if (tab.url !== lastAnalyzedUrl) {
      lastAnalyzedUrl = tab.url

      // 디바운스
      if (analysisDebounceTimer) clearTimeout(analysisDebounceTimer)

      analysisDebounceTimer = setTimeout(async () => {
        console.log("[Serendipity] Tab switched, analyzing:", tab.url)

        const pageData = await extractPageText(activeInfo.tabId)
        if (!pageData || pageData.content.length < 100) return

        await chrome.storage.local.set({
          serendipityPage: {
            ...pageData,
            timestamp: Date.now(),
          },
        })
      }, 1500)
    }
  } catch (error) {
    console.error("[Serendipity] Tab activation error:", error)
  }
})

// 배지 설정 함수 (Side Panel에서 호출)
function setBadge(count: number) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) })
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" }) // 빨간색
  } else {
    chrome.action.setBadgeText({ text: "" })
  }
}

// Context Menu 항목 정의
const CONTEXT_MENU_ITEMS = [
  { id: "memex-explain", title: "Memex: 쉽게 설명해줘", prompt: "다음 내용을 쉽고 간단하게 설명해줘:\n\n" },
  { id: "memex-translate", title: "Memex: 한국어로 번역해줘", prompt: "다음 내용을 한국어로 자연스럽게 번역해줘:\n\n" },
  { id: "memex-summarize", title: "Memex: 요약해줘", prompt: "다음 내용을 3줄로 요약해줘:\n\n" },
  { id: "memex-ask", title: "Memex: 이게 뭐야?", prompt: "다음이 무엇인지 자세히 알려줘:\n\n" },
]

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log("Memex extension installed/updated")

  // 기존 메뉴 제거 후 새로 생성
  chrome.contextMenus.removeAll(() => {
    // 부모 메뉴 생성
    chrome.contextMenus.create({
      id: "memex-parent",
      title: "Memex",
      contexts: ["selection"],
    })

    // 자식 메뉴 항목들 생성
    CONTEXT_MENU_ITEMS.forEach((item) => {
      chrome.contextMenus.create({
        id: item.id,
        parentId: "memex-parent",
        title: item.title,
        contexts: ["selection"],
      })
    })

    console.log("Context menus created")
  })
})

// 메시지 핸들러 (Side Panel에서 요청)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 세렌디피티 배지 설정
  if (message.type === "SET_BADGE") {
    setBadge(message.count || 0)
    sendResponse({ success: true })
    return false
  }

  if (message.type === "FETCH_CAPTION") {
    console.log("[Background] Fetching caption URL:", message.url)

    // YouTube 자막 fetch (Background에서는 CORS 제한 없음)
    fetch(message.url, {
      headers: {
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.youtube.com/",
        "Origin": "https://www.youtube.com",
      },
    })
      .then((res) => {
        console.log("[Background] Response status:", res.status, res.statusText)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.text()
      })
      .then((text) => {
        console.log("[Background] Response length:", text.length, "Preview:", text.slice(0, 100))
        sendResponse({ success: true, data: text })
      })
      .catch((err) => {
        console.error("[Background] Fetch error:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true // 비동기 응답을 위해 true 반환
  }
})

// Context Menu 클릭 핸들러
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText || !tab?.id) return

  const menuItem = CONTEXT_MENU_ITEMS.find((item) => item.id === info.menuItemId)
  if (!menuItem) return

  const selectedText = info.selectionText.trim()
  const fullPrompt = menuItem.prompt + selectedText

  console.log("Context menu clicked:", menuItem.id, selectedText.substring(0, 50) + "...")

  // 선택된 텍스트와 프롬프트를 storage에 저장
  await chrome.storage.local.set({
    quickAction: {
      prompt: fullPrompt,
      selectedText: selectedText,
      action: menuItem.id,
      timestamp: Date.now(),
    },
  })

  // 사이드 패널 열기
  try {
    await chrome.sidePanel.open({ tabId: tab.id })
  } catch (error) {
    console.error("Failed to open side panel:", error)
    // 대안: 현재 윈도우에서 열기 시도
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId })
    } catch (e) {
      console.error("Failed to open side panel in window:", e)
    }
  }
})
