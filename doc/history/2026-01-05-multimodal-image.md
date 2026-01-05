# 멀티모달 이미지 입력 (Multimodal Image Input)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐
**상태:** 비활성화 (코드 유지)

> **Note:** Gemini Nano의 멀티모달 성능 한계로 인해 UI에서 비활성화됨.
> `ENABLE_IMAGE_INPUT = false`로 설정하여 기능 숨김.
> 향후 Chrome AI 모델 개선 시 재활성화 예정.

## 개요

텍스트뿐만 아니라 이미지를 첨부하여 AI와 대화. 스크린샷, 차트, 에러 메시지 등을 분석 요청 가능.

## 지원 입력 방식

| 방식 | 설명 | 이벤트 |
|------|------|--------|
| 드래그 앤 드롭 | 이미지 파일을 채팅창에 드래그 | `onDrop` |
| 클립보드 붙여넣기 | Ctrl+V / Cmd+V로 스크린샷 | `onPaste` |
| 파일 선택 | 버튼 클릭으로 파일 선택 | `onChange` (input) |

## 추가/수정 파일

- `src/components/ImagePreview.tsx` - NEW: 이미지 미리보기 + 유틸 함수
- `src/components/ChatMessage.tsx` - 이미지 표시 기능 추가
- `src/hooks/use-gemini.ts` - `generateStream` 멀티모달 지원
- `src/sidepanel.tsx` - 드래그/드롭/붙여넣기 핸들러
- `src/types.ts` - Message에 image 필드 추가

## 데이터 흐름

```
1. 이미지 입력 (드래그/붙여넣기/파일선택)
2. File → Base64 Data URL 변환 (imageToBase64)
3. attachedImage 상태에 저장
4. 전송 시:
   - Base64 → Blob 변환
   - LanguageModelContent[] 배열 구성
   - promptStreaming([{ role: "user", content }]) 호출
5. ChatMessage에서 이미지 렌더링
```

## 코드 예시

```typescript
// ImagePreview.tsx - Base64 변환
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// use-gemini.ts - 멀티모달 프롬프트
const generateStream = useCallback(
  (input: string, options?: { signal?: AbortSignal; image?: string }) => {
    if (options?.image) {
      // Base64 → Blob 변환
      const base64Data = options.image.split(",")[1]
      const mimeType = options.image.split(";")[0].split(":")[1]
      const byteArray = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)))
      const imageBlob = new Blob([byteArray], { type: mimeType })

      // 멀티모달 콘텐츠
      const content: LanguageModelContent[] = [
        { type: "image", value: imageBlob },
        { type: "text", value: input }
      ]

      return sessionRef.current.promptStreaming(
        [{ role: "user", content }],
        { signal: options?.signal }
      )
    }
    return sessionRef.current.promptStreaming(input)
  },
  [status]
)
```

## 사용 시나리오

- **차트 분석**: 그래프 스크린샷 → "이 데이터 엑셀로 정리해줘"
- **에러 디버깅**: 에러 화면 캡처 → "이거 무슨 에러야?"
- **이미지 설명**: 사진 첨부 → "이 이미지에 뭐가 있어?"
- **UI 리뷰**: 디자인 캡처 → "이 UI 개선점 알려줘"

## UI 요소

- 드래그 오버레이: 파란색 점선 테두리 + "이미지를 여기에 드롭하세요"
- 이미지 미리보기: 96x96 썸네일 + 제거 버튼
- 첨부 버튼: ImagePlus 아이콘
