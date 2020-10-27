#!/usr/bin/env bash

echo 'Finishing setup.'

cat << EOF >> /opt/etc/profile
/share/CACHEDEV1_DATA/.qpkg/QSabNZBd3/QSabNZBd3.sh restart
/share/CACHEDEV1_DATA/.qpkg/QCouchPotato/QCouchPotato.sh restart
/share/CACHEDEV1_DATA/.qpkg/QSonarr/QSonarr.sh restart

rm -rf /share/HD*_DATA

EOF

# Load the updated .profile.
source ~/.profile
