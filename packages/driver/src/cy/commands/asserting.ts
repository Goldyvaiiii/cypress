import _ from 'lodash'

import $dom from '../../dom'
import $errUtils from '../../cypress/error_utils'

const reExistence = /exist/
const reHaveLength = /length/

const onBeforeLog = (log, command, commandLogId) => {
  log.set('commandLogId', commandLogId)

  const previousLogInstance = command.get('logs').find(_.matchesProperty('attributes.commandLogId', commandLogId))

  if (previousLogInstance) {
    // log.merge unsets any keys that aren't set on the new log instance. We
    // copy over 'snapshots' beforehand so that existing snapshots aren't lost
    // in the merge operation.
    log.set('snapshots', previousLogInstance.get('snapshots'))
    previousLogInstance.merge(log)

    if (previousLogInstance.get('end')) {
      previousLogInstance.end()
    }

    // Returning false prevents this new log from being added to the command log
    return false
  }

  return true
}

type ChainerFn = (subject: unknown) => void | Promise<void>

function isFn (value: unknown): value is Function {
  return _.isFunction(value)
}
export default function (Commands, Cypress, cy, state) {
  const shouldFnWithCallback = async function <Subject> (subject: Subject, fn: ChainerFn) {
    state('current')?.set('followedByShouldCallback', true)

    const commandEnqueued = (obj: Cypress.EnqueuedCommandAttributes) => {
      $errUtils.throwErrByPath(
        'should.command_inside_should', {
          args: { action: obj.name },
          errProps: { retry: false },
        },
      )
    }

    try {
      const remoteSubject = cy.getRemotejQueryInstance(subject)

      Cypress.once('command:enqueued', commandEnqueued)

      await fn.call(this, remoteSubject ? remoteSubject : subject)
    } finally {
      Cypress.removeListener('command:enqueued', commandEnqueued)
    }

    state('current')?.set('followedByShouldCallback', false)

    return subject
  }

  const shouldFn = async function <Subject> (subject: Subject, chainers: string | ChainerFn, ...args: unknown[]) {
    const command = cy.state('current')

    // Most commands are responsible for creating and managing their own log messages directly.
    // .should(), however, is an exception - it is invoked by earlier commands, as part of
    // `verifyUpcomingAssertions`. This callback can also be invoked any number of times, but we only want
    // to display a few log messages (one for each assertion).

    // Therefore, we each time Cypress.log() is called, we need a way to identify if this log call
    // a duplicate of a previous one that's just being retried. This is the purpose of `commandLogId` - it should
    // remain the same across multiple invocations of verifyUpcomingAssertions().

    // It is composed of two parts: assertionIndex and logIndex. Assertion index is "which .should() command are we
    // inside". Consider the following case:
    // `cy.noop(3).should('be.lessThan', 4).should('be.greaterThan', 2)`
    // cy.state('current') is always the 'noop' command, which rolls up the two upcoming assertions, lessThan and
    // greaterThan. `assertionIndex` lets us tell them apart even though they have the same logIndex of 0 (since it
    // resets each time .should() is called).

    // As another case, consider:
    // cy.noop(3).should((n) => { expect(n).to.be.lessThan(4); expect(n).to.be.greaterThan(2); })
    // Here, assertionIndex is 0 for both - one .should() block generates two log messages. In this case, logIndex is
    // used to tell them apart, since it increments each time Cypress.log() is called within a single retry of a single
    // .should().
    const assertionIndex: number = cy.state('upcomingAssertions') ? cy.state('upcomingAssertions').indexOf(command.get('currentAssertionCommand')) : 0
    let logIndex = 0

    if (isFn(chainers)) {
      cy.state('onBeforeLog', (log) => {
        logIndex++

        return onBeforeLog(log, command, `${assertionIndex}-${logIndex}`)
      })

      try {
        return shouldFnWithCallback.call(this, subject, chainers)
      } finally {
        cy.state('onBeforeLog', undefined)
      }
    }

    // At this point, chainers is a string
    const chainerString: string = chainers

    let exp: Chai.AssertionStatic = cy.expect(subject).to

    const throwAndLogErr = (err) => {
      // since we are throwing our own error
      // without going through the assertion we need
      // to ensure our .should command gets logged
      logIndex++
      const log = Cypress.log({
        name: 'should',
        type: 'child',
        message: ([] as any[]).concat(chainerString, args),
        end: true,
        snapshot: true,
        error: err,
      })

      return $errUtils.throwErr(err, { onFail: log })
    }

    const chainerParts: string[] = chainerString.split('.')
    const lastChainer = _.last(chainerParts)

    // backup the original assertion subject
    const originalObj = exp._obj
    let err

    const isCheckingExistence = reExistence.test(chainerString)
    const isCheckingLengthOrExistence = isCheckingExistence || reHaveLength.test(chainerString)

    const applyChainer = async function (memo: Chai.AssertionStatic, value: string): Promise<Chai.AssertionStatic | any> {
      logIndex++
      cy.state('onBeforeLog', (log) => {
        return onBeforeLog(log, command, `${assertionIndex}-${logIndex}`)
      })

      try {
        if (value === lastChainer && !isCheckingExistence) {
          // https://github.com/cypress-io/cypress/issues/16006
          // Referring some commands like 'visible'  triggers assert function in chai_jquery.js
          // It creates duplicated messages and confuses users.
          const cmd: unknown = memo[value]

          if (isFn(cmd)) {
            try {
              return await cmd.apply(memo, args) as Chai.AssertionStatic
            } catch (err: any) {
              // if we made it all the way to the actual
              // assertion but its set to retry false then
              // we need to log out this .should since there
              // was a problem with the actual assertion syntax
              if (err.retry === false) {
                return throwAndLogErr(err)
              }

              throw err
            }
          } else {
            return await cmd as Chai.AssertionStatic
          }
        } else {
          return await memo[value] as Chai.AssertionStatic
        }
      } finally {
        cy.state('onBeforeLog', undefined)
      }
    }

    const applyChainers = async function (): Promise<Chai.AssertionStatic> {
      // if we're not doing existence or length assertions
      // then check to ensure the subject exists
      // in the DOM if its a DOM subject
      // because its possible we're asserting about an
      // element which has left the DOM and we always
      // want to auto-fail on those
      if (!isCheckingLengthOrExistence && $dom.isElement(subject)) {
        Cypress.ensure.isAttached(subject, 'should', cy)
      }

      for (const part of chainerParts) {
        if (!(part in exp)) {
          err = $errUtils.cypressErrByPath('should.chainer_not_found', { args: { chainer: part } })
          err.retry = false
          throwAndLogErr(err)
        }

        exp = await applyChainer(exp, part)
      }

      return exp
    }

    await applyChainers()

    if (originalObj !== exp._obj) {
      return exp._obj
    }

    return subject
  }

  Commands.addAll({ type: 'assertion', prevSubject: true }, {
    should () {
      // Cast to `any` to pass all arguments
      // eslint-disable-next-line prefer-rest-params
      return shouldFn.apply(this, arguments as any)
    },

    and () {
      // Cast to `any` to pass all arguments
      // eslint-disable-next-line prefer-rest-params
      return shouldFn.apply(this, arguments as any)
    },
  })
}
