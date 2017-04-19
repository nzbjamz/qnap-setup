#!/usr/bin/env bash

echo 'Cleaning up QNAP packages.'

# Replace Entware's python with QSabNZBdPlus' because it's compiled with
# zlib support and to ensure QSabNZBdPlus has access to pip packages.
cd /share/CACHEDEV1_DATA/.qpkg/Entware-ng/bin/
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/python python
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/python2 python2
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/python2.7 python2.7
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/python-config python-config
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/python2-config python2-config
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/python2.7-config python2.7-config

cd /share/CACHEDEV1_DATA/.qpkg/Entware-ng/include/
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/include/python2.7 python2.7

cd /share/CACHEDEV1_DATA/.qpkg/Entware-ng/lib/
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/lib/python2.7 python2.7

# Remove unused node and npm installs.
rm /share/CACHEDEV1_DATA/.qpkg/QPerl/bin/node
rm /share/CACHEDEV1_DATA/.qpkg/QPerl/bin/npm
rm -rf /share/CACHEDEV1_DATA/.qpkg/QPerl/lib/node_modules

rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/node
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/npm
rm -rf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/lib/node_modules

# Remove par2 from QSabNZBdPlus so Par2cmdline-MT's will be used.
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/par2
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/par2create
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/par2repair
rm /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/bin/par2verify

echo 'Updating CouchPotato.'

cd /share/CACHEDEV1_DATA/.qpkg/QCouchPotato/
rm -rf CouchPotatoServer-master
git clone --quiet --depth=1 --branch=master git://github.com/CouchPotato/CouchPotatoServer.git CouchPotatoServer-master > /dev/null 2>&1

echo 'Updating SABnzbd.'

cd /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/
rm -rf SABnzbd
git clone --quiet --depth=1 --branch=master git://github.com/sabnzbd/sabnzbd.git SABnzbd > /dev/null 2>&1


echo 'Adding COUCH_CONFIG folder.'

cd /share/CACHEDEV1_DATA/.qpkg/QCouchPotato/CouchPotatoServer-master/
mkdir /share/CACHEDEV1_DATA/COUCH_CONFIG
ln -sf /share/CACHEDEV1_DATA/COUCH_CONFIG DATAS

echo 'Adding SAB_CONFIG folder.'

cd /share/CACHEDEV1_DATA/
ln -sf /share/CACHEDEV1_DATA/.qpkg/QSabNZBdPlus/SAB_CONFIG SAB_CONFIG
