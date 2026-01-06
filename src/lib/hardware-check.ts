/**
 * Hardware Check - WebGPU 및 시스템 요구사항 검사
 *
 * Gemini Nano 실행을 위한 하드웨어 요구사항:
 * - WebGPU 지원 브라우저 (Chrome 113+)
 * - 최소 4GB VRAM 권장
 * - Chrome AI flags 활성화
 */

export interface HardwareCheckResult {
  webGPU: {
    supported: boolean
    adapterInfo?: GPUAdapterInfo
    error?: string
  }
  chromeAI: {
    available: boolean
    status: "readily" | "after-download" | "no" | "unknown"
    error?: string
  }
  browser: {
    isChrome: boolean
    version: number
    isCanaryOrDev: boolean
  }
  overall: {
    ready: boolean
    message: string
    suggestions: string[]
  }
}

/**
 * WebGPU 지원 여부 확인
 */
async function checkWebGPU(): Promise<HardwareCheckResult["webGPU"]> {
  try {
    if (!navigator.gpu) {
      return {
        supported: false,
        error: "WebGPU가 지원되지 않습니다. Chrome 113 이상이 필요합니다.",
      }
    }

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      return {
        supported: false,
        error: "GPU 어댑터를 찾을 수 없습니다. 그래픽 드라이버를 업데이트해 주세요.",
      }
    }

    // adapterInfo 가져오기 (API 버전에 따라 다를 수 있음)
    let adapterInfo: GPUAdapterInfo | undefined
    try {
      // 최신 API: adapter.info (property)
      if ("info" in adapter && adapter.info) {
        adapterInfo = adapter.info as GPUAdapterInfo
      }
      // 구버전 API: requestAdapterInfo() (method)
      else if (typeof (adapter as any).requestAdapterInfo === "function") {
        adapterInfo = await (adapter as any).requestAdapterInfo()
      }
    } catch {
      // adapterInfo 가져오기 실패해도 WebGPU 자체는 지원됨
      console.warn("[HardwareCheck] Could not get adapter info")
    }

    return {
      supported: true,
      adapterInfo,
    }
  } catch (error) {
    return {
      supported: false,
      error: error instanceof Error ? error.message : "WebGPU 확인 중 오류 발생",
    }
  }
}

/**
 * Chrome AI (LanguageModel) 지원 여부 확인
 */
async function checkChromeAI(): Promise<HardwareCheckResult["chromeAI"]> {
  try {
    // @ts-ignore - Chrome AI API
    if (typeof LanguageModel === "undefined") {
      return {
        available: false,
        status: "no",
        error: "Chrome AI API가 활성화되지 않았습니다.",
      }
    }

    // @ts-ignore
    const availability = await LanguageModel.availability()

    return {
      available: availability !== "no",
      status: availability as HardwareCheckResult["chromeAI"]["status"],
    }
  } catch (error) {
    return {
      available: false,
      status: "unknown",
      error: error instanceof Error ? error.message : "Chrome AI 확인 중 오류 발생",
    }
  }
}

/**
 * 브라우저 정보 확인
 */
function checkBrowser(): HardwareCheckResult["browser"] {
  const userAgent = navigator.userAgent
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/)
  const version = chromeMatch ? parseInt(chromeMatch[1], 10) : 0
  const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent)
  const isCanaryOrDev = /Chrome\/(1[3-9]\d|[2-9]\d{2})/.test(userAgent) // 130+

  return {
    isChrome,
    version,
    isCanaryOrDev: version >= 131,
  }
}

/**
 * 종합 하드웨어 체크
 */
export async function performHardwareCheck(): Promise<HardwareCheckResult> {
  const [webGPU, chromeAI] = await Promise.all([
    checkWebGPU(),
    checkChromeAI(),
  ])
  const browser = checkBrowser()

  const suggestions: string[] = []
  let ready = true
  let message = "모든 요구사항이 충족되었습니다!"

  // 브라우저 체크
  if (!browser.isChrome) {
    ready = false
    suggestions.push("Chrome 브라우저를 사용해 주세요.")
  } else if (browser.version < 131) {
    ready = false
    suggestions.push("Chrome 131 이상으로 업데이트해 주세요. (Chrome Canary 또는 Dev 권장)")
  }

  // WebGPU 체크
  if (!webGPU.supported) {
    ready = false
    suggestions.push(webGPU.error || "WebGPU를 지원하는 GPU가 필요합니다.")
  }

  // Chrome AI 체크
  if (!chromeAI.available) {
    ready = false
    if (chromeAI.status === "no") {
      suggestions.push("chrome://flags에서 다음 플래그를 활성화해 주세요:")
      suggestions.push("  • #optimization-guide-on-device-model → Enabled")
      suggestions.push("  • #prompt-api-for-gemini-nano → Enabled")
    } else {
      suggestions.push(chromeAI.error || "Chrome AI를 사용할 수 없습니다.")
    }
  }

  if (!ready) {
    message = "일부 요구사항이 충족되지 않았습니다."
  } else if (chromeAI.status === "after-download") {
    message = "AI 모델 다운로드가 필요합니다."
  }

  return {
    webGPU,
    chromeAI,
    browser,
    overall: {
      ready,
      message,
      suggestions,
    },
  }
}

/**
 * 간단한 준비 상태 확인
 */
export async function isReadyForAI(): Promise<boolean> {
  const result = await performHardwareCheck()
  return result.overall.ready
}

/**
 * GPU 정보 포맷팅
 */
export function formatGPUInfo(adapterInfo?: GPUAdapterInfo): string {
  if (!adapterInfo) return "알 수 없음"

  const parts = []
  if (adapterInfo.vendor) parts.push(adapterInfo.vendor)
  if (adapterInfo.architecture) parts.push(adapterInfo.architecture)
  if (adapterInfo.device) parts.push(adapterInfo.device)

  return parts.length > 0 ? parts.join(" - ") : "알 수 없음"
}
