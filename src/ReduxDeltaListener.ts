import * as fs from 'fs'
import * as zlib from 'zlib'
import * as stream from 'stream'
import { TransformCallback } from 'stream'
import { WriteStream } from 'fs'
import { PatchListener } from 'immer'

export class ReduxDeltaListener {
  private jsonStream = new (class extends stream.Transform {
    _transform(chunk: any, _: BufferEncoding, callback: TransformCallback) {
      callback(undefined, JSON.stringify(chunk) + '\n')
    }
  })({ objectMode: true })
  private fileStream: WriteStream
  private compressionStream = zlib.createGzip()

  public static readonly defaultDumpFileName =
    new Date().toISOString().replace(/[^\d\w]/g, '-') + '.reduxdump.gz'

  constructor(filePath?: string) {
    this.fileStream = fs.createWriteStream(
      filePath || ReduxDeltaListener.defaultDumpFileName
    )
    this.jsonStream.pipe(this.compressionStream).pipe(this.fileStream)

    this.jsonStream.on('error', console.log)
    this.compressionStream.on('error', console.log)
    this.fileStream.on('error', console.log)

    process.on('beforeExit', () => {
      this.jsonStream.end()
    })
  }

  public createSliceListener(slicePath: string): PatchListener
  public createSliceListener(slicePath: string[]): PatchListener
  public createSliceListener(slicePath: string | string[]): PatchListener {
    const slicePathArray = Array.isArray(slicePath) ? slicePath : [slicePath]
    return patches => {
      patches
        .map(({ op, path, value }) => ({
          o: op,
          p: [...slicePathArray, ...path],
          v: value
        }))
        .forEach(patch => this.jsonStream.write(patch))
    }
  }

  public registerInitialState<T = unknown>(
    slicePath: string,
    initialState: T
  ): void
  public registerInitialState<T = unknown>(
    slicePath: string[],
    initialState: T
  ): void
  public registerInitialState<T = unknown>(
    slicePath: string | string[],
    initialState: T
  ): void {
    const slicePathArray = Array.isArray(slicePath) ? slicePath : [slicePath]
    //todo
    this.jsonStream.write({ o: 'add', p: slicePathArray, v: initialState })
  }
}
