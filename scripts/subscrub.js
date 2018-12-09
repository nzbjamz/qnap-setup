#!/usr/bin/env node
'use strict'

const path = require('path')
const Subtitle = require('subtitle')
const { glob, isFile, read, remove, write } = require('./util.js')
const { argv } = require('yargs')

const SEARCH_LIMIT = 25

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

const isBogus = (sub) => {
  if (sub == null) {
    return false
  }
  const { text } = sub
  return reAddress.test(text) || reContact.test(text) || reKeywords.test(text) || reProviders.test(text)
}

const subscrub = async (inpath) => {
  const filepaths = await isFile(inpath)
    ? [path.resolve(inpath)]
    : await glob(['**/*.srt'], { 'cwd': inpath })

  await Promise.all(filepaths.map(async (filepath) => {
    const basename = path.basename(filepath)
    const captions = new Subtitle

    try {
      captions.parse(await read(filepath, 'utf8'))
    } catch (e) {
      console.log(`Failed to parse ${ basename }.`)
      return
    }

    let { _subtitles } = captions

    const originalLength = _subtitles.length

    // Remove empty captions.
    const empties = []
    _subtitles = _subtitles.filter((sub) => sub.text || void empties.push(sub))

    // Remove bogus captions.
    const upTo = Math.min(_subtitles.length, SEARCH_LIMIT)
    const removed = []

    let i = -1

    while (++i <= upTo) {
      if (isBogus(_subtitles[i])) {
        removed.push(..._subtitles.splice(i, 1))
      }
    }

    i = _subtitles.length

    const backTo = Math.max(0, i - SEARCH_LIMIT)

    while (--i >= backTo) {
      if (isBogus(_subtitles[i])) {
        removed.push(..._subtitles.splice(i, 1))
      }
    }

    // Commit changes.
    if (_subtitles.length !== originalLength) {
      console.log(`Scrubbing ${ basename }.`)
      if (empties.length) {
        console.log('Removing empty captions.')
      }
      removed.forEach(({ text }) => {
        text = text.replace(/\n/g, ' ')
        console.log(`Removing caption:\n${ text }`)
      })
      if (_subtitles.length) {
        // Reindex captions.
        _subtitles.forEach((sub, index) => sub.index = index + 1)
        captions._subtitles = _subtitles
        await write(filepath, captions.stringify())
      } else {
        console.log(`Removing empty ${ basename }.`)
        await remove(filepath)
      }
    }
  }))
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
