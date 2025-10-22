import type { VisibilityCheck } from './VisibilityCheck'

export const BodyOrHtml: VisibilityCheck = {
  condition: (el) => {
    console.log('bodyOrHtml condition', el)
    const cond = el.is('body,html')

    console.log('cond', cond)

    if (el.is('body,html')) {
      console.log('bodyOrHtml', el)

      return false
    }

    return undefined
  },
}
