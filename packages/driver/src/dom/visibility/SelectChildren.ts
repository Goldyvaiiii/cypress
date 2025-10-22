import type { VisibilityCheck } from './VisibilityCheck'

export const SelectChildren: VisibilityCheck = {
  condition: (el, recurse?) => {
    if (el.is('option, optgroup')) {
      // delegate to the parent select
      const select = el.closest('select')

      if (select && recurse) {
        return recurse(select)
      }
    }

    return undefined
  },
}
