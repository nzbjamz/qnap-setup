'use strict'

const fs = require('fs-extra')
const globby = require('globby')
const moment = require('moment')
const naturalCompare = require('string-natural-compare')
const path = require('path')
const pify = require('pify')

/*----------------------------------------------------------------------------*/

const isFile = async (p) => (await stat(p)).isFile()
const read = pify(fs.readFile)
const remove = pify(fs.remove)
const stat = pify(fs.stat)
const utimes = pify(fs.utimes)
const write = pify(fs.outputFile)

const glob = async (patterns, opts) => {
  patterns = Array.isArray(patterns) ? patterns : [patterns]
  const nodir = !patterns.some((p) => !p.startsWith('!') && p.endsWith('/'))

  opts = Object.assign({
    'nocase': true,
    'nodir': nodir,
    'noext': true,
    'realpath': true,
    'strict': true
  }, opts)

  const { nocase, nosort } = opts
  opts.nosort = true
  try {
    const result = await globby(patterns, opts)
    return nosort ? result : result.sort(nocase ? naturalCompare.i : naturalCompare)
  } catch (e) {}
  return []
}

const move = (() => {
  const _move = pify(fs.move)
  return async (source, dest, opts={}) => {
    source = path.resolve(source)
    dest = path.resolve(dest)
    if (source !== dest) {
      try {
        await _move(source, dest, opts)
      } catch (e) {
        if (e.code !== 'ENOENT') {
          throw e
        }
        await remove(source)
      }
    }
  }
})()

const poll = (func, opts={}) => {
  let { frequency=200, limit=1000 } = opts
  limit = moment().add(limit, 'ms')
  return new Promise((resolve) => {
    const poller = async () => {
      const result = await func()
      const timedOut = moment().isAfter(limit)
      if (result || timedOut) {
        resolve(!timedOut)
      } else {
        setTimeout(poller, frequency)
      }
    }
    poller()
  })
}

module.exports = {
  glob,
  isFile,
  move,
  poll,
  read,
  remove,
  stat,
  utimes,
  write
}
