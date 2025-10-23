/* eslint-disable no-console */
import { VisibilityCheck } from './VisibilityCheck'

export const BasicVisibility: VisibilityCheck = {
  when: ({ tagName }) => {
    // <option> and <optgroup> are special cases where we delegate to the
    // parent select in certain cases
    return tagName !== 'OPTION' && tagName !== 'OPTGROUP'
  },
  isHidden: (el) => {
    console.log('basicVisibility', el)

    const basicVisibility = el.checkVisibility({
      opacityProperty: true,
      contentVisibilityAuto: true,
      visibilityProperty: true,
    })

    console.log('basicVisibility', basicVisibility)

    if (!basicVisibility) {
      return true
    }

    console.log('basicVisibility fallthrough', el)

    return undefined
  },
}
