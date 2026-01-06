/**
 * PDF 텍스트 추출 유틸리티
 *
 * pdf.js 3.x를 사용하여 PDF 파일에서 텍스트를 추출합니다.
 * Chrome Extension 환경에서 워커 없이 메인 스레드에서 처리합니다.
 */

// @ts-ignore - pdfjs-dist 3.x 타입 호환성
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf"
// @ts-ignore - 워커를 인라인으로 로드
import PDFWorker from "pdfjs-dist/legacy/build/pdf.worker?url"

// pdf.js 워커 설정 - 번들된 워커 URL 사용
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

export interface PDFExtractResult {
  success: boolean
  text: string
  pageCount: number
  title?: string
  author?: string
  error?: string
}

/**
 * URL이 PDF 파일인지 확인
 */
export function isPdfUrl(url: string): boolean {
  if (!url) return false

  // .pdf 확장자 체크
  if (url.toLowerCase().endsWith(".pdf")) return true

  // Chrome PDF 뷰어 URL 체크
  if (url.includes("chrome-extension://") && url.includes("pdf")) return true

  // file:// 프로토콜의 PDF
  if (url.startsWith("file://") && url.toLowerCase().includes(".pdf")) return true

  return false
}

/**
 * PDF 파일에서 텍스트 추출
 */
export async function extractPdfText(
  source: string | ArrayBuffer,
  maxPages: number = 50
): Promise<PDFExtractResult> {
  try {
    console.log("[PDF] Starting extraction...")

    // PDF 문서 로드 (legacy 빌드는 워커 없이도 동작)
    const loadingTask = pdfjsLib.getDocument(
      source instanceof ArrayBuffer ? { data: new Uint8Array(source) } : source
    )
    const pdf = await loadingTask.promise

    console.log(`[PDF] Loaded document with ${pdf.numPages} pages`)

    // 메타데이터 추출
    const metadata = await pdf.getMetadata().catch(() => null)
    const title = metadata?.info?.Title as string | undefined
    const author = metadata?.info?.Author as string | undefined

    // 텍스트 추출
    const textParts: string[] = []
    const pagesToExtract = Math.min(pdf.numPages, maxPages)

    for (let i = 1; i <= pagesToExtract; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()

      if (pageText) {
        textParts.push(`[페이지 ${i}]\n${pageText}`)
      }
    }

    const fullText = textParts.join("\n\n")

    console.log(`[PDF] Extracted ${fullText.length} characters from ${pagesToExtract} pages`)

    return {
      success: true,
      text: fullText,
      pageCount: pdf.numPages,
      title,
      author,
    }
  } catch (error) {
    console.error("[PDF] Extraction error:", error)
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : "PDF 추출 실패",
    }
  }
}

/**
 * URL에서 PDF 데이터를 가져와서 텍스트 추출
 */
export async function extractPdfFromUrl(url: string): Promise<PDFExtractResult> {
  try {
    console.log("[PDF] Fetching from URL:", url)

    // fetch로 PDF 데이터 가져오기
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return extractPdfText(arrayBuffer)
  } catch (error) {
    console.error("[PDF] Fetch error:", error)
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : "PDF 다운로드 실패",
    }
  }
}

/**
 * Chrome 탭에서 PDF 추출 (Content Script 실행)
 */
export async function extractPdfFromTab(tabId: number, tabUrl: string): Promise<PDFExtractResult> {
  // file:// URL은 직접 접근 불가, 다른 방식 필요
  if (tabUrl.startsWith("file://")) {
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: "로컬 PDF 파일은 직접 열어서 분석해주세요. (드래그 앤 드롭 지원 예정)",
    }
  }

  // https:// PDF는 fetch로 가져오기
  return extractPdfFromUrl(tabUrl)
}
