// Background script for handling side panel and context menus

// 확장 프로그램 아이콘 클릭 시 사이드 패널 열기
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set panel behavior:", error))

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
