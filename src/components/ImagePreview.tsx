import { X, Image as ImageIcon } from "lucide-react"

interface ImagePreviewProps {
  src: string
  onRemove: () => void
}

export function ImagePreview({ src, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative inline-block group">
      <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-indigo-200 bg-slate-100">
        <img
          src={src}
          alt="첨부 이미지"
          className="w-full h-full object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
        aria-label="첨부된 이미지 제거"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Image Icon Badge */}
      <div className="absolute bottom-1 right-1 bg-indigo-600 text-white p-1 rounded">
        <ImageIcon className="w-3 h-3" />
      </div>
    </div>
  )
}

// 이미지를 Base64로 변환하는 유틸 함수
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 이미지를 Blob으로 변환 (크기 조정 포함)
export async function resizeImage(
  file: File,
  maxWidth: number = 1024,
  maxHeight: number = 1024
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      // 비율 유지하면서 리사이즈
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("캔버스 컨텍스트를 사용할 수 없습니다"))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("이미지 변환에 실패했습니다"))
          }
        },
        "image/jpeg",
        0.85
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// 클립보드에서 이미지 추출
export function getImageFromClipboard(items: DataTransferItemList): File | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith("image/")) {
      return item.getAsFile()
    }
  }
  return null
}

// 드래그 앤 드롭에서 이미지 추출
export function getImageFromDrop(files: FileList): File | null {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith("image/")) {
      return file
    }
  }
  return null
}
