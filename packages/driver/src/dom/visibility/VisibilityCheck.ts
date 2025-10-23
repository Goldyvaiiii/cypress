import type { Memoized } from './memoize'

export interface VisibilityCheck {
  when: (el: Memoized<HTMLElement>) => boolean | undefined
  requiredMeasures?: (keyof HTMLElement)[]
  isHidden: (el: Memoized<HTMLElement>, recurse: (el: JQuery<HTMLElement>) => boolean | undefined) => boolean | undefined
}
