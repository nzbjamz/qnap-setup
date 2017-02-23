#!/usr/bin/env node

(async function() {
  'use strict'

  const execa = require('execa')
  const fs = require('fs-extra')
  const getStream = require('get-stream')
  const globby = require('globby')
  const ini = require('ini')
  const isPathInside = require('path-is-inside')
  const path = require('path')
  const pify = require('pify')
  const tempWrite = require('temp-write')

  const unary = (func) => (a) => func(a)
  const binary = (func) => (a, b) => func(a, b)

  const move = binary(pify(fs.move))
  const read = binary(pify(fs.readFile))
  const remove = unary(pify(fs.remove))
  const write = binary(pify(fs.writeFile))

  const FFMPEG_PATH = '/opt/bin/ffmpeg'
  const FFPROBE_PATH = '/opt/bin/ffprobe'

  const COUCH_LIBRARY_PATH = '/share/CACHEDEV1_DATA/Multimedia/Movies'
  const SONARR_LIBRARY_PATH = '/share/CACHEDEV1_DATA/Multimedia/TV'
  const WATCH_PATH = '/share/CACHEDEV1_DATA/Download/complete'

  const MANUAL_SCRIPT_PATH = '/share/CACHEDEV1_DATA/scripts/manual.py'
  const SAB_SCRIPT_PATH = '/share/CACHEDEV1_DATA/scripts/SABPostProcess.py'

  const confpath = path.join(__dirname, 'autoProcess.ini')
  const config = ini.parse(await read(confpath, 'utf8'))

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
  const isManual = group === 'Manual Run'
  const manager = category === 'movies' ? 'CouchPotato' : 'Sonarr'

  const libpath = category === 'movies' ? COUCH_LIBRARY_PATH : SONARR_LIBRARY_PATH
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

  /*--------------------------------------------------------------------------*/

  const execQuiet = (file, args) => (
    execa(file, args, { 'stdio': 'ignore' })
  )

  const ffmpeg = (filepath, args) => (
    execQuiet(FFMPEG_PATH, ['-loglevel', 'quiet', '-y', '-i', filepath, ...args])
  )

  const ffprobe = async (filepath) => {
    try {
      const { stdout } = await execa(FFPROBE_PATH, ['-loglevel', 'quiet', '-print_format', 'json', '-show_streams', filepath])
      return JSON.parse(stdout).streams
    } catch (e) {}
    return []
  }

  /*--------------------------------------------------------------------------*/

  const cloneDeep = (object) => (
    JSON.parse(JSON.stringify(object))
  )

  const firstOfCodec = (streams, codec) => (
    streams.find(({ codec_name }) => codec_name === codec)
  )

  const getAudioStreams = (streams) => (
    streams.filter(({ codec_type }) => codec_type === 'audio').map((aud, index) => {
      const rank = getRank(aud)
      return Object.assign(cloneDeep(aud), { index, rank })
    })
  )

  const getDefaultStream = (streams) => (
    streams.find(({ disposition }) => disposition.default)
  )

  const getStereoStreams = (streams) => (
    streams.filter(({ channel_layout }) => channel_layout === 'stereo')
  )

  const getSubStreams = (streams) => (
    streams.filter(({ codec_type }) => codec_type === 'subtitle').map((sub, index) => {
      const lang = getLang(sub)
      return Object.assign(cloneDeep(sub), { index, lang })
    })
  )

  const getVideoStreams = (streams) => (
    streams.filter(({ codec_type }) => codec_type === 'video').map((vid, index) => {
      return Object.assign(cloneDeep(vid), { index })
    })
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

  const stripProgress = (string) => (
    string.replace(/\r\[#* *\] \d+%/g, '')
  )

  /*--------------------------------------------------------------------------*/

  const extractSubs = async (filepath, sublang, streams) => {
    streams || (streams = await ffprobe(filepath))
    const dirname = path.dirname(filepath)
    const basename = path.basename(filepath, path.extname(filepath))
    const seen = new Map

    const maps = getSubStreams(streams).reduce((maps, sub) => {
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
        return true
      }
    } catch (e) {
      for (const subpath of seen.values()) {
        await remove(subpath)
      }
    }
    return false
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Inspect media and extract embedded subtitles.
   *
   * @param {string} inpath The path to process.
   * @returns {boolean} Returns `true` if the step was executed, else `false`.
   */
  const stepOne = async (inpath) => {
    const vidpaths = await globby('**/*.{avi,mkv,mov,mp4,mpg,mts,ts,vob}', {
      'cwd': inpath,
      'realpath': true
    })

    let result = false
    for (const vidpath of vidpaths) {
      const dirname = path.dirname(vidpath)
      const basename = path.basename(vidpath)
      const ext = path.extname(basename).toLowerCase()

      console.log(`Inspecting ${ basename }.`)
      const streams = await ffprobe(vidpath)
      const auds = getAudioStreams(streams)
      const subs = getSubStreams(streams)

      const stereos = getStereoStreams(auds)
      const aac = firstOfCodec(stereos, 'aac')

      if (ext === '.mp4' && aac && !subs.length && auds.length < 3) {
        continue
      }
      if (await extractSubs(vidpath, 'en', streams)) {
        console.log(`Extracted subtitles for ${ basename }.`)
      }
      result = true
    }
    return result
  }

  /**
   * Convert avi/mkv/other to mp4.
   *
   * @param {string} inpath The path to process.
   * @returns {boolean} Returns `true` if the step was executed, else `false`.
   */
  const stepTwo = async (inpath) => {
    const tempfig = cloneDeep(config)
    Object.assign(tempfig.MP4, { 'ios-audio': 'True', 'relocate_moov': 'False' })

    const temppath = await tempWrite(ini.stringify(tempfig))
    const spawned = execa(MANUAL_SCRIPT_PATH, ['--auto', '--convertmp4', '--notag', '--config', temppath, '--input', inpath])

    if (isManual) {
      spawned.stdout.pipe(process.stdout)
    } else {
      console.log(stripProgress(await getStream(spawned.stdout)))
    }
    try {
      await spawned
    } catch (e) {
      console.log('Operation failed.')
    }
    return true
  }

  /**
   * Remove embedded subtitles and extra audio streams.
   *
   * @param {string} inpath The path to process.
   * @returns {boolean} Returns `true` if the step was executed, else `false`.
   */
  const stepThree = async (inpath) => {
    const vidpaths = await globby('**/*.mp4', {
      'cwd': inpath,
      'realpath': true
    })

    for (const vidpath of vidpaths) {
      const dirname = path.dirname(vidpath)
      const basename = path.basename(vidpath)
      const bakpath = path.join(dirname, `${ basename }.original`)

      console.log(`Post processing ${ basename }.`)
      const streams = await ffprobe(vidpath)

      // Stable sort audio streams from highest to lowest ranked.
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
      await move(vidpath, bakpath)
      try {
        console.log('Removing embedded subtitles and extra audio streams.')
        await ffmpeg(bakpath, ['-codec', 'copy', '-sn', '-map_chapters', '-1', '-map', '0:v', ...maps, vidpath])
        await remove(bakpath)
      } catch (e) {
        console.log('Operation failed.')
        await move(bakpath, vidpath)
      }
    }
    return true
  }

  /**
   * Add metadata and optimize for streaming.
   *
   * @param {string} inpath The path to process.
   * @returns {boolean} Returns `true` if the step was executed, else `false`.
   */
  const stepFour = async (inpath) => {
    console.log('Adding metadata and optimizing for streaming.')
    const args = ['--auto', '--convertmp4', '--config', confpath, '--input', inpath]
    if (imdbid) {
      args.push('--imdbid', imdbid)
    }
    const spawned = execa(MANUAL_SCRIPT_PATH, args)
    if (isManual) {
      spawned.stdout.pipe(process.stdout)
    } else {
      console.log(stripProgress(await getStream(spawned.stdout)))
    }
    try {
      await spawned
    } catch (e) {
      console.log('Operation failed.')
    }
    return true
  }

  /**
   * Move video folder to the watched location.
   *
   * @param {string} inpath The path to process.
   * @returns {boolean} Returns `true` if the step was executed, else `false`.
   */
  const stepFive = async (inpath) => {
    console.log('Moving video folder to the watched location.')
    await move(inpath, outpath)

    try {
      // Since `SABNZBD` is configured with `convert = False`
      // invoking SABPostProcess.py will simply start a renamer scan.
      console.log(`Starting ${ manager } renamer scan.`)
      const spawned = execa(SAB_SCRIPT_PATH, argv)
      spawned.stdout.pipe(process.stdout)
      await spawned
    } catch (e) {
      console.log('Operation failed.')
      return true
    }

    console.log('Finding renamed video folder.')
    const dirpaths = await globby('**/', {
      'cwd': libpath,
      'realpath': true
    })

    if (!dirpaths.length) {
      return true
    }
    // Sort folders from newest to oldest.
    const dirpath = dirpaths
      .map((dirpath) => ({ 'value': dirpath, 'time': fs.statSync(dirpath).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)
      .map(({ value }) => value)[0]

    const leftpaths = await globby(['*', '!*.{avi,mkv,mov,mp4,mpg,mts,srt,ts,vob}'], {
      'cwd': dirpath,
      'realpath': true
    })

    const subpaths = await globby('*.srt', {
      'cwd': dirpath,
      'realpath': true
    })

    console.log('Scanning for misnamed subtitles.')
    for (const subpath of subpaths) {
      const dirname = path.dirname(subpath)
      const basename = path.basename(subpath)
      const parts = basename.split('.')
      if (parts[1] !== 'en') {
        // Add "en" language code to subtitle name.
        parts.splice(1, 0, 'en')
        const rename = parts.join('.')
        console.log(`Renaming ${ basename } to ${ rename }.`)
        await move(subpath, path.join(dirname, rename))
      }
    }
    console.log('Scanning for leftover files.')
    for (const leftpath of leftpaths) {
      const basename = path.basename(leftpath)
      console.log(`Removing ${ basename }.`)
      await remove(leftpath)
    }
    return true
  }

  /*--------------------------------------------------------------------------*/

  console.log(`Processing video folder ${ foldername }.`)
  if (await stepOne(inpath)) {
    console.log('Running first pass of mp4 automator.')
    await stepTwo(inpath)
    await stepThree(inpath)
  } else {
    console.log('Skipping first pass of mp4 automator.')
  }
  console.log('Running second pass of mp4 automator.')
  await stepFour(inpath)
  if (!isPathInside(inpath, libpath)) {
    await stepFive(inpath)
  }
  console.log('Completed.')
}())
