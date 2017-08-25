#!/usr/bin/env node

(async function() {
  'use strict'

  const execa = require('execa')
  const fs = require('fs-extra')
  const ini = require('ini')
  const path = require('path')
  const pify = require('pify')

  const binary = (func) => (a, b) => func(a, b)
  const unary = (func) => (a) => func(a)

  const exists = pify((a, b) => fs.exists(a, (c) => b(null, c)))
  const read = binary(pify(fs.readFile))
  const remove = unary(pify(fs.remove))
  const symlink = binary(pify(fs.ensureSymlink))
  const write = binary(pify(fs.outputFile))

  const BASE_PATH = '/share/CACHEDEV1_DATA'
  const PKG_PATH = path.join(BASE_PATH, '.qpkg/QSabNZBdPlus')

  const CONFIG_PATH = path.join(PKG_PATH, 'SAB_CONFIG')
  const CONFIG_LINK = path.join(BASE_PATH, path.basename(CONFIG_PATH))

  const GIT_PATH = path.join(PKG_PATH, 'SABnzbd')
  const GIT_REPO = 'git://github.com/sabnzbd/sabnzbd.git'

  const QPKG_CONFIG_PATH = '/etc/config/qpkg.conf'

  const config = ini.parse(await read(QPKG_CONFIG_PATH , 'utf8'))

  /*--------------------------------------------------------------------------*/

  const execQuiet = (file, args) => (
    execa(file, args, { 'stdio': 'ignore' })
  )

  /*--------------------------------------------------------------------------*/

  const install = async () => {
    if (await exists(path.join(GIT_PATH, '.git'))) {
      console.log('Updating QSabNZBdPlus.')
      await execQuiet('git', ['-C', GIT_PATH, 'pull', 'origin', 'master'])
    }
    else {
      console.log('Installing QSabNZBdPlus.')
      await remove(GIT_PATH)
      await execQuiet('git', ['clone', '--depth=1', `--branch=master`, GIT_REPO, GIT_PATH])
    }
    if (!await exists(CONFIG_LINK)) {
      await symlink(CONFIG_PATH, CONFIG_LINK)
    }
    const { stdout:date } = await execa('git', ['-C', GIT_PATH, 'log', '-1', '--date=short', '--format=%cd'])
    config.QSabNZBdPlus.Build = date.replace(/-/g, '')
    config.QSabNZBdPlus.Date = date
    config.QSabNZBdPlus.Version = version
    write(QPKG_CONFIG_PATH, ini.stringify(config))

    console.log('Completed.')
  }

  /*--------------------------------------------------------------------------*/

  install()
}())
