/**
 * Global Type Declarations for Chrome Built-in AI APIs
 *
 * Chrome AI (Gemini Nano) Prompt API 타입 정의
 * https://github.com/webmachinelearning/prompt-api
 */

// ============ Language Model API Types ============

type LanguageModelAvailability = "available" | "downloadable" | "downloading" | "unavailable"

interface LanguageModelParams {
  defaultTemperature: number
  maxTemperature: number
  defaultTopK: number
  maxTopK: number
}

interface LanguageModelPrompt {
  role: "system" | "user" | "assistant"
  content: string | LanguageModelContent[]
}

interface LanguageModelContent {
  type: "text" | "image" | "audio"
  value: string | Blob | ImageData | ImageBitmap | AudioBuffer | BufferSource
}

interface LanguageModelExpectedIO {
  type?: "text" | "image" | "audio"
  languages?: string[]
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelPrompt[]
  temperature?: number
  topK?: number
  expectedInputs?: LanguageModelExpectedIO[]
  expectedOutputs?: LanguageModelExpectedIO[]
  signal?: AbortSignal
  monitor?: (monitor: LanguageModelDownloadMonitor) => void
}

interface LanguageModelDownloadMonitor extends EventTarget {
  addEventListener(
    type: "downloadprogress",
    listener: (event: LanguageModelDownloadProgressEvent) => void
  ): void
}

interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number
}

interface LanguageModelPromptOptions {
  signal?: AbortSignal
  responseConstraint?: object | RegExp
}

interface LanguageModelSession {
  prompt: (input: string | LanguageModelPrompt[], options?: LanguageModelPromptOptions) => Promise<string>
  promptStreaming: (input: string | LanguageModelPrompt[], options?: LanguageModelPromptOptions) => ReadableStream<string>
  append: (prompts: LanguageModelPrompt[]) => Promise<void>
  measureInputUsage: (input: string | LanguageModelPrompt[]) => Promise<number>
  clone: (options?: { signal?: AbortSignal }) => Promise<LanguageModelSession>
  destroy: () => void
  readonly inputUsage: number
  readonly inputQuota: number
  addEventListener(type: "quotaoverflow", listener: () => void): void
}

interface LanguageModelAPI {
  availability: (options?: {
    expectedInputs?: LanguageModelExpectedIO[]
    expectedOutputs?: LanguageModelExpectedIO[]
  }) => Promise<LanguageModelAvailability>
  params: () => Promise<LanguageModelParams | null>
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession>
}

// ============ Global Declarations ============

/**
 * Chrome AI의 전역 LanguageModel 객체 (최신 스펙)
 */
declare const LanguageModel: LanguageModelAPI | undefined

/**
 * window.ai 네임스페이스 (레거시 호환)
 */
interface WindowAI {
  languageModel?: LanguageModelAPI
}

declare global {
  interface Window {
    ai?: WindowAI
  }
}

// self.ai도 지원 (Service Worker 환경)
declare const self: Window & typeof globalThis & {
  ai?: WindowAI
}

export {}
