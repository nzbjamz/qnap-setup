#!/usr/bin/env bash

basedir=$(dirname "$0")

"$basedir"/setup/init.sh
"$basedir"/setup/setup-packages.sh

"$basedir"/setup/install-ffmpeg.sh
"$basedir"/setup/install-nvm.sh
"$basedir"/setup/install-mp4-automator.sh
