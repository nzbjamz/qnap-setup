# Plex Server

You can find your Plex token by viewing the details of an item in your library:
> "…" ⧽ Info ⧽ View XML ⧽ copy the X-Plex-Token value from the URL

## Settings

### General

  * Time Format: `12 Hour`

### Server ⧽ Transcoder

  * ✓ Use hardware acceleration when available *(Experimental)*

## Channels

  * Install Sub-Zero:<br>
    > Channels ⧽ Install Channels ⧽ Channel Directory ⧽ More… ⧽ All Available Plug-ins
    and search for Sub-Zero

    * ✓ Treat IETF language tags as ISO 639-1 (e.g. pt-BR = pt)
    * ✓ Scan: include embedded subtitles (in the media file (MKV/MP4), don't download if existing)
    * ✓ Scan: include external subtitles (metadata/filesystem, don't download if existing)
    * ✓ Normalize subtitle encoding to UTF-8
    * ✓ Store subtitles next to media files (instead of metadata)
    * On media playback search for missing subtitles (refresh item):<br>
      `hybrid: current item or next episode`
    * Item age to be considered recent: `6 weeks`
    * ✗ Automatically delete leftover/unused (externally saved) subtitles
    * ✓ Scheduler: Overwrite manually selected subtitles when better found
    * Call this executable upon successful subtitle download:<br>
      `/share/CACHEDEV1_DATA/.nvm/versions/node/v<NODE_VERSION>/bin/node /share/CACHEDEV1_DATA/scripts/subscrub.js %(subtitle_path)s`
    * ✓ Check for correct folder permissions of every library on plugin start
