#!/usr/bin/env bash

echo 'Installing nvm.'

# Download and run installer.
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.1/install.sh | bash

# Move .nvm to a location with enough storage for Node installs.
mv ~/.nvm /share/CACHEDEV1_DATA/

# Update NVM_DIR variable.
sed 's:NVM_DIR=.*:NVM_DIR=/share/CACHEDEV1_DATA/.nvm:' ~/.profile > .profile.tmp && \
mv -f .profile.tmp .profile

# Add NVM_DIR variable to /opt/etc/profile so it will persist after a reboot.
cat << EOF >> /opt/etc/profile
export NVM_DIR=/share/CACHEDEV1_DATA/.nvm
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # This loads nvm

EOF

# Load the updated .profile.
source ~/.profile

# Install Node 7.
nvm install 7
nvm alias default 7
node -v
