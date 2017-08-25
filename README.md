# QNAP TS-251+ Setup

1. Go to the QNAP Control Panel and disable the network recycle bin and expanded
   media functionality.

1. Go to the QNAP FileStation settings and disable folder thumbnails.

1. Before we begin I should mention QNAP packages have some drawbacks. They
   tend to be bloated with extra copies of `mv`, `node`, `tar`, and other binaries
   which take precedence over those on your system and complicate scripting. In
   the future I’ll replace QCouchPotato, QSonarr, and QSabNZBdPlus with alternative
   installs.

   In the QNAP AppCenter install

  * `Entware-ng.qpkg` from
    [entware.net](https://github.com/Entware-ng/Entware-ng/wiki/Install-on-QNAP-NAS)

  * `QPerl_x86_64.qpkg` and `CACert_x86_64.qpkg` from the
    [QNAP Club Store](http://qnapclub.eu/)

  * `QCouchPotato_x86_64.qpkg` from the
    [QNAP Club Store](http://qnapclub.eu/)

  * QMono from QNAP AppCenter Store and `QSonarr_x86_64.qpkg` from the
    [QNAP Club Store](http://qnapclub.eu/)

  * `Par2cmdline-MT_x86_64.qpkg` and `QSabNZBdPlus_x86_64.qpkg` from the
    [QNAP Club Store](http://qnapclub.eu/)

  * Plex Media Server from QNAP AppCenter Store if it’s ≥ 1.8, else from
    the [Plex forums](https://forums.plex.tv/discussion/282845/plex-media-server-hardware-transcoding-preview-4-1-8-1-4140/p1)

1. From QTS stop QSabNZBdPlus, QCouchPotato, and QSonarr packages.

1. `ssh` into the TS-251+
    ```shell
ssh -l admin <QNAP_SERVER_NAME_OR_IP>
> admin@<QNAP_SERVER_NAME_OR_IP> password: <QNAP_PASSWORD>
```

1. Start Entware.<br>
   *Note: Once Entware is started `/opt` should be a symlink to `/share/CACHEDEV1_DATA/.qpkg/Entware-ng/`*
   ```shell
/share/CACHEDEV1_DATA/.qpkg/Entware-ng/Entware-ng.sh start
source ~/.profile
```

1. Clone this qnap-setup repo and run the setup.
   ```shell
opkg install git
cd /share/CACHEDEV1_DATA/
git clone --quiet --depth=1 --branch=master git://github.com/nzbjamz/qnap-setup
./qnap-setup/setup.sh
```

1. From QTS restart QSabNZBdPlus, QCouchPotato, and QSonarr packages.

1. Configure [SABnzbd](configs/SABnzbd.md), [CouchPotato](configs/CouchPotato.md),
  [Sonarr](configs/Sonarr.md), and [Plex Server](configs/PlexServer.md).
