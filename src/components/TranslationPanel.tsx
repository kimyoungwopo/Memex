/**
 * Translation Panel - 실시간 번역 패널
 *
 * 기능:
 * 1. 선택된 텍스트 가져오기
 * 2. 대상 언어 선택
 * 3. 번역 실행
 * 4. 번역 결과를 웹페이지에 주입
 */

import { useState, useCallback, useEffect } from "react"
import {
  Languages,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  ChevronDown,
} from "lucide-react"
import clsx from "clsx"
import {
  getSelectedText,
  injectTranslatedText,
  getTranslationPrompt,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from "../lib/translation"

interface TranslationPanelProps {
  onTranslate: (prompt: string) => Promise<string>
  isLoading: boolean
}

export function TranslationPanel({ onTranslate, isLoading }: TranslationPanelProps) {
  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [targetLang, setTargetLang] = useState<LanguageCode>("ko")
  const [isGettingSelection, setIsGettingSelection] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [injected, setInjected] = useState(false)
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 선택된 텍스트 가져오기
  const handleGetSelection = useCallback(async () => {
    setIsGettingSelection(true)
    setError(null)
    try {
      const text = await getSelectedText()
      if (text) {
        setSourceText(text)
        setTranslatedText("")
        setInjected(false)
      } else {
        setError("선택된 텍스트가 없습니다. 웹페이지에서 텍스트를 드래그하세요.")
      }
    } catch (err) {
      setError("텍스트를 가져오는데 실패했습니다.")
    } finally {
      setIsGettingSelection(false)
    }
  }, [])

  // 번역 실행
  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || isTranslating) return

    setIsTranslating(true)
    setError(null)
    setInjected(false)

    try {
      const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || "한국어"
      const prompt = getTranslationPrompt(sourceText, langName)
      const result = await onTranslate(prompt)
      setTranslatedText(result.trim())
    } catch (err) {
      setError("번역 중 오류가 발생했습니다.")
    } finally {
      setIsTranslating(false)
    }
  }, [sourceText, targetLang, onTranslate, isTranslating])

  // 복사
  const handleCopy = useCallback(async () => {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [translatedText])

  // 웹페이지에 주입
  const handleInject = useCallback(async () => {
    if (!translatedText) return
    const success = await injectTranslatedText(translatedText)
    if (success) {
      setInjected(true)
      setTimeout(() => setInjected(false), 2000)
    } else {
      setError("번역 결과를 페이지에 표시할 수 없습니다.")
    }
  }, [translatedText])

  // 선택 언어
  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700">실시간 번역</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 선택 텍스트 가져오기 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">원문</span>
            <button
              onClick={handleGetSelection}
              disabled={isGettingSelection}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
                isGettingSelection && "opacity-50 cursor-not-allowed"
              )}
            >
              {isGettingSelection ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              선택 텍스트 가져오기
            </button>
          </div>

          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="번역할 텍스트를 입력하거나, 웹페이지에서 텍스트를 선택한 후 '선택 텍스트 가져오기' 버튼을 누르세요."
            className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>

        {/* 언어 선택 + 번역 버튼 */}
        <div className="flex items-center gap-3">
          {/* 자동 감지 라벨 */}
          <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-500 text-center">
            자동 감지
          </div>

          <ArrowRight className="w-5 h-5 text-slate-400" />

          {/* 대상 언어 선택 */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:border-indigo-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>{selectedLang?.flag}</span>
                <span>{selectedLang?.name}</span>
              </span>
              <ChevronDown className={clsx(
                "w-4 h-4 text-slate-400 transition-transform",
                showLangDropdown && "rotate-180"
              )} />
            </button>

            {showLangDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 max-h-48 overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setTargetLang(lang.code)
                      setShowLangDropdown(false)
                    }}
                    className={clsx(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 transition-colors",
                      targetLang === lang.code ? "bg-indigo-50 text-indigo-600" : "text-slate-700"
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 번역 버튼 */}
        <button
          onClick={handleTranslate}
          disabled={!sourceText.trim() || isTranslating || isLoading}
          className={clsx(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all",
            "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30",
            "hover:from-indigo-500 hover:to-purple-500",
            (!sourceText.trim() || isTranslating || isLoading) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isTranslating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>번역 중...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>번역하기</span>
            </>
          )}
        </button>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 번역 결과 */}
        {translatedText && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-indigo-700">번역 결과</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                    copied
                      ? "bg-green-100 text-green-600"
                      : "bg-white/80 text-slate-600 hover:bg-white"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      복사
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-white/80 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
              {translatedText}
            </div>

            {/* 페이지에 적용 버튼 */}
            <button
              onClick={handleInject}
              className={clsx(
                "w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                injected
                  ? "bg-green-500 text-white"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              )}
            >
              {injected ? (
                <>
                  <Check className="w-4 h-4" />
                  페이지에 표시됨!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  페이지에 표시하기
                </>
              )}
            </button>
          </div>
        )}

        {/* 사용법 안내 */}
        {!sourceText && !translatedText && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-2">사용 방법</p>
            <ol className="text-xs text-slate-500 space-y-1.5">
              <li>1. 웹페이지에서 번역할 텍스트를 드래그하여 선택</li>
              <li>2. "선택 텍스트 가져오기" 버튼 클릭</li>
              <li>3. 대상 언어 선택 후 "번역하기" 클릭</li>
              <li>4. "페이지에 표시하기"로 결과 확인</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
