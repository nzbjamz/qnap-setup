#!/usr/bin/env node
'use strict'

const fs = require('fs-extra')
const globby = require('globby')
const path = require('path')
const pify = require('pify')
const Subtitle = require('subtitle')
const { argv } = require('yargs')

const isFile = async (p) => (await stat(p)).isFile()
const binary = (func) => (a, b) => func(a, b)
const unary = (func) => (a) => func(a)

const read = binary(pify(fs.readFile))
const remove = unary(pify(fs.remove))
const stat = unary(pify(fs.stat))
const write = binary(pify(fs.outputFile))

const reAddress = /[-\w]+\.(?:com|org|net)\b/i
const reContact = /[-\w]+\[[-\w]+\][-\w]+/

const reKeywords = RegExp('\\b(?:' + [
  'captioned',
  'captioning',
  'captions',
  'downloaded',
  'edit',
  'edited',
  'encoded',
  'fix',
  'review',
  'reviewed',
  'ripp',
  'sub',
  'subs',
  'subtitle',
  'subtitles',
  'sync',
  'synced',
  'synchronization',
  'synchronized',
  'translated',
  'translation'
].join('|') +
')\\b', 'i')

const reProviders = RegExp('\\b(?:' + [
  'addic7ed',
  'opensubtitles',
  'podnapisi',
  'subscene',
  'tvsubtitles'
].join('|') +
')\\b', 'i')

/*----------------------------------------------------------------------------*/

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

const isBogus = (text='') => (
  reAddress.test(text) || reContact.test(text) || reKeywords.test(text) || reProviders.test(text)
)

/*----------------------------------------------------------------------------*/

const subscrub = async (inpath) => {
  const filepaths = await isFile(inpath)
    ? [inpath]
    : await glob('**/*.srt', { 'cwd': inpath })

  for (const filepath of filepaths) {
    const basename = path.basename(filepath)
    const captions = new Subtitle

    try {
      captions.parse(await read(filepath, 'utf8'))
    } catch (e) {
      console.log(`Failed to parse ${ basename }.`)
      continue
    }
    let { _subtitles } = captions
    const { length } = _subtitles

    // Remove empty entries.
    _subtitles = _subtitles.filter(({ text }) => text)

    const first = _subtitles[0]
    if (first && isBogus(first.text)) {
      _subtitles.shift()
    }
    const last = _subtitles[_subtitles.length - 1]
    if (last && isBogus(last.text)) {
      _subtitles.pop()
    }
    if (!_subtitles.length) {
      console.log(`Removing empty ${ basename }.`)
      await remove(filepath)
    }
    else if (_subtitles.length !== length) {
      // Reindex entries.
      _subtitles.forEach((sub, index) => sub.index = index + 1)
      captions._subtitles = _subtitles

      console.log(`Scrubbing ${ basename }.`)
      await write(filepath, captions.stringify())
    }
  }
}

/*----------------------------------------------------------------------------*/

(async () => {
  if (require.main === module) {
    const inpath = path.resolve(argv._[0] || process.cwd())
    const basename = path.basename(inpath)
    console.log(`Processing ${ basename }.`)
    await subscrub(inpath)
  }
})()

module.exports = subscrub
