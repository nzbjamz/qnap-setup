#!/usr/bin/env node
'use strict'

const execa = require('execa')
const fs = require('fs-extra')
const getStream = require('get-stream')
const globby = require('globby')
const ini = require('ini')
const path = require('path')
const pify = require('pify')

const unary = (func) => (a) => func(a)
const binary = (func) => (a, b) => func(a, b)

const exists = unary(pify((a, b) => fs.exists(a, (c) => b(null, c))))
const move = binary(pify(fs.move))
const read = binary(pify(fs.readFile))
const remove = unary(pify(fs.remove))
const write = binary(pify(fs.writeFile))

const FFMPEG_PATH = '/opt/bin/ffmpeg'
const FFPROBE_PATH = '/opt/bin/ffprobe'

const COUCH_COMPLETE_PATH = '/share/CACHEDEV1_DATA/Multimedia/Movies'
const SONARR_COMPLETE_PATH = '/share/CACHEDEV1_DATA/Multimedia/TV'
const WATCH_PATH = '/share/CACHEDEV1_DATA/Download/complete'

const MANUAL_SCRIPT_PATH = '/share/CACHEDEV1_DATA/scripts/manual.py'
const SAB_SCRIPT_PATH = '/share/CACHEDEV1_DATA/scripts/SABPostProcess.py'

const confpath1 = path.join(__dirname, 'autoProcess.1.ini')
const confpath2 = path.join(__dirname, 'autoProcess.ini')
const config2 = read(confpath2, 'utf8').then(ini.parse)

const argv = process.argv.slice(2)
const inpath = path.resolve(argv[0])
const foldername = path.basename(inpath)
const imdbid = (/\btt\d{7,}/.exec(foldername) || [''])[0]

argv[0] = inpath
if (argv.length < 3) {
  argv.length = 7
  // The name of the job name without path or file extension.
  argv[2] = foldername
  // The indexer's report number. It's not used by SABPostProcess.py.
  argv[3] = 0
  // The user-defined category used to signal which manager is notified.
  argv[4] = argv[1] || inpath.toLowerCase().split(path.sep).includes('tv') ? 'tv' : 'movies'
  // The group the NZB was posted in, e.g. alt.binaries.x. We use it to detect a "Manual Run".
  argv[5] = 'Manual Run'
  // The status of post processing (0 = OK, 1=failed verification, 2=failed unpack, 3=1+2).
  argv[6] = 0
  // The name of the NZB file used by SABPostProcess.py to detect a "Manual Run".
  argv[1] = `${ foldername }.nzb`
}
const category = argv[4]
const group = argv[5]
const outpath = path.join(WATCH_PATH, category, foldername)

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

const cloneDeep = (object) => (
  JSON.parse(JSON.stringify(object))
)

const execQuiet = (file, args) => (
  execa(file, args, { 'stdio': 'ignore' })
)

const extractSubs = (filepath, sublang) =>
  ffprobe(filepath).then(streams => {
    const dirname = path.dirname(filepath)
    const basename = path.basename(filepath, path.extname(filepath))
    const subs = streams.filter(({ codec_type }) => codec_type === 'subtitle')
    const seen = new Map

    const maps = []
    subs.forEach((sub, index) => {
      const { disposition } = sub
      const lang = getLang(sub)
      const labels = Object.keys(disposition).filter((key) => key !== 'default' && disposition[key])

      sub.index = index
      if (disposition.default || sublang == null || lang === sublang) {
        const subname = [basename, lang, ...labels, 'srt'].join('.')
        if (!seen.has(subname)) {
          const subpath = path.join(dirname, subname)
          seen.set(subname, subpath)
          maps.push('-map', `0:s:${ sub.index }`, subpath)
        }
      }
    })
    if (!maps.length) {
      return
    }
    return ffmpeg(filepath, ['-vn', '-an', '-scodec', 'srt', ...maps])
      .catch((e) => (
        Promise.all([...seen.values()].map(remove))
          .then(() => { throw e })
      ))
  })

const ffmpeg = (filepath, args) => (
  execQuiet(FFMPEG_PATH, ['-loglevel', 'quiet', '-y', '-i', filepath, ...args])
)

const ffprobe = (filepath) => (
  execa(FFPROBE_PATH, ['-loglevel', 'quiet', '-print_format', 'json', '-show_streams', filepath])
    .then(({ stdout }) => JSON.parse(stdout).streams)
    .catch(() => [])
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

const series = (tasks) => (
  tasks.reduce((promise, task) => promise.then(task), Promise.resolve())
)

/*----------------------------------------------------------------------------*/

console.log(`Processing video folder ${ foldername }.`)

globby('**/*.{avi,mkv,mov,mp4,mpg,mts,ts,vob}', { 'cwd': inpath, 'realpath': true })
  .then((filepaths) => {
    console.log('Extracting subtitles.')
    return series(filepaths.map((filepath) =>
      () => extractSubs(filepath, 'en')
        .catch(() => {
          const basename = path.basename(filepath)
          console.log(`Failed to extract subtitles for ${ basename }.`)
        })
    ))
  })
  .then(() => {
    // The first pass converts from avi/mkv/other to mp4.
    console.log('Running first pass of mp4_automator/manual.py.')
    return exists(confpath1)
      .then((found) => found || config2.then((object2) => {
        // Create autoProcess.1.ini if it doesn't exist.
        const object1 = cloneDeep(object2)
        Object.assign(object1.MP4, { 'ios-audio': 'True', 'relocate_moov': 'False' })
        return write(confpath1, ini.stringify(object1))
      }))
      .then(() => {
        const spawned = execa(MANUAL_SCRIPT_PATH, ['--auto', '--convertmp4', '--notag', '--config', confpath1, '--input', inpath])
        if (group === 'Manual Run') {
          spawned.stdout.pipe(process.stdout)
        } else {
          getStream(spawned.stdout).then((stdout) => {
            // Remove progress bar updates to avoid cluttering SABnzbd's logs.
            stdout = stdout.replace(/\r\[#* *\] \d+%/g, '')
            console.log(stdout)
          })
        }
        return spawned
      })
  })
  .then(() => globby('**/*.mp4', { 'cwd': inpath, 'realpath': true }))
  .then((filepaths) => series(filepaths.map((filepath) =>
    () => ffprobe(filepath).then((streams) => {
      const dirname = path.dirname(filepath)
      const basename = path.basename(filepath)
      const bakpath = path.join(dirname, `${ basename }.original`)

      console.log(`Post processing ${ basename }.`)

      const auds = streams
        .filter((aud) => aud.codec_type === 'audio')
        .map((aud, index) => {
          aud.index = index
          aud.rank = getRank(aud)
          return aud
         })
        .sort((a, b) => {
          // Stable sort audio streams from highest to lowest ranked.
          return a.rank > b.rank ? -1 : (a.rank < b.rank ? 1 : (a.index - b.index))
        })

      const primary = auds.find(({ disposition }) => disposition.default)
      const stereos = auds.filter(({ channel_layout }) => channel_layout === 'stereo')
      const aac = stereos.find(({ codec_name }) => codec_name === 'aac')

      const first = aac || primary || stereos[0]
      const second = auds.find((aud) => getChannelLayout(aud) !== getChannelLayout(first))

      console.log('Restricting to no more than 2 audio streams.')
      const maps = []
      if (first) {
        maps.push('-map', `0:a:${ first.index }`)
      }
      if (second) {
        maps.push('-map', `0:a:${ second.index }`, `-acodec:${ second.index }`, 'ac3')
      }
      if (!maps.length) {
        maps.push('-map', '0:a')
      }
      console.log('Removing embedded subtitles.')
      return move(filepath, bakpath)
        .then(() => ffmpeg(bakpath, ['-codec', 'copy', '-sn', '-map_chapters', '-1', '-map', '0:v', ...maps, filepath]))
        .then(() => remove(bakpath))
    })
  )))
  .then(() => {
    // The second pass adds metadata and relocates the moov atom.
    console.log('Running second pass of mp4_automator/manual.py.')
    const args = ['--auto', '--convertmp4', '--config', confpath2, '--input', inpath]
    if (imdbid) {
      args.push('--imdbid', imdbid)
    }
    // Pipe stdout when manually invoked.
    if (group === 'Manual Run') {
      const spawned = execa(MANUAL_SCRIPT_PATH, args)
      spawned.stdout.pipe(process.stdout)
      return spawned
    }
    return execQuiet(MANUAL_SCRIPT_PATH, args)
  })
  .then(() => {
    console.log('Moving video folder to the watched location.')
    return move(inpath, outpath)
  })
  .then(() => {
    // Since the `SABNZBD` section is configured with `convert = False`
    // invoking SABPostProcess.py will simply start a renamer scan.
    const manager = category === 'movies' ? 'CouchPotato' : 'Sonarr'
    console.log(`Starting ${ manager } renamer.`)

    const spawned = execa(SAB_SCRIPT_PATH, argv)
    spawned.stdout.pipe(process.stdout)
    return spawned
      .catch(() => console.log('Failed to start renamer.'))
  })
  .then(() => {
    console.log('Finding renamed video folder.')
    const cwd = category === 'movies' ? COUCH_COMPLETE_PATH : SONARR_COMPLETE_PATH
    return globby('**/', { 'cwd': cwd, 'realpath': true })
      .then((dirpaths) => dirpaths
        .map((dirpath) => ({
          'value': dirpath,
          'time': fs.statSync(dirpath).mtime.getTime()
        }))
        .sort((a, b) => {
          // Sort folders from newest to oldest.
          return b.time - a.time
        })
        .map(({ value }) => value)[0] || cwd)
  })
  .then((dirpath) =>
    globby('*.srt', { 'cwd': dirpath, 'realpath': true })
      .then((subpaths) => {
        console.log('Scanning for misnamed subtitles.')
        return series(subpaths.map((subpath) =>
          () => {
            const dirname = path.dirname(subpath)
            const basename = path.basename(subpath)
            const parts = basename.split('.')
            if (parts[1] !== 'en') {
              // Add "en" language code to subtitle name.
              parts.splice(1, 0, 'en')
              const rename = parts.join('.')
              return Promise.resolve()
                .then(() => console.log(`Renaming ${ basename } to ${ rename }.`))
                .then(() => move(subpath, path.join(dirname, rename)))
            }
          }
        ))
      })
      .then(() => globby(['*', '!*.{avi,mkv,mov,mp4,mpg,mts,srt,ts,vob}'], { 'cwd': dirpath, 'realpath': true }))
      .then((filepaths) => {
        console.log('Scanning for leftover files.')
        return series(filepaths.map((filepath) => {
          const basename = path.basename(filepath)
          return Promise.resolve()
            .then(() => console.log(`Removing ${ basename }.`))
            .then(() => remove(filepath))
        }))
      })
  )
  .then(() => console.log('Completed.'))
  .catch((e) => console.error(e))
