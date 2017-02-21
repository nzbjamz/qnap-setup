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
    * ✓ Automatically delete leftover/unused (externally saved) subtitles
    * ✓ Scheduler: Overwrite manually selected subtitles when better found
    * ✓ Check for correct folder permissions of every library on plugin start
