# Sonarr

* Advanced Settings: `Shown`

## Media Management

### Episode Naming

  * Rename Episodes: `Yes`
  * Replace Illegal Characters: `Yes`
  * Standard Episode Format: `{Series Title} - S{season:00}E{episode:00} - {Episode Title}`
  * Daily Episode Format: `{Series Title} - {Air-Date} - {Episode Title}`
  * Anime Episode Format: `{Series Title} - S{season:00}E{episode:00} - {Episode Title}`
  * Series Folder Format: `{Series Title}`
  * Season Folder Format: `Season {season}`
  * Multi-Episode Style: `Range`

### Profiles

  * Edit the profile for "Any"
    * Cutoff: `SDTV`
    * Qualities:
      * ✗ Bluray-2160p
      * ✗ WEBDL-2160p
      * ✗ HDTV-2160p
      * ✓ Bluray-1080p
      * ✓ WEBDL-1080p
      * ✓ Bluray-720p
      * ✓ WEBDL-720p
      * ✗ Raw-HD
      * ✓ HDTV-1080p
      * ✓ HDTV-720p
      * ✓ DVD
      * ✓ WEBDL-480p
      * ✓ SDTV
      * ✓ Unknown

### Folders

  * Create empty series folders: `No`

### Importing

  * Skip Free Space Check: `No`
  * Use Hardlinks instead of Copy: `Yes`
  * Import Extra Files: `srt`

### File Management

  * Ignore Deleted Episodes: `No`
  * Download Propers: `Yes`
  * Analyse video files: `Yes`
  * Change File Date: `None`
  * Recycling Bin: `<EMPTY>`

### Permissions

  * Set Permissions: `Yes`
  * File chmod mask: `0644`
  * Folder chmod mask: `0755`

## Indexers

### Indexers

  * Add your indexer
    * Enable RSS Sync: `Yes`
    * Enable Search: `Yes`
    * URL: `<INDEXER_API_URL>`
    * API Key: `<INDEXER_API_KEY>`
    * Categories: `5030,5040`

 * Restrictions
    * Must Not Contain:<br>
      `h.265, h265, PASSMOVIES.RU`

### Options

  * Retention: `0`

## Download Client

### Download Clients

  * Add your download client
    * Enable: `Yes`
    * Host: `localhost`
    * Port: `<DOWNLOADER_PORT>`
    * API Key: `<DOWNLOADER_API_KEY>`
    * Category: `tv`
    * Use SSL: `No`

### Completed Download Handling

  * Enable: `Yes`
  * Remove: `No`

### Failed Download Handling

  * Redownload: `Yes`
  * Remove: `No`

### Drone Factory Options

  * Drone Factory: `/share/CACHEDEV1_DATA/Download/complete/tv/`
  * Drone Factory Interval: `0`

## Connect

### Connections

  * Add your Plex Media Server
    * On Grab: `No`
    * On Download: `Yes`
    * On Upgrade: `Yes`
    * On Rename: `Yes`
    * Host: `localhost`
    * Port: `<PLEX_PORT>`
    * Username: `<PLEX_USERNAME>`
    * Password: `<PLEX_PASSWORD>`
    * Update Library: `Yes`
    * Use SSL: `Yes`

## General

### Start-Up

  * Enable SSL: `Yes`

### Updates

  * Branch: `master`
  * Automatic: `On`
  * Mechanism: `Built-in`

## UI

### Dates

  * Time Format: `5pm/5:30pm`
