import html2canvas from 'html2canvas'
import { compressDataUrl } from '../lib/imageCompress'

export type CaptureKind = 'full' | 'viewport' | 'element'

export async function captureToDataUrl(kind: CaptureKind, element?: Element): Promise<string> {
  const target = (kind === 'element' && element ? element : document.body) as HTMLElement
  const canvas = await html2canvas(target, {
    ...(kind === 'viewport'
      ? { windowWidth: window.innerWidth, height: window.innerHeight }
      : {}),
    useCORS: true,
    logging: false,
  })
  return compressDataUrl(canvas.toDataURL('image/png'))
}

function setImportant(style: CSSStyleDeclaration, property: string, value: string): void {
  style.setProperty(property, value, 'important')
}

function createAnnotationOverlay(el: Element, label: number | string): HTMLElement {
  const rect = el.getBoundingClientRect()
  const overlay = document.createElement('div')
  overlay.dataset.previewSelectionAnnotation = 'true'
  overlay.setAttribute('aria-hidden', 'true')
  setImportant(overlay.style, 'position', 'fixed')
  setImportant(overlay.style, 'left', `${rect.left}px`)
  setImportant(overlay.style, 'top', `${rect.top}px`)
  setImportant(overlay.style, 'width', `${rect.width}px`)
  setImportant(overlay.style, 'height', `${rect.height}px`)
  setImportant(overlay.style, 'box-sizing', 'border-box')
  setImportant(overlay.style, 'border', '3px solid #2f7bff')
  setImportant(overlay.style, 'border-radius', '8px')
  setImportant(overlay.style, 'background', 'rgba(47, 123, 255, 0.08)')
  setImportant(overlay.style, 'box-shadow', '0 0 0 2px rgba(255, 255, 255, 0.9)')
  setImportant(overlay.style, 'pointer-events', 'none')
  setImportant(overlay.style, 'z-index', '2147483647')

  const badge = document.createElement('div')
  badge.textContent = String(label)
  setImportant(badge.style, 'position', 'absolute')
  setImportant(badge.style, 'top', '4px')
  setImportant(badge.style, 'right', '4px')
  setImportant(badge.style, 'display', 'flex')
  setImportant(badge.style, 'align-items', 'center')
  setImportant(badge.style, 'justify-content', 'center')
  setImportant(badge.style, 'width', '24px')
  setImportant(badge.style, 'height', '24px')
  setImportant(badge.style, 'border-radius', '999px')
  setImportant(badge.style, 'background', '#2f7bff')
  setImportant(badge.style, 'color', '#ffffff')
  setImportant(badge.style, 'font', '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
  setImportant(badge.style, 'line-height', '24px')
  setImportant(badge.style, 'box-shadow', '0 0 0 2px rgba(255, 255, 255, 0.95)')
  overlay.appendChild(badge)

  document.documentElement.appendChild(overlay)
  return overlay
}

/** Viewport screenshot with the picked element's region annotated (blue box + numbered badge). 图4 */
export async function captureAnnotatedRegion(el: Element, label = 1): Promise<string> {
  const overlay = createAnnotationOverlay(el, label)
  try {
    const canvas = await html2canvas(document.documentElement, {
      useCORS: true,
      logging: false,
      scale: 1,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    })
    return compressDataUrl(canvas.toDataURL('image/png'))
  } finally {
    overlay.remove()
  }
}
