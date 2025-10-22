import type { VisibilityCheck } from './VisibilityCheck'

export const NilDimension: VisibilityCheck = {
  condition: (el) => {
    const boundingRect = el.getBoundingClientRect()
    const rects = el.getClientRects()

    const hasTextContent = !!el.textContent?.trim().length

    return (boundingRect.width === 0 && boundingRect.height === 0 && !hasTextContent)
  },
}
