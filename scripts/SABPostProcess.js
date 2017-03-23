#!/usr/bin/env node
'use strict'

const defaultsDeep = require('lodash/defaultsDeep')
const execa = require('execa')
const imdb = require('imdb-search')
const ini = require('ini')
const isPathInside = require('path-is-inside')
const moment = require('moment')
const naturalCompare = require('string-natural-compare')
const path = require('path')
const subscrub = require('./subscrub.js')
const Subtitle = require('subtitle')
const tempWrite = require('temp-write')
const trash = require('trash')
const { xml2js } = require('xml-js')
const { exists, glob, isFile, move, poll, read, remove, stat, write } = require('./util.js')

const xml = {
  'parse': (xml) => xml2js(xml, {
    'compact': true,
    'textKey': 'text',
    'trim': true
  })
}

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

const FFMPEG_ERROR = 'Error converting file, FFMPEG error.'
const FFMPEG_PATH = '/opt/bin/ffmpeg'
const FFPROBE_PATH = '/opt/bin/ffprobe'

const BASE_PATH = '/share/CACHEDEV1_DATA'
const COMPLETE_ROOT = path.join(BASE_PATH, 'Download/complete')
const MULTIMEDIA_ROOT = path.join(BASE_PATH, 'Multimedia')
const SCRIPTS_ROOT = path.join(BASE_PATH, 'scripts')

const COUCH_CONFIG_PATH = path.join(BASE_PATH, 'COUCH_CONFIG/setting.conf')
const COUCH_LIBRARY_ROOT = path.join(MULTIMEDIA_ROOT, 'Movies')
const COUCH_SCAN_ROOT = path.join(COMPLETE_ROOT, 'movies')

const SONARR_CONFIG_PATH = path.join(BASE_PATH, 'SONARR_CONFIG/config.xml')
const SONARR_LIBRARY_ROOT = path.join(MULTIMEDIA_ROOT, 'TV')
const SONARR_SCAN_ROOT = path.join(COMPLETE_ROOT, 'tv')

const CONFIG_PATH = path.join(__dirname, 'autoProcess.ini')
const MANUAL_SCRIPT_PATH = path.join(SCRIPTS_ROOT, 'manual.py')
const SAB_SCRIPT_PATH = path.join(SCRIPTS_ROOT, 'SABPostProcess.py')

const MANUAL_RUN = argv._.length !== 7

const GLOB_ALL = '**/*'
const GLOB_IGNORE = '**/*.ignore'
const GLOB_MP4 = '**/*.{mp4,m4v}'
const GLOB_SRT = '**/*.srt'
const GLOB_VIDEO = '**/*.{avi,mkv,mov,mp4,mpg,mts,ts,vob}'

const reSrtEnLang = /\.eng?\.(?:\w+\.)*?srt$/i
const reTv = /^tv$/i
const reTvSeason = /\bseason \d+\b/i
const reTvSeasonEpisode = /\bs\d+e\d+\b/i

const dispositionMap = new Map(Object.entries({
  'forced': 'forced',
  'hearing_impaired': 'hi'
}))

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

const cloneDeep = (object) => (
  JSON.parse(JSON.stringify(object))
)

const getCategory = (inpath) => (
  argv.category || (isTv(inpath) ? 'tv' : 'movies')
)

const getCouchKey = async () => (
  ini.parse(await read(COUCH_CONFIG_PATH, 'utf8')).core.api_key
)

const getImdbId = async (inpath) => {
  const { imdbid } = argv
  if (imdbid) {
    return imdbid
  }
  inpath = path.resolve(inpath)
  const { 0:pathid } = /\btt\d{7,}\b/i.exec(inpath) || ['']
  if (pathid) {
    return pathid
  }
  const filepaths = await isFile(inpath)
    ? [inpath]
    : await glob([GLOB_VIDEO], { 'cwd': inpath })

  for (const filepath of filepaths) {
    const basename = path.basename(filepath, path.extname(filepath))
    const parts = /^(.+?)(?:, *(the|an?)\b)?(?: *\((\d+)\))?(?: *cd(\d+))?$/i.exec(basename) || [, basename]
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

const getSonarrKey = async () => (
  xml.parse(await read(SONARR_CONFIG_PATH, 'utf8')).Config.ApiKey.text
)

const getTmdbid = async (inpath) => (
  argv.tmdbid || ''
)

const getTvdbid = async (inpath) => (
  argv.tvdbid || ''
)

const isTv = (filepath) => (
  path.resolve(filepath).split(path.sep).some((p) => (
    reTv.test(p) || reTvSeason.test(p) || reTvSeasonEpisode.test(p)
  ))
)

const toConfigPath = (config) => (
  tempWrite(ini.stringify(config))
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
      const labels = Object
        .keys(disposition)
        .filter((key) => disposition[key])
        .map((key) => dispositionMap.get(key))
        .filter((key) => key)

      const subname = [basename, lang, ...labels, 'srt'].join('.')
      if (!seen.has(subname)) {
        const subpath = path.join(dirname, subname)
        seen.set(subname, subpath)
        maps.push('-map', `0:s:${ sub.index }`, subpath)
      }
    }
    return maps
  }, [])

  if (!maps.length) {
    return
  }
  try {
    await ffmpeg(filepath, ['-vn', '-an', '-scodec', 'srt', ...maps])
  } catch (e) {
    await Promise.all([...seen.values()].map((subpath) => remove(subpath)))
    throw e
  }
}

const transcode = async (filepath, args, opts) => {
  const config = defaultsDeep({}, opts, ini.parse(await read(CONFIG_PATH, 'utf8')))
  const params = ['--auto', '--convertmp4', '--config', await toConfigPath(config), '--input', filepath, ...args]
  const spawned = execa(MANUAL_SCRIPT_PATH, params)
  const promise = new Promise((resolve, reject) => {
    spawned
      .then((result) => {
        // Remove progress indicator.
        result.stdout = result.stdout.replace(/\r\[#* *\] \d+%/g, '')
        resolve(result)
      })
      .catch(reject)
  })

  spawned.then = promise.then.bind(promise)
  spawned.catch = promise.catch.bind(promise)
  return { 'process': spawned }
}

/*----------------------------------------------------------------------------*/

const getVideosToTranscode = async (inpath, force) => {
  const filepaths = await isFile(inpath)
    ? [path.resolve(inpath)]
    : await glob([GLOB_VIDEO], { 'cwd': inpath })

  const config = ini.parse(await read(CONFIG_PATH, 'utf8'))
  const maxBitrate = config.MP4['video-bitrate'] || 0
  const maxLevel = config.MP4['h264-max-level'] || 0

  const result = []
  await Promise.all(filepaths.map(async (filepath) => {
    const ext = path.extname(filepath).toLowerCase()
    const streams = await ffprobe(filepath)
    const auds = getAudioStreams(streams)
    const vids = getVideoStreams(streams)
    const subs = getSubStreams(streams)
    const stereos = getStereoStreams(auds)
    const aac = firstOfCodec(stereos, 'aac')
    const h264 = firstOfCodec(vids, 'h264')

    let bitrate = NaN
    let level = NaN
    if (h264) {
      bitrate = Math.max(+h264.bit_rate || 0, +h264.max_bit_rate || 0) / 1e3
      level = h264.level / 10
    }
    if (force || !(ext === '.mp4' && aac && h264 && bitrate <= maxBitrate && level <= maxLevel && auds.length < 3 && !subs.length)) {
      result.push({ filepath, streams })
    }
  }))
  return result
}

const extractSubsFromVideos = async (files) => {
  await Promise.all(files.map(async (file) => {
    try {
      await extractSubs(file, 'en')
    } catch (e) {
      const basename = path.basename(file.filepath)
      console.log(`Failed to extract subtitles from ${ basename }.`)
    }
  }))
}

const transcodeVideo = async (filepath, opts={}) => {
  try {
    const { process: spawned } = await transcode(filepath, ['--notag'], opts)
    if (MANUAL_RUN) {
      spawned.stdout.pipe(process.stdout)
    }
    const { stdout } = await spawned
    if (stdout.includes(FFMPEG_ERROR)) {
      throw new Error
    }
    if (!MANUAL_RUN) {
      console.log(stdout)
    }
  } catch (e) {
    if (opts.MP4.ffmpeg === FFMPEG_PATH) {
      const basename = path.basename(filepath)
      console.log(`Failed to transcode ${ basename }.`)
      return
    }
    // Fallback to non-VAAPI accelerated ffmpeg.
    opts.MP4.ffmpeg = FFMPEG_PATH
    opts.MP4['video-codec'] = 'h264,x264'
    await transcodeVideo(filepath, opts)
  }
}

const transcodeVideos = async (files) => {
  for (const { filepath } of files) {
    const streams = await ffprobe(filepath)
    const auds = getAudioStreams(streams)
    const flac = firstOfCodec(auds, 'flac')
    const opts = { 'MP4': { 'ios-audio': 'True', 'relocate_moov': 'False' } }
    if (flac) {
      opts.MP4['video-codec'] = 'h264,x264'
      opts.MP4.ffmpeg = FFMPEG_PATH
    }
    await transcodeVideo(filepath, opts)
  }
}

const postProcessVideos = async (inpath) => {
  const filepaths = await isFile(inpath)
    ? [path.resolve(inpath)]
    : await glob([GLOB_MP4], { 'cwd': inpath })

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
      console.log(`Failed to post process ${ basename }.`)
      await move(bakpath, filepath)
    }
  }
}

/*----------------------------------------------------------------------------*/

const getVideosToTag = async (inpath, force) => {
  const filepaths = await isFile(inpath)
    ? [path.resolve(inpath)]
    : await glob([GLOB_MP4], { 'cwd': inpath })

  const result = []
  await Promise.all(filepaths.map(async (filepath) => {
    const streams = await ffprobe(filepath)
    const vids = getVideoStreams(streams)
    const mjpeg = firstOfCodec(vids, 'mjpeg')
    if (force || !mjpeg) {
      result.push({ filepath, streams })
    }
  }))
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

const getSrts = async (inpath) => {
  const cwd = await isFile(inpath) ? path.dirname(inpath) : inpath
  const filepaths = await glob([GLOB_SRT], { cwd })
  const result = []
  await Promise.all(filepaths.map(async (filepath) => {
    try {
      const captions = new Subtitle
      captions.parse(await read(filepath, 'utf8'))
      result.push({ filepath, captions })
    } catch (e) {}
  }))
  return result
}

const removeSrts = async (inpath) => {
  const cwd = await isFile(inpath) ? path.dirname(inpath) : inpath
  const filepaths = await glob([GLOB_SRT], { cwd })
  await Promise.all(filepaths.map(async (filepath) => {
    try {
      await trash([filepath])
    } catch (e) {}
  }))
}

const refreshConfig = async () => {
  const couchKey = await getCouchKey()
  const sonarrKey = await getSonarrKey()
  const config = ini.parse(await read(CONFIG_PATH, 'utf8'))
  const { CouchPotato, Sonarr } = config
  if (CouchPotato.apikey !== couchKey || Sonarr.apikey !== sonarrKey) {
    config.CouchPotato.apikey = couchKey
    config.Sonarr.apikey = sonarrKey
    await write(CONFIG_PATH, ini.stringify(config))
  }
}

const renameFiles = async (inpath) => {
  inpath = path.resolve(inpath)

  const category = getCategory(inpath)
  const foldername = path.basename(await isFile(inpath) ? path.dirname(inpath) : inpath)
  const libroot = category === 'movies' ? COUCH_LIBRARY_ROOT : SONARR_LIBRARY_ROOT
  const scanroot = category === 'movies' ? COUCH_SCAN_ROOT : SONARR_SCAN_ROOT
  const scanpath = path.resolve(scanroot, foldername)

  if (isPathInside(inpath, libroot)) {
    return -1
  }
  const args = argv._.slice()
  args[0] = scanpath
  if (MANUAL_RUN) {
    args.length = 7
    // The name of the job name without path or file extension.
    args[2] = foldername
    // The name of the NZB file used by SABPostProcess.py to detect a "Manual Run".
    args[1] = `${ foldername }.nzb`
    // The indexer's report number (not used by SABPostProcess.py).
    args[3] = 0
    // The user-defined category used to signal which manager is notified.
    args[4] = category
    // The group the NZB was posted in (not used by SABPostProcess.py).
    args[5] = ''
    // The status of post processing (0 = OK, 1=failed verification, 2=failed unpack, 3=1+2).
    args[6] = 0
  }
  const date = new Date
  await move(inpath, scanpath)

  const vidpaths = await glob([GLOB_MP4], { 'cwd': scanpath })
  const subs = await getSrts(scanpath)

  await removeSrts(scanpath)
  await refreshConfig()

  // Since `[SABNZBD]` is configured with `convert = False`
  // invoking SABPostProcess.py will simply start a renamer scan.
  try {
    const spawned = execa(SAB_SCRIPT_PATH, args)
    spawned.stdout.pipe(process.stdout)
    await spawned
  } catch (e) {}

  let renamed
  await poll(async () => {
    renamed = await findVideos(libroot, date)
    return renamed.length
  }, { 'frequency': 5000, 'limit': 1000 * 60 * 2.5 })

  if (await exists(scanpath)) {
    const ignored = await glob([GLOB_IGNORE], { 'cwd': scanpath })
    await Promise.all(ignored.map((ignore) => remove(ignore)))
    await restoreSrts(vidpaths, subs)
    return 0
  }
  if (renamed.length) {
    await restoreSrts(renamed, subs)
    await cleanupFolder(renamed[0])
  }
  return 1
}

const findVideos = async (inpath, date=new Date(NaN)) => {
  const cwd = await isFile(inpath) ? path.dirname(inpath) : inpath
  const filepaths = await glob([GLOB_MP4], { cwd })
  const result = []
  await Promise.all(filepaths.map(async (filepath) => {
    const { mtime } = await stat(filepath)
    if (!moment(mtime).isBefore(date)) {
      result.push(filepath)
    }
  }))
  return result
}

const restoreSrts = async (vidpaths, subs) => {
  vidpaths = vidpaths
    .map((vidpath) => path.resolve(vidpath))
    .sort(naturalCompare)

  const subgroups = {}
  for (const sub of subs) {
    const key = path.basename(sub.filepath).replace(reSrtEnLang, '')
    if (subgroups[key]) {
      subgroups[key].push(sub)
    } else {
      subgroups[key] = [sub]
    }
  }
  const subnames = Object
    .keys(subgroups)
    .sort(naturalCompare)

  let { length } = vidpaths
  while (length--) {
    const vidpath = vidpaths[length]
    const basename = path.basename(vidpath, path.extname(vidpath))
    const dirname = path.dirname(vidpath)
    const subgroup = subgroups[subnames[length]] || []
    await Promise.all(subgroup.map(async ({ filepath, captions }) => {
      let { 0:ext } = reSrtEnLang.exec(filepath) || ['.srt']
      ext = ext.replace('.eng.', '.en.')
      await write(path.join(dirname, basename + ext), captions.stringify())
    }))
  }
}

const cleanupFolder = async (inpath) => {
  const cwd = await isFile(inpath) ? path.dirname(inpath) : inpath
  const filepaths = await glob([GLOB_ALL, `!${ GLOB_SRT }`, `!${ GLOB_VIDEO }`], { cwd })
  await Promise.all(filepaths.map(async (filepath) => {
    const basename = path.basename(filepath)
    try {
      console.log(`Trashing ${ basename }.`)
      await trash([filepath])
    } catch (e) {
      console.log(`Failed to trash ${ basename }.`)
    }
  }))
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
    await removeSrts(inpath)

    console.log('Extracting subtitles.')
    await extractSubsFromVideos(vidsToTranscode)

    console.log('Transcoding videos.')
    await transcodeVideos(vidsToTranscode)

    console.log('Removing chapters, embedded subtitles, and extra audio streams.')
    await postProcessVideos(inpath)
  }
  const vidsToTag = await getVideosToTag(inpath, force.has('tag'))
  if (vidsToTag.length) {
    console.log('Adding metadata.')
    await tagVideos(vidsToTag)
  }
  console.log('Starting renamer scan.')
  const status = await renameFiles(inpath)
  if (status < 1) {
    if (status) {
      console.log('Skipped renaming files.')
    } else {
      console.log('Failed to rename files.')
    }
  }
  console.log('Completed.')
})()
