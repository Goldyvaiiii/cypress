export type Memoized<T> = T & {
  __memo: true
}

export function isMemoized (subject: any): subject is Memoized<HTMLElement> {
  return subject && subject.__memo
}

export function memoize <T extends object> (
  obj: T,
  props: (keyof T)[],
  ttl: number = 100,
): Memoized<T> {
  const memoStore = new Map<{ value, args }, {
    result: any
    timestamp: Date
  }>()

  function memoFn (fn: Function, receiver, args: any[]) {
    const memo = memoStore.get({ value: fn, args })

    if (memo && memo.timestamp.getTime() + ttl > Date.now()) {
      return memo.result
    }

    const result = fn.apply(receiver, args)

    memoStore.set({ value: fn, args }, { result, timestamp: new Date() })

    return result
  }

  function memoProp (prop: keyof T) {
    const memo = memoStore.get({ value: obj[prop], args: [] })

    if (memo) {
      return memo.result
    }

    const result = obj[prop]

    memoStore.set({ value: obj[prop], args: [] }, { result, timestamp: new Date() })

    return result
  }

  return new Proxy(obj, {
    get (target, prop, receiver) {
      const value = target[prop]

      if (value === '__memo') {
        return true
      }

      if (props.includes(prop as keyof T)) {
        if (value instanceof Function) {
          return function (...args: Parameters<typeof value>) {
            return memoFn(value, receiver, args)
          }
        }

        if (target.hasOwnProperty(prop)) {
          return memoProp(prop as keyof T)
        }
      }

      return target[prop]
    },
  }) as Memoized<T>
}
