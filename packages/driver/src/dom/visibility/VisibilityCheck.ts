import type { Memoized } from './memoize'

export interface VisibilityCheck {
  requiredMeasures?: (keyof HTMLElement)[]
  condition: (el: Memoized<HTMLElement>, recurse?: (el: JQuery<HTMLElement>) => boolean | undefined) => boolean | undefined
}
