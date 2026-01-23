import $ from 'jquery'
import type { Assertion } from './assertion_builder'
import { IsDom, PopulatedIfJquery } from './predicates'

function createSelectorAssertion (selector: string): Assertion<JQuery> {
  return {
    name: selector,
    predicates: [IsDom, PopulatedIfJquery],
    test: (subject) => $(subject).is(`:${selector}`),
    getExpected: () => selector,
    failureMsg: `expected #{this} to be #{exp}`,
    negatedFailureMsg: `expected #{this} not to be ${selector}`,
  }
}

export const selectors = [
  'visible', 'hidden', 'selected', 'checked', 'enabled', 'disabled', 'focused',
].map(createSelectorAssertion)
