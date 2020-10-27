#!/usr/bin/env bash

basedir=$(dirname "$0")

echo 'Installing mp4_automator.'

cd /share/CACHEDEV1_DATA/
git clone --quiet --depth=1 --branch=master git://github.com/mdhiggins/sickbeard_mp4_automator scripts > /dev/null 2>&1
chmod +x ./scripts/manual.py
cd /share/CACHEDEV1_DATA/scripts/
find / -name '*.pyc' -delete
/opt/QSabNZBd3/bin/pip install -r setup/requirements.txt

echo 'Installing custom scripts.'

cd "$basedir"/../scripts/
cp *{.js,.json} /share/CACHEDEV1_DATA/scripts/
cp ./config/autoProcess.ini /share/CACHEDEV1_DATA/scripts/config/
cd /share/CACHEDEV1_DATA/scripts/
npm i > /dev/null 2>&1
