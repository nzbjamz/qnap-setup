#!/usr/bin/env node

(async function() {
  'use strict'

  const execa = require('execa')
  const fs = require('fs-extra')
  const ini = require('ini')
  const path = require('path')
  const pify = require('pify')

  const yargs = require('yargs')
    .demandCommand(1)

  const binary = (func) => (a, b) => func(a, b)
  const unary = (func) => (a) => func(a)

  const exists = pify((a, b) => fs.exists(a, (c) => b(null, c)))
  const read = binary(pify(fs.readFile))
  const remove = unary(pify(fs.remove))
  const symlink = binary(pify(fs.ensureSymlink))
  const write = binary(pify(fs.outputFile))

  const BASE_PATH = '/share/CACHEDEV1_DATA'
  const PKG_PATH = path.join(BASE_PATH, '.qpkg/QCouchPotato')

  const CONFIG_PATH = path.join(PKG_PATH, 'COUCH_CONFIG')
  const CONFIG_LINK = path.join(BASE_PATH, path.basename(CONFIG_PATH))

  const GIT_PATH = path.join(PKG_PATH, 'CouchPotatoServer-master')
  const GIT_REPO = 'git://github.com/CouchPotato/CouchPotatoServer.git'

  const QPKG_CONFIG_PATH = '/etc/config/qpkg.conf'

  const config = ini.parse(await read(QPKG_CONFIG_PATH , 'utf8'))
  const version = yargs.argv._[0]

  /*--------------------------------------------------------------------------*/

  const execQuiet = (file, args) => (
    execa(file, args, { 'stdio': 'ignore' })
  )

  /*--------------------------------------------------------------------------*/

  const install = async (version) => {
    if (await exists(path.join(GIT_PATH, '.git'))) {
      console.log('Updating QCouchPotato.')
      await execQuiet('git', ['-C', GIT_PATH, 'pull', 'origin', version])
    }
    else {
      console.log('Installing QCouchPotato.')
      await remove(GIT_PATH)
      await execQuiet('git', ['clone', '--depth=1', `--branch=${ version }`, GIT_REPO, GIT_PATH])
    }
    if (!await exists(CONFIG_LINK)) {
      await symlink(CONFIG_PATH, CONFIG_LINK)
    }
    const { stdout:date } = await execa('git', ['-C', GIT_PATH, 'log', '-1', '--date=short', '--format=%cd'])
    config.QCouchPotato.Build = date.replace(/-/g, '')
    config.QCouchPotato.Date = date
    config.QCouchPotato.Version = version
    write(QPKG_CONFIG_PATH, ini.stringify(config))

    console.log('Completed.')
  }

  /*--------------------------------------------------------------------------*/

  install(version)
}())
