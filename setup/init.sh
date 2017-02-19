#!/usr/bin/env bash

echo 'Adding environment variables.'

echo 'export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt' >> /opt/etc/profile
echo 'export PYTHONPATH=/opt/lib/python2.7/site-packages' >> /opt/etc/profile
echo $'\nrm -rf /share/HD*_DATA\n' >> /opt/etc/profile

echo 'Installing core opkg packages.'

opkg update
opkg install coreutils-ls coreutils-rm git git-http mediainfo tar
