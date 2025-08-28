import Debug from 'debug'
import { Transform } from 'stream'
import type { ChildProcess } from 'child_process'
import { StringDecoder } from 'string_decoder'

export function trace (process: ChildProcess, chunk: any) {
  const debug = Debug(`cypress-verbose:stderr-filtering:trace:${process.pid}`)

  const strDecoder = new StringDecoder()

  return new Transform({
    transform (chunk, encoding, callback) {
      debug(strDecoder.write(chunk))
      callback(null, chunk)
    },
  })
}
