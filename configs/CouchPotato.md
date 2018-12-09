# CouchPotato

* Show advanced: `On`

## General Settings

  * Default general settings.

## Searcher

### Movie Search

  * ✓ Search After Add

### Basics

  * First Search: `usenet`
  * Usenet Retention: `9999`
  * Add your indexer

  |Host                |Api Key             |Extra Score |Custom Tag |
  |:--                 |:--                 |:--         |:--        |
  |`<INDEXER_API_URL>` |`<INDEXER_API_KEY>` |0           |`<EMPTY>`  |

## Categories

### Global filters

  * Ignored:<br>
    `china, danish, dksubs, dubbed, dutch, french, german, h.265, h265, HC,
     HDChina, italian, korean, korsub, spanish, swedish, swesub, truefrench, vain`

## Qualities

### Profile Defaults

  * Uncheck the following:
    * Prefer 3D HD
    * 3D HD
    * UHD 4K
    * 2160p

## Downloaders

  * ✗ Black hole
  * Add your download client
    * Host: `localhost:<DOWNLOADER_PORT>`
    * ✓ Ssl
    * Api Key: `<DOWNLOADER_API_KEY>`
    * Category: `movies`
    * ✗ Delete Failed

## Renamer

### Rename downloaded movies

  * ✓ Cleanup
  * To: `/share/CACHEDEV1_DATA/Multimedia/Movies/`
  * Folder naming: `<namethe> (<year>)`
  * File naming: `<thename> (<year>) <cd>.<ext>`
  * ✓ Use TAB 3D
  * ✓ Clean Name
  * From: `/share/CACHEDEV1_DATA/Download/complete/movies/`
  * ✓ Remove lower/equal quality copies of a release after downloading.
  * Run Every: `0`
  * Force Every: `0`
  * ✓ Next On_failed
  * ✓ Check Space
  * ✗ Rename .NFO

## Notifications

  * Add your Plex Media Server
    * Host: `localhost:<PLEX_PORT>`
    * Auth Token: `<PLEX_TOKEN>`

## Manage

### Movie Library Manager

  * Movie Folder: `/share/CACHEDEV1_DATA/Multimedia/Movies/`
  * ✓ Cleanup After
  * ✓ Scan At Startup
  * Full Library Refresh: `0`
