#!/usr/bin/env bash

echo 'Adding environment variables.'

cat << EOF >> /opt/etc/profile
export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
export PYTHONIOENCODING=UTF-8
export PYTHONPATH=/opt/lib/python2.7/site-packages

EOF

echo 'Installing core opkg packages.'

opkg update
opkg install coreutils-ls coreutils-rm coreutils-sort git git-http mediainfo tar
