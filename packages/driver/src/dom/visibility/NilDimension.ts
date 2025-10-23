/* eslint-disable no-console */
import type { VisibilityCheck } from './VisibilityCheck'

export const NilDimension: VisibilityCheck = {
  when () {
    return true
  },
  isHidden (el) {
    const boundingRect = el.getBoundingClientRect()
    const rects = el.getClientRects()

    console.log('nilDimension', el)
    console.log('boundingRect', boundingRect)
    console.log('rects', rects)

    const hasTextContent = !!el.textContent?.trim().length

    console.log('hasTextContent', hasTextContent)

    const result = ((boundingRect.width === 0 || boundingRect.height === 0) && !hasTextContent)

    console.log('nilDimension result', result)

    return result
  },
}
