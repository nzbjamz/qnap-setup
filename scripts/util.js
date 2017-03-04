'use strict'

const fs = require('fs-extra')
const globby = require('globby')
const path = require('path')
const pify = require('pify')

/*----------------------------------------------------------------------------*/

const isFile = async (p) => (await stat(p)).isFile()
const read = pify(fs.readFile)
const remove = pify(fs.remove)
const stat = pify(fs.stat)
const write = pify(fs.outputFile)

const glob = async (patterns, opts) => {
  patterns = Array.isArray(patterns) ? patterns : [patterns]
  const nodir = !patterns.some((p) => !p.startsWith('!') && p.endsWith('/'))
  try {
    return await globby(patterns, Object.assign({
      'nocase': true,
      'nodir': nodir,
      'noext': true,
      'realpath': true,
      'strict': true
    }, opts))
  } catch (e) {}
  return []
}

const move = (() => {
  const _move = pify(fs.move)
  return async (source, dest, opts={}) => {
    source = path.resolve(source)
    dest = path.resolve(dest)
    if (source !== dest) {
      return _move(source, dest, opts)
    }
  }
})()

module.exports = {
  glob,
  isFile,
  move,
  read,
  remove,
  stat,
  write
}
