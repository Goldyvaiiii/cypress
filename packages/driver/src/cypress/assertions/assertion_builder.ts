import $dom from '../../dom'
import $errUtils from '../error_utils'
import $utils from '../utils'
import type { Predicate } from './predicates'

export interface Assertion<T> {
  name: string
  predicates?: Predicate<T>[]
  test: (subject: T) => boolean | Promise<boolean>
  getExpected: () => any
  failureMsg: string
  negatedFailureMsg: string
}

export class AssertionBuilder {
  // @ts-expect-error - throwErrByPath throws an error, so "never" is actually respected
  static onInvalid (method: string, path: string, obj: any): never {
    $errUtils.throwErrByPath(path, {
      args: {
        assertion: method,
        subject: $utils.stringifyActual(obj),
      },
    })
  }

  static onError (err: Error, method: string, subject: string, negated: boolean): never {
    if (method === 'visible') {
      if (!negated) {
        // add reason hidden unless we expect the element to be hidden
        const reason = $dom.getReasonIsHidden(subject)

        err.message += `\n\n${reason}`
      }
    }

    throw err
  }

  constructor (private chai: Chai.ChaiStatic, private utils: Chai.ChaiUtils) {}

  add<T> (definition: Assertion<T>): void {
    this.chai.Assertion.addProperty(definition.name, this.composeAssertionFn(definition))
  }

  private composeAssertionFn<T> ({ name, failureMsg, negatedFailureMsg, test, predicates, getExpected }: Assertion<T>) {
    const { utils } = this

    return async function (this: Chai.AssertionStatic): Promise<any> {
      try {
        const actual: T = this._obj

        if (predicates && predicates.length > 0) {
          for (const predicate of predicates) {
            if (!predicate.test(actual, utils.flag(this, 'negate'))) {
              AssertionBuilder.onInvalid(name, predicate.errorPath, $utils.stringifyActual(actual))
            }
          }
        }

        const result = await test(actual)

        this.assert(
          result,
          failureMsg,
          negatedFailureMsg,
          getExpected(),
          actual,
        )

        return this
      } catch (error) {
        AssertionBuilder.onError(error, name, this._obj, utils.flag(this, 'negate'))
      }
    }
  }
}
