import type { VisibilityCheck } from './VisibilityCheck'

export const BodyOrHtml: VisibilityCheck = {
  when: (el) => {
    return el.tagName === 'BODY' || el.tagName === 'HTML'
  },
  isHidden: (el) => {
    return false
  },
}
