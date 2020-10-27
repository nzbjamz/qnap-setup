'use strict'

const fs = require('fs-extra')
const get = require('lodash/get')
const globby = require('globby')
const moment = require('moment')
const naturalCompare = require('string-natural-compare')
const path = require('path')

/*----------------------------------------------------------------------------*/

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
    if (nosort) {
      return result
    }
    return result.sort(nocase ? naturalCompare.i : naturalCompare)
  } catch {}
  return []
}

const isFile = async (filepath) => {
  try {
    return (await fs.stat(filepath)).isFile()
  } catch {}
  return false
}

const move = (() => {
  const { move: _move } = fs
  return async (source, dest, opts={}) => {
    source = path.resolve(source)
    dest = path.resolve(dest)
    if (source !== dest) {
      opts = Object.assign({ 'overwrite': true }, opts)
      try {
        await _move(source, dest, opts)
      } catch (e) {
        if (get(e, 'code') !== 'ENOENT') {
          throw e
        }
        await fs.remove(source)
      }
    }
  }
})()

const poll = (func, opts={}) => {
  let { frequency=200, limit=1000 } = opts
  limit = moment().add(limit, 'ms')
  return new Promise((resolve) => {
    const poller = async () => {
      let ended = false
      await func(() => {
        ended = true
      })
      const timedOut = moment().isAfter(limit)
      if (ended || timedOut) {
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
  poll
}
