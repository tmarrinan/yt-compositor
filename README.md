# yt-compositor
YouTube utility to get info, download, and composite videos.
 * Downloads YouTube video
 * Composites video and audio into a single file (if stored separately by YouTube)
 * Crops video to remove black borders (if the exist)
 * Saves final video to desired location

#### Install
`npm install -g yt-compositor`

#### Dependencies
 * [FFmpeg](https://www.ffmpeg.org/)

#### Usage
```
  Usage: ytcomp [options] <url ...>

  Options:

    -h, --help            output usage information
    -i, --info            Print video info without downloading
    -q, --quality <ITAG>  Video quality to download. Default: itag with highest resolution
    -o, --output <FILE>   Where to save the file. Default: output.<FILE_TYPE>
    -w, --with-audio      Composite selected video with audio to create one file
    -r, --remove-borders  Remove black borders in the video if they exist
    -p, --print-url       Print direct download url
```
