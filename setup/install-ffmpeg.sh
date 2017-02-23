#!/usr/bin/env bash

echo 'Installing ffmpeg builds.'

# Install the latest static build of ffmpeg in /opt,
# which should be a symlink of /share/CACHEDEV1_DATA/.qpkg/Entware-ng.
cd /opt/bin/
curl -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
tar -xJf ffmpeg.tar.xz
cd ffmpeg-*-64bit-static/
mv -f ff* qt* ../
cd ..
rm -rf ffmpeg-*-64bit-static
rm ffmpeg.tar.xz

# Install a version of ffmpeg built after VAAPI was patched to work in static builds.
# See https://github.com/01org/intel-vaapi-driver/commit/592365c1181ee105acb61d8ee05ca49ab12f1b36.
# It's not 100% stable so I only use it for VAAPI accelerated encoding. For everything
# else I use the x86_64 static build from https://johnvansickle.com/ffmpeg/.
curl -o ffmpeg-vaapi http://chunk.io/f/63cd77b383924203b9ca269415423656
chmod +x ffmpeg-vaapi
