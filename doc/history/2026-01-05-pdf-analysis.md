# PDF 문서 분석 (PDF Document Analysis)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐
**상태:** 완료

## 개요

Chrome에서 열린 PDF 문서의 텍스트를 추출하고 AI로 분석하는 기능. pdf.js 라이브러리를 사용하여 PDF 파일에서 텍스트를 추출하고, Gemini Nano로 요약 및 키워드 분석을 수행합니다.

## 기능 상세

### PDF 텍스트 추출
- **pdf.js 라이브러리** 사용 (pdfjs-dist)
- 최대 50페이지까지 텍스트 추출 지원
- 메타데이터 추출 (제목, 저자)
- 페이지별 텍스트 구분

### PDF 페이지 감지
- URL 확장자 `.pdf` 자동 감지
- Chrome PDF 뷰어 URL 감지
- `file://` 프로토콜 PDF 감지 (제한적 지원)

### AI 분석
- 3줄 핵심 요약
- 주요 키워드 추출
- 문서 유형 분류 (논문, 보고서, 매뉴얼 등)

### 기억하기 연동
- 분석한 PDF를 메모리에 저장
- 나중에 RAG 검색으로 회상 가능

## 추가/수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/pdf.ts` | (신규) PDF 텍스트 추출 유틸리티 |
| `src/sidepanel.tsx` | PDF 상태 변수, 분석 버튼, handleAnalyzePdf 함수 추가 |
| `manifest.json` | CSP에 pdf.js CDN 허용 |
| `package.json` | pdfjs-dist 패키지 추가 |

## 코드 예시

### PDF 텍스트 추출 (pdf.ts)
```typescript
import * as pdfjsLib from "pdfjs-dist"

// PDF.js 워커 설정 (CDN 사용)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export async function extractPdfText(
  source: string | ArrayBuffer,
  maxPages: number = 50
): Promise<PDFExtractResult> {
  const loadingTask = pdfjsLib.getDocument(source)
  const pdf = await loadingTask.promise

  const textParts: string[] = []
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ")
    textParts.push(`[페이지 ${i}]\n${pageText}`)
  }

  return {
    success: true,
    text: textParts.join("\n\n"),
    pageCount: pdf.numPages,
    title: metadata?.info?.Title,
    author: metadata?.info?.Author,
  }
}
```

### PDF 분석 핸들러 (sidepanel.tsx)
```typescript
const handleAnalyzePdf = async () => {
  setIsAnalyzingPdf(true)

  // 1. 현재 탭 URL 가져오기
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  // 2. PDF 텍스트 추출
  const result = await extractPdfFromUrl(tab.url)

  // 3. AI 요약 생성
  const summary = await generate(summaryPrompt)

  // 4. 컨텍스트 설정 (질문 응답용)
  setPageContext({
    title: pdfTitle,
    url: tab.url,
    content: result.text,
  })
}
```

## 사용법 / 시나리오

### 시나리오 1: 온라인 PDF 분석
1. 브라우저에서 온라인 PDF 열기 (예: `https://example.com/doc.pdf`)
2. 사이드 패널 열기 (Cmd+B)
3. **PDF 분석** 버튼 클릭 (오렌지색)
4. 텍스트 추출 및 AI 요약 자동 수행
5. 요약 결과 확인 후 추가 질문 가능

### 시나리오 2: PDF 기억하기
1. PDF 분석 완료 후
2. **기억** 버튼 클릭
3. 임베딩 생성 후 메모리에 저장
4. 나중에 관련 질문 시 자동 회상

## 제한사항

- **로컬 PDF (file://)**: 보안 제약으로 직접 접근 불가
- **이미지 기반 PDF**: 텍스트 레이어가 없는 스캔 PDF는 추출 불가
- **대용량 PDF**: 50페이지 이상은 일부만 추출

## UI/UX

- PDF 페이지 감지 시 버튼 색상: **오렌지** (`bg-orange-50`)
- 분석 중 로딩 스피너 표시
- 페이지 수, 저자 정보 표시
- 분석 후 즉시 질문 가능
