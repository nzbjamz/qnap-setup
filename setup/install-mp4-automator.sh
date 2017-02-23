#!/usr/bin/env bash

basedir=$(dirname "$0")

echo 'Installing mp4_automator.'

# Install sickbeard_mp4_automator prerequesites.
opkg remove python-light --force-removal-of-dependent-packages
opkg remove python-base --force-removal-of-dependent-packages
opkg install python-dev python-pip
opkg install gcc python-cffi
pip install requests
pip install 'requests[security]'
pip install requests-cache
pip install babelfish
pip install 'subliminal<2'
/usr/bin/yes | pip uninstall stevedore
pip install stevedore==1.19.1
pip install qtfaststart

cd /share/CACHEDEV1_DATA/
git clone --quiet --depth=1 --branch=master git://github.com/mdhiggins/sickbeard_mp4_automator scripts > /dev/null 2>&1
chmod +x ./scripts/manual.py

echo 'Installing custom scripts.'

cd "$basedir"/../scripts/
cp * /share/CACHEDEV1_DATA/scripts/
cd /share/CACHEDEV1_DATA/scripts/
npm i > /dev/null 2>&1
