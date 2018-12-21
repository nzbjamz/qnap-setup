# SABnzbd

## General

### SABnzbd Web Server

  * ✓ Enable HTTPS

### Switches

  * ✓ HTTPS certificate verification

### Tuning

  * Article Cache Limit: `8G`

## Folders

### User Folders

  * Temporary Download Folder: `/share/CACHEDEV1_DATA/Download/incomplete`
  * Completed Download Folder: `/share/CACHEDEV1_DATA/Download/transcoding`
  * Scripts Folder: `/share/CACHEDEV1_DATA/scripts`

## Servers

  Use the SSL address and port specified by your provider.

  * Host: `<SSL_SERVER_HOST>`
  * Port: `443`
  * ✓ SSL
  * Advanced
    * Certificate verification: `Strict`

## Categories

|Category |Priority |Processing |Script            |Folder/Path |Indexer Categories / Groups |
|:--      |:--      |:--        |:--               |:--         |:--                         |
|movies   |Normal   |+Delete    |SABPostProcess.js |movies      |Movies                      |
|tv       |Normal   |+Delete    |SABPostProcess.js |tv          |TV                          |

## Switches

### Queue

  * ✓ Check before download
  * ✓ Abort jobs that cannot be completed
  * Detect Duplicate Downloads: `Tag job`
  * Detect duplicate episodes in series: `Tag job`
  * Action when encrypted RAR is downloaded: `Abort`
  * Action when unwanted extension detected: `Off`
  * ✓ Direct Unpack

### Post processing

  * ✓ Enable Quick Check
  * ✓ Enable SFV-based checks
  * ✓ Post-Process Only Verified Jobs
  * ✓ Enable recursive unpacking
  * ✓ Ignore any folders inside archives
  * ✓ Ignore Samples
  * Cleanup List:<br>
    `ass, bat, com, db, exe, gif, htm, html, idx, info, ini, jpg, jpeg, lnk, md5,
     nfo, nzb, par2, pdf, png, scr, sfv, srr, sub, txt, url, website`

### Indexing

  * ✓ Enable Indexer Integration
  * ✓ Automatic Feedback
  * Server address: `<INDEXER_API_URL>`
  * API Key: `<INDEXER_API_KEY>`

## Special

### Switches

  * ✓ require_modern_tls
