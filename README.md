# yt-compositor
YouTube utility to get info, download, and composite videos

### Install
`npm install -g yt-compositor`

### Dependencies
[FFmpeg](https://www.ffmpeg.org/)

### Usage
```
  Usage: ytcomp [options] <url ...>

  Options:

    -h, --help            output usage information
    -i, --info            Print video info without downloading
    -q, --quality <ITAG>  Video quality to download. Default: highest
    -o, --output <FILE>   Where to save the file. Default: output.<FILE_TYPE>
    -w, --with-audio      Composite selected video with audio to create one file
    -p, --print-url       Print direct download url
```
