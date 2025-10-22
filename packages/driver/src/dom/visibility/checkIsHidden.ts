import type { VisibilityCheck } from './VisibilityCheck'
import { isJquery } from '../jquery'
import { memoizeElement } from './memoize'

// Returns true if the element is hidden according to any of the checks.
// Returns false if the element is not hidden according to the checks.
// Checks that return undefined are "fall-through" checks.
// Checks should be ordered in performance & priority order.
export function checkIsHidden (el: JQuery<HTMLElement>, checks: VisibilityCheck[], recurse?: (el: JQuery<HTMLElement>) => boolean | undefined): boolean | undefined {
  const methodsToMemoize = Array.from(checks
  .flatMap((check) => check.requiredMethods || [])
  .reduce((acc: Set<keyof HTMLElement>, method) => {
    acc.add(method)

    return acc
  }, new Set<keyof HTMLElement>()).values())

  const subject = memoizeElement(
    isJquery(el) ? el.get(0) : el,
    methodsToMemoize,
  )

  for (const check of checks) {
    const result = check.condition(subject, recurse)

    if (result !== undefined) {
      return result
    }
  }

  return undefined
}
