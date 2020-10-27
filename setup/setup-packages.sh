#!/usr/bin/env bash

echo 'Cleaning up QNAP packages.'

# Remove par2 from QSabNZBd3 so Par2cmdline-MT's will be used.
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/bin/par2
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/bin/par2create
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/bin/par2repair
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/bin/par2verify

echo 'Updating CouchPotato.'

cd /share/CACHEDEV1_DATA/.qpkg/QCouchPotato/
rm -rf CouchPotatoServer-master
git clone --quiet --depth=1 --branch=master git://github.com/CouchPotato/CouchPotatoServer.git CouchPotatoServer-master > /dev/null 2>&1

echo 'Updating SABnzbd.'

cd /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/
rm -rf SABnzbd
git clone --quiet --depth=1 --branch=master git://github.com/sabnzbd/sabnzbd.git SABnzbd > /dev/null 2>&1

echo 'Adding COUCH_CONFIG folder.'

cd /share/CACHEDEV1_DATA/.qpkg/QCouchPotato/CouchPotatoServer-master/
mkdir /share/CACHEDEV1_DATA/COUCH_CONFIG
ln -sf /share/CACHEDEV1_DATA/COUCH_CONFIG DATAS

echo 'Adding SAB_CONFIG folder.'

cd /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/
mv /share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/SAB_CONFIG /share/CACHEDEV1_DATA/
ln -sf /share/CACHEDEV1_DATA/SAB_CONFIG SAB_CONFIG
