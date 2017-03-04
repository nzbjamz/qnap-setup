#!/usr/bin/env node
'use strict'

const defaultsDeep = require('lodash/defaultsDeep')
const execa = require('execa')
const imdb = require('imdb-search')
const ini = require('ini')
const isPathInside = require('path-is-inside')
const moment = require('moment')
const path = require('path')
const subscrub = require('./subscrub.js')
const Subtitle = require('subtitle')
const tempWrite = require('temp-write')
const trash = require('trash')
const { glob, isFile, move, read, remove, stat, write } = require('./util.js')
const { argv } = require('yargs')
  .string('category')
  .array('force')
  .string('imdbid')
  .string('tmdbid')
  .string('tvdbid')
  .alias('c', 'category')
  .alias('f', 'force')
  .alias('imdb', 'imdbid')
  .alias('tmdb', 'tmdbid')
  .alias('tv', 'tvdbid')

const FFMPEG_PATH = '/opt/bin/ffmpeg'
const FFPROBE_PATH = '/opt/bin/ffprobe'

const CONFIG_PATH = path.join(__dirname, 'autoProcess.ini')
const COUCH_LIBRARY_PATH = '/share/CACHEDEV1_DATA/Multimedia/Movies'
const SONARR_LIBRARY_PATH = '/share/CACHEDEV1_DATA/Multimedia/TV'
const WATCH_PATH = '/share/CACHEDEV1_DATA/Download/complete'

const MANUAL_RUN = argv._.length !== 7
const MANUAL_SCRIPT_PATH = '/share/CACHEDEV1_DATA/scripts/manual.py'
const SAB_SCRIPT_PATH = '/share/CACHEDEV1_DATA/scripts/SABPostProcess.py'

const GLOB_ALL = '**/*'
const GLOB_MP4 = '**/*.{mp4,m4v}'
const GLOB_SRT = '**/*.srt'
const GLOB_VIDEO = '**/*.{avi,mkv,mov,mp4,mpg,mts,ts,vob}'

const langMap = new Map(Object.entries({
  'eng': 'en',
  'und': 'en'
}))

const rankMap = new Map(Object.entries({
  'mono': 1,
  'stereo': 2,
  'downmix': 3,
  '2.1': 4,
  '3.0(back)': 5,
  '3.0': 6,
  '3.1': 7,
  'quad(side)': 8,
  'quad': 9,
  '4.0': 10,
  '4.1': 11,
  '5.0(side)': 12,
  '5.0': 13,
  '5.1(side)': 14,
  '5.1': 15,
  'hexagonal': 16,
  '6.0(front)':  17,
  '6.0': 18,
  '6.1(back)': 19,
  '6.1(front)': 20,
  '6.1': 21,
  '7.0(front)': 22,
  '7.0': 23,
  'octagonal': 24,
  '7.1(wide-side)': 25,
  '7.1(wide)': 26,
  '7.1': 27,
  'hexadecagonal': 28
}))

/*----------------------------------------------------------------------------*/

const execQuiet = (file, args) => (
  execa(file, args, { 'stdio': 'ignore' })
)

const ffmpeg = (filepath, args) => {
  const params = ['-loglevel', 'quiet', '-y', '-i', filepath, ...args]
  return execQuiet(FFMPEG_PATH, params)
}

const ffprobe = async (filepath) => {
  try {
    const params = ['-loglevel', 'quiet', '-print_format', 'json', '-show_streams', filepath]
    const { stdout } = await execa(FFPROBE_PATH, params)
    return JSON.parse(stdout).streams
  } catch (e) {}
  return []
}

/*----------------------------------------------------------------------------*/

const cloneDeep = (object) => (
  JSON.parse(JSON.stringify(object))
)

const delay = (func, wait) => (
  new Promise((resolve) => setTimeout(() => resolve(func()), wait))
)

const firstOfCodec = (streams, codec) => (
  streams.find(({ codec_name }) => codec_name === codec)
)

const getAudioStreams = (streams) => (
  streams
    .filter(({ codec_type }) => codec_type === 'audio')
    .map((aud, index) => Object.assign(cloneDeep(aud), { index, 'rank': getRank(aud) }))
)

const getDefaultStream = (streams) => (
  streams.find(({ disposition }) => disposition.default)
)

const getStereoStreams = (streams) => (
  streams.filter(({ channel_layout }) => channel_layout === 'stereo')
)

const getSubStreams = (streams) => (
  streams
    .filter(({ codec_type }) => codec_type === 'subtitle')
    .map((sub, index) => Object.assign(cloneDeep(sub), { index, 'lang': getLang(sub) }))
)

const getVideoStreams = (streams) => (
  streams
    .filter(({ codec_type }) => codec_type === 'video')
    .map((vid, index) => Object.assign(cloneDeep(vid), { index }))
)

const getChannelLayout = ({ channel_layout }) => (
  channel_layout.split('(')[0]
)

const getLang = (sub) => {
  let language = (sub.tags && sub.tags.language) || 'und'
  language = language.split('-')[0]
  return langMap.get(language) || language
}

const getRank = ({ channel_layout }) => (
  rankMap.get(channel_layout) || 0
)

/*----------------------------------------------------------------------------*/

const getCategory = (inpath) => {
  const { category } = argv
  if (category) {
    return category
  }
  inpath = path.resolve(inpath)
  const lowerpath = inpath.toLowerCase()
  if (/\b(?:season \d+|s\d+e\d+)\b/.test(lowerpath) ||
      lowerpath.split(path.sep).includes('tv')) {
    return 'tv'
  }
  return 'movies'
}

const getImdbId = async (inpath) => {
  const { imdbid } = argv
  if (imdbid) {
    return imdbid
  }
  inpath = path.resolve(inpath)
  const extracted = /\btt\d{7,}\b/.exec(inpath)
  if (extracted) {
    return extracted[0]
  }
  const filepaths = await isFile(inpath)
    ? [inpath]
    : await glob(GLOB_VIDEO, { 'cwd': inpath })

  if (filepaths.length) {
    const filepath = filepaths[0]
    const basename = path.basename(filepath, path.extname(filepath))
    const parts = /^(.+?)(?:, *(the|an?)\b)?(?: *\((\d+)\))?(?: *cd(\d+))?$/i.exec(basename)
    const the = parts[2]
    const title = (the ? the + ' ' : '') + parts[1]
    const type = getCategory(filepath) === 'movies' ? 'movie' : 'episode'
    const year = parts[3]
    try {
      return (await imdb.search(title, year, type))[0].imdb
    } catch (e) {}
  }
  return ''
}

const getTmdbid = async (inpath) => (
  argv.tmdbid
)

const getTvdbid = async (inpath) => (
  argv.tvdbid
)

/*----------------------------------------------------------------------------*/

const extractSubs = async (file, sublang) => {
  const { filepath, streams } = file
  const basename = path.basename(filepath, path.extname(filepath))
  const dirname = path.dirname(filepath)
  const subs = getSubStreams(streams)
  const seen = new Map

  const maps = subs.reduce((maps, sub) => {
    const { disposition, lang } = sub
    if (disposition.default || sublang == null || lang === sublang) {
      const labels = Object.keys(disposition).filter((key) => key !== 'default' && disposition[key])
      const subname = [basename, lang, ...labels, 'srt'].join('.')
      if (!seen.has(subname)) {
        const subpath = path.join(dirname, subname)
        seen.set(subname, subpath)
        maps.push('-map', `0:s:${ sub.index }`, subpath)
      }
    }
    return maps
  }, [])

  try {
    if (maps.length) {
      await ffmpeg(filepath, ['-vn', '-an', '-scodec', 'srt', ...maps])
    }
  } catch (e) {
    for (const subpath of seen.values()) {
      await remove(subpath)
    }
    throw e
  }
}

const transcode = async (filepath, args, opts) => {
  const streams = await ffprobe(filepath)
  const auds = getAudioStreams(streams)
  const flac = firstOfCodec(auds, 'flac')
  const config = defaultsDeep({}, opts, ini.parse(await read(CONFIG_PATH, 'utf8')))
  if (flac) {
    config.MP4['video-codec'] = 'h264,x264'
    config.MP4.ffmpeg = FFMPEG_PATH
  }
  const temppath = await tempWrite(ini.stringify(config))
  const params = ['--auto', '--convertmp4', '--config', temppath, '--input', filepath, ...args]
  const spawned = execa(MANUAL_SCRIPT_PATH, params, { 'reject': true })
  const process = Object.assign(new Promise((resolve) => {
    spawned
      .then((result) => {
        const errmsg = 'Error converting file, FFMPEG error.'
        const { stdout } = result
        if (stdout.includes(errmsg)) {
          throw new Error(errmsg)
        }
        // Remove progress indicator.
        result.stdout = stdout.replace(/\r\[#* *\] \d+%/g, '')
        resolve(result)
      })
      .catch(async (e) => {
        if (config.MP4.ffmpeg === FFMPEG_PATH) {
          throw e
        }
        config.MP4.ffmpeg = FFMPEG_PATH
        config.MP4['video-codec'] = 'h264,x264'
        const { process: respawned } = await transcode(filepath, args, config)
        respawned.stdout.pipe(spawned.stdout)
        respawned.stderr.pipe(spawned.stderr)
        respawned.then(resolve)
      })
  }), spawned)

  return { process }
}

/*----------------------------------------------------------------------------*/

const getVideosToTranscode = async (inpath, force) => {
  inpath = path.resolve(inpath)
  const filepaths = await isFile(inpath)
    ? [inpath]
    : await glob(GLOB_VIDEO, { 'cwd': inpath })

  const result = []
  for (const filepath of filepaths) {
    const ext = path.extname(filepath).toLowerCase()
    const streams = await ffprobe(filepath)
    const auds = getAudioStreams(streams)
    const subs = getSubStreams(streams)
    const stereos = getStereoStreams(auds)
    const aac = firstOfCodec(stereos, 'aac')

    if (force || !(ext === '.mp4' && aac && !subs.length && auds.length < 3)) {
      result.push({ filepath, streams })
    }
  }
  return result
}

const extractSubsFromVideos = async (files) => {
  for (const file of files) {
    try {
      await extractSubs(file, 'en')
    } catch (e) {
      const { filepath } = file
      const basename = path.basename(filepath)
      console.log(`Failed to extract subtitles from ${ basename }.`)
    }
  }
}

const transcodeVideos = async (files) => {
  for (const { filepath } of files) {
    const { process: spawned } = await transcode(filepath, ['--notag'], {
      'MP4': { 'ios-audio': 'True', 'relocate_moov': 'False' }
    })
    if (MANUAL_RUN) {
      spawned.stdout.pipe(process.stdout)
    }
    try {
      const { stdout } = await spawned
      if (!MANUAL_RUN) {
        console.log(stdout)
      }
    } catch (e) {
      const basename = path.basename(filepath)
      console.log(`Failed to transcode ${ basename }.`)
    }
  }
}

const removeEmbeddedSubsFromVideos = async (inpath) => {
  inpath = path.resolve(inpath)
  const filepaths = await isFile(inpath)
    ? [inpath]
    : await glob(GLOB_MP4, { 'cwd': inpath })

  for (const filepath of filepaths) {
    const basename = path.basename(filepath)
    const dirname = path.dirname(filepath)
    const bakpath = path.join(dirname, `${ basename }.original`)

    // Stable sort audio streams from highest to lowest ranked.
    const streams = await ffprobe(filepath)
    const auds = getAudioStreams(streams)
      .sort((a, b) => a.rank > b.rank ? -1 : (a.rank < b.rank ? 1 : (a.index - b.index)))

    const stereos = getStereoStreams(auds)
    const first = firstOfCodec(stereos, 'aac') || getDefaultStream(auds) || stereos[0]

    const layout = getChannelLayout(first)
    const second = auds.find((aud) => getChannelLayout(aud) !== layout)

    const maps = []
    if (first) {
      maps.push('-map', `0:a:${ first.index }`)
    }
    if (second) {
      maps.push('-map', `0:a:${ second.index }`, `-codec:a:${ second.index }`, 'ac3')
    }
    if (!maps.length) {
      maps.push('-map', '0:a')
    }
    await move(filepath, bakpath)

    try {
      const args = ['-codec', 'copy', '-sn', '-map_chapters', '-1', '-map', '0:v', ...maps, filepath]
      await ffmpeg(bakpath, args)
      await remove(bakpath)
    } catch (e) {
      console.log(`Failed to remove subtitles from ${ basename }.`)
      await move(bakpath, filepath)
    }
  }
}

/*----------------------------------------------------------------------------*/

const getVideosToTag = async (inpath, force) => {
  inpath = path.resolve(inpath)
  const filepaths = await isFile(inpath)
    ? [inpath]
    : await glob(GLOB_MP4, { 'cwd': inpath })

  const result = []
  for (const filepath of filepaths) {
    const streams = await ffprobe(filepath)
    const vids = getVideoStreams(streams)
    const mjpeg = firstOfCodec(vids, 'mjpeg')

    if (force || !mjpeg) {
      result.push({ filepath, streams })
    }
  }
  return result
}

const tagVideos = async (files) => {
  for (const { filepath } of files) {
    const args = []
    const imdbid = await getImdbId(filepath)
    if (imdbid) {
      args.push('--imdbid', imdbid)
    }
    const tmdbid = await getTmdbid(filepath)
    if (tmdbid) {
        args.push('--tmdbid', tmdbid)
    }
    const tvdbid = await getTvdbid(filepath)
    if (tvdbid) {
      args.push('--tvdbid', tvdbid)
    }
    const { process: spawned } = await transcode(filepath, args)
    if (MANUAL_RUN) {
      spawned.stdout.pipe(process.stdout)
    }
    try {
      const { stdout } = await spawned
      if (!MANUAL_RUN) {
        console.log(stdout)
      }
    } catch (e) {
      const basename = path.basename(filepath)
      console.log(`Failed to tag ${ basename }.`)
    }
  }
}

/*----------------------------------------------------------------------------*/

const getSubsToRename = async (inpath) => {
  inpath = path.resolve(inpath)
  const cwd = await isFile(inpath) ? path.dirname(inpath) : inpath
  const filepaths = await glob(GLOB_SRT, { cwd })
  const result = []
  for (const filepath of filepaths) {
    const captions = new Subtitle
    try {
      captions.parse(await read(filepath, 'utf8'))
      result.push({ filepath, captions })
    } catch (e) {}
  }
  return result
}

const renameVideos = async (inpath, outpath) => {
  inpath = path.resolve(inpath)
  outpath = path.resolve(outpath)
  await move(inpath, outpath)

  const args = argv._.slice()
  args[0] = outpath
  if (MANUAL_RUN) {
    args.length = 7
    // The name of the job name without path or file extension.
    args[2] = await isFile(inpath) ? path.basename(path.dirname(inpath)) : path.basename(inpath)
    // The name of the NZB file used by SABPostProcess.py to detect a "Manual Run".
    args[1] = `${ args[2] }.nzb`
    // The indexer's report number (not used by SABPostProcess.py).
    args[3] = 0
    // The user-defined category used to signal which manager is notified.
    args[4] = getCategory(inpath)
    // The group the NZB was posted in (not used by SABPostProcess.py).
    args[5] = ''
    // The status of post processing (0 = OK, 1=failed verification, 2=failed unpack, 3=1+2).
    args[6] = 0
  }
  try {
    // Since `SABNZBD` is configured with `convert = False`
    // invoking SABPostProcess.py will simply start a renamer scan.
    const spawned = execa(SAB_SCRIPT_PATH, args)
    spawned.stdout.pipe(process.stdout)
    await spawned
  } catch (e) {
    console.log('Failed to start renamer scan.')
    await move(outpath, inpath)
    return false
  }
  return true
}

const getNewestVideo = async (inpath) => {
  const filepaths = await glob(GLOB_MP4, { 'cwd': inpath, 'nosort': true })
  const objs = []
  for (const filepath of filepaths) {
    objs.push({ 'value': filepath, 'time': (await stat(filepath)).mtime })
  }
  // Sort from newest to oldest.
  return objs
    .sort((a, b) => b.time - a.time)
    .map(({ value }) => value)[0]
}

const restoreSubs = async (inpath, subs) => {
  inpath = path.resolve(inpath)
  const basename = path.basename(inpath, path.extname(inpath))
  const dirname = path.dirname(inpath)
  for (const { filepath, captions } of subs) {
    const ext = /\.en\.(?:\w+\.)*?srt$/.exec(path.basename(filepath))[0]
    await write(path.join(dirname, basename + ext), captions.stringify())
  }
}

const cleanupFolder = async (inpath) => {
  const filepaths = await glob([GLOB_ALL, `!${ GLOB_VIDEO }`], { 'cwd': inpath })
  for (let filepath of filepaths) {
    const basename = path.basename(filepath)
    const dirname = path.dirname(filepath)
    const ext = path.extname(filepath).toLowerCase()
    if (ext === '.srt') {
      const parts = basename.split('.')
      if (parts[1] !== 'en') {
        // Add "en" language code to subtitle name.
        parts.splice(1, 0, 'en')
        const repath = path.join(dirname, parts.join('.'))
        await move(filepath, repath, { 'overwrite': true })
        filepath = repath
      }
      await subscrub(filepath)
    }
    else {
      console.log(`Trashing ${ basename }.`)
      await trash(filepath)
    }
  }
}

/*----------------------------------------------------------------------------*/

(async () => {
  const inpath = path.resolve(argv._[0] || process.cwd())
  const basename = path.basename(inpath)

  console.log(`Processing ${ basename }.`)

  let { force=[], imdbid, tmdbid, tvdbid } = argv
  force = new Set(force.map((value) => value.toLowerCase()))
  if (imdbid || tmdbid || tvdbid) {
    force.add('tag')
  }
  const vidsToTranscode = await getVideosToTranscode(inpath, force.has('transcode'))
  if (vidsToTranscode.length) {
    console.log('Extracting subtitles.')
    await extractSubsFromVideos(vidsToTranscode)

    console.log('Transcoding videos.')
    await transcodeVideos(vidsToTranscode)

    console.log('Removing embedded subtitles.')
    await removeEmbeddedSubsFromVideos(inpath)
  }
  const vidsToTag = await getVideosToTag(inpath, force.has('tag'))
  if (vidsToTag.length) {
    console.log('Adding metadata.')
    await tagVideos(vidsToTag)
  }
  const category = getCategory(inpath)
  const libpath = category === 'movies' ? COUCH_LIBRARY_PATH : SONARR_LIBRARY_PATH
  if (!isPathInside(inpath, libpath)) {
    const foldername = path.basename(await isFile(inpath) ? path.dirname(inpath) : inpath)
    const manager = category === 'movies' ? 'CouchPotato' : 'Sonarr'
    const outpath = path.join(WATCH_PATH, category, foldername)

    console.log(`Starting ${ manager } renamer scan.`)
    const subs = await getSubsToRename(inpath)
    if (await renameVideos(inpath, outpath)) {
      const filepath = await delay(() => getNewestVideo(libpath), 1000 * 60 * 2.5)
      if (filepath) {
        const end = moment()
        const start = moment(end).subtract(5, 'minutes')
        const { mtime } = await stat(filepath)
        if (moment(mtime).isBetween(start, end, null, '[]')) {
          if (category === 'tv') {
            await restoreSubs(filepath, subs)
          }
          await cleanupFolder(path.dirname(filepath))
        }
      } else {
        console.log('Unable to cleanup renamed files.')
      }
    }
  }
  console.log('Completed.')
})()
