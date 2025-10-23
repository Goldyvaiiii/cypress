export type Memoized<T> = T & {
  __memo: true
}

export function isMemoized (subject: any): subject is Memoized<HTMLElement> {
  return subject && subject.__memo
}

export function memoize <T extends object> (
  obj: T,
  ttl: number = 100,
): Memoized<T> {
  const memoStore = new Map<{ value, args }, {
    result: any
    timestamp: Date
  }>()

  function memoFn (receiver, fn: Function, args: any[]) {
    const memo = memoStore.get({ value: fn, args })

    if (memo && memo.timestamp.getTime() + ttl > Date.now()) {
      return memo.result
    }

    const result = fn.call(receiver, ...args)

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

      if (typeof value === 'function') {
        return function (...args: Parameters<typeof value>) {
          return memoFn(this === receiver ? target : this, value, args)
        }
      }

      if (prop in target) {
        return memoProp(prop as keyof T)
      }

      return Reflect.get(target, prop, receiver)
    },
  }) as Memoized<T>
}
