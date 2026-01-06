/**
 * Error Boundary - 런타임 에러 캐치 및 폴백 UI
 *
 * React 컴포넌트 트리 내에서 발생하는 JavaScript 에러를 캐치하고
 * 사용자 친화적인 에러 화면을 표시합니다.
 */

import { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    // 에러 로깅 (프로덕션에서는 에러 리포팅 서비스로 전송 가능)
    console.error("[ErrorBoundary] Caught error:", error)
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 커스텀 fallback이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 기본 에러 UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            오류가 발생했습니다
          </h2>
          <p className="text-sm text-red-600 text-center mb-4 max-w-md">
            {this.state.error?.message || "알 수 없는 오류가 발생했습니다."}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
          {process.env.NODE_ENV === "development" && this.state.errorInfo && (
            <details className="mt-4 w-full max-w-md">
              <summary className="cursor-pointer text-xs text-red-500">
                기술적 세부 정보 (개발 모드)
              </summary>
              <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-40">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 특정 섹션용 간소화된 Error Boundary
 */
interface SectionErrorBoundaryProps {
  children: ReactNode
  sectionName?: string
}

interface SectionErrorBoundaryState {
  hasError: boolean
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): Partial<SectionErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[${this.props.sectionName || "Section"}] Error:`, error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-slate-100 rounded-lg text-center">
          <p className="text-sm text-slate-500">
            이 섹션을 로드할 수 없습니다
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-indigo-600 hover:underline"
          >
            다시 시도
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
