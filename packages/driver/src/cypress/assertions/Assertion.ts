import type { Callbacks } from './assert'

export interface AssertionDefinition<T, U = T | Promise<T>> {
  name: string
  value: (obj: any) => U
  assertion: (value: U, expected: any) => boolean
  messages: {
    failure: string
    negatedFailure: string
  }
  property?: boolean
}

export class Assertion <T> {
  constructor (
    private definition: AssertionDefinition<T>,
  ) {}

  register (chai: Chai.ChaiStatic, callbacks: Callbacks) {
    if (this.definition.property) {
      chai.Assertion.addProperty(this.definition.name, this.chaiAssertionMethod(chai.util, callbacks))
    } else {
      chai.Assertion.addMethod(this.definition.name, this.chaiAssertionMethod(chai.util, callbacks))
    }
  }

  private chaiAssertionMethod = (utils: Chai.ChaiUtils, callbacks: Callbacks) => {
    const { name, value, assertion, messages } = this.definition

    return async function (this: Chai.AssertionStatic, expected: T) {
      const ctx = this

      try {
        const actualValue = await value(ctx._obj)
        const pass = assertion(actualValue, expected)

        return ctx.assert(
          pass,
          messages.failure,
          messages.negatedFailure,
          expected,
          actualValue,
        )
      } catch (error) {
        return callbacks.onError(error, name, ctx._obj, utils.flag(ctx, 'negate'))
      }
    }
  }
}
