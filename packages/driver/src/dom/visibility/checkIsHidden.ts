import type { VisibilityCheck } from './VisibilityCheck'
import { isJquery } from '../jquery'
import { memoize } from './memoize'

// Returns true if the element is hidden according to any of the checks.
// Returns false if the element is not hidden according to the checks.
// Checks that return undefined are "fall-through" checks.
// Checks should be ordered in performance & priority order.
export function checkIsHidden (el: JQuery<HTMLElement>, checks: VisibilityCheck[], recurse: (el: JQuery<HTMLElement>) => boolean | undefined): boolean | undefined {
  const subject = memoize(
    isJquery(el) ? el.get(0) : el,
  )

  for (const check of checks) {
    if (!check.when(subject)) {
      continue
    }

    const result = check.isHidden(subject, recurse)

    if (result !== undefined) {
      return result
    }
  }

  return undefined
}
