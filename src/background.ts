// Background script for handling side panel

// 확장 프로그램 아이콘 클릭 시 사이드 패널 열기
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set panel behavior:", error))

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener(() => {
  console.log("Memex extension installed/updated")
})
