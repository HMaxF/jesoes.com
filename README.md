# JESOES.COM

Static website for JESOES.com

Offline Christian Bible reader.

# How to access
[temporary link](https://hmaxf.github.io/jesoes.com/www)

# Changes History

- 2025-10-07:
  1. Fix New World Translation for verses that contain "[" and "]" or "(" or ")", in VS code do these:

     - Find ` . \[\]",` with .* enabled, it will found 236 verses, replace it with `",`
     - Find ` . \[\]` with .* enabled, it will found 32 verses, replace it with `` (empty content)
     - Find ` []",` without .* enabled, it will found 2 verses, replace it with `",`
     - Find ` ()` without .* enabled, it will found 74 verses, replace it with `` (empty content)     
     - Minify using `jq` in terminal: `$ jq -c . obf2-en-nwt_2025-10-07.json > obf2-en-nwt_2025-10-07_minified.json`
     - Recreate .json.gz (to be uploaded to Google Storage): `gzip -9 -c obf2-en-nwt_2025-10-07_minified.json > obf2-en-nwt_2025-10-07.json.gz`
     - Upload the new .json.gzip to Google Storage.
     - Edit Metadata:
        - Content-type: from `application/gzip` to `application/json`
        - Content-encoding: from `json` to `gzip`
        - NOTE: this will make it download automatically as JSON (not compressed binary)


