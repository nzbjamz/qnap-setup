'use strict'

const fs = require('fs-extra')
const globby = require('globby')
const path = require('path')
const pify = require('pify')

/*----------------------------------------------------------------------------*/

const binary = (func) => (a, b) => func(a, b)
const unary = (func) => (a) => func(a)

const isFile = async (p) => (await stat(p)).isFile()
const read = binary(pify(fs.readFile))
const remove = unary(pify(fs.remove))
const stat = unary(pify(fs.stat))
const write = binary(pify(fs.outputFile))

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
  return async (source, dest) => {
    if (source !== dest && path.resolve(source) !== path.resolve(dest)) {
      return _move(source, dest)
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
