export type Role = "user" | "ai" | "system"

export interface Message {
  id?: string
  role: Role
  text: string
  timestamp?: number
  isThinking?: boolean
}

export type AIStatus = "loading" | "ready" | "downloading" | "error" | "unsupported"

// Chrome Built-in AI Prompt API Types (2026 Spec)
// https://github.com/webmachinelearning/prompt-api

export type LanguageModelAvailability = "available" | "downloadable" | "downloading" | "unavailable"

export interface LanguageModelParams {
  defaultTemperature: number
  maxTemperature: number
  defaultTopK: number
  maxTopK: number
}

export interface LanguageModelPrompt {
  role: "system" | "user" | "assistant"
  content: string | LanguageModelContent[]
  prefix?: boolean // 응답 접두어로 사용 시
}

export interface LanguageModelContent {
  type: "text" | "image" | "audio"
  value: string | Blob | ImageData | ImageBitmap | AudioBuffer | BufferSource
}

export interface LanguageModelExpectedIO {
  type?: "text" | "image" | "audio"
  languages?: string[]
}

export interface LanguageModelTool {
  name: string
  description: string
  inputSchema: object
  execute: (args: unknown) => Promise<unknown>
}

export interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelPrompt[]
  temperature?: number
  topK?: number
  expectedInputs?: LanguageModelExpectedIO[]
  expectedOutputs?: LanguageModelExpectedIO[]
  tools?: LanguageModelTool[]
  signal?: AbortSignal
  monitor?: (monitor: EventTarget) => void
}

export interface LanguageModelPromptOptions {
  signal?: AbortSignal
  responseConstraint?: object | RegExp
  omitResponseConstraintInput?: boolean
}

export interface LanguageModelSessionInfo {
  inputUsage: number
  inputQuota: number
}

// Phase 2: Vector DB
export interface MemoryParams {
  id: string
  url: string
  title: string
  content: string
  embedding: number[]
  createdAt: number
}
