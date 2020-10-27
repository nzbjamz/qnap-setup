#!/usr/bin/env bash

echo 'Adding environment variables.'

cat << EOF >> /opt/etc/profile
export CURL_CA_BUNDLE=/etc/ssl/ca-bundle.crt
export REQUESTS_CA_BUNDLE=/etc/ssl/ca-bundle.crt
export SSL_CERT_FILE=/etc/ssl/ca-bundle.crt
export PYTHONIOENCODING=UTF-8
export PYTHONPATH=/opt/QSabNZBd3/lib/python3.7/site-packages
export LIBVA_DRIVERS_PATH=/opt/QMultimedia/lib
export LIBVA_DRIVER_NAME=iHD

EOF

echo 'Installing core opkg packages.'

opkg update
opkg install coreutils-ls coreutils-rm coreutils-sort git git-http mediainfo procps-ng-ps tar
