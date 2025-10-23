/* eslint-disable no-console */
import type { VisibilityCheck } from './VisibilityCheck'
import { wrap } from '../jquery'

export const SelectChildren: VisibilityCheck = {
  when: (el) => {
    return el.tagName === 'OPTION' || el.tagName === 'OPTGROUP'
  },
  isHidden: (el, recurse) => {
    const { tagName } = el

    console.log('selectChildren', el)
    console.log('tagName', tagName)

    const matches = tagName === 'OPTION' || tagName === 'OPTGROUP'

    console.log('matches', matches)

    if (matches) {
      console.log('match', el)
    }

    if (tagName === 'OPTION' || tagName === 'OPTGROUP') {
      // first, check to see if the
      // delegate to the parent select
      const select = el.closest('select')

      const optIsDisplayNone = el.computedStyleMap().get('display')?.toString() === 'none'

      const selectIsHidden = recurse(wrap(select))

      console.log('optIsDisplayNone', optIsDisplayNone)
      console.log('selectIsHidden', selectIsHidden)

      if (!selectIsHidden && !optIsDisplayNone) {
        return false
      }
    }

    return undefined
  },
}
