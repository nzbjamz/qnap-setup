#!/usr/bin/env bash

echo 'Installing ffmpeg builds.'

# Install the latest static build of ffmpeg in /opt,
# which should be a symlink of /share/CACHEDEV1_DATA/.qpkg/Entware-ng.
cd /opt/bin/
curl -o ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz
tar -xJf ffmpeg.tar.xz
cd ffmpeg-*64-static/
mv -f ff* qt* ../
cd ..
rm -rf ffmpeg-*64-static
rm ffmpeg.tar.xz

# Install a version of ffmpeg built after VAAPI was patched to work in static builds.
# See https://github.com/01org/intel-vaapi-driver/commit/592365c1181ee105acb61d8ee05ca49ab12f1b36.
# It's not 100% stable so I only use it for VAAPI accelerated encoding. For everything
# else I use the x86_64 static build from https://johnvansickle.com/ffmpeg/.
wget https://drive.google.com/uc?id=1-MkHNmRh1i-6-bTu_oQgqq7JE-guIHOM -O ./ffmpeg-vaapi
chmod +x ffmpeg-vaapi
