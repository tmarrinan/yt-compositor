#! /usr/bin/env node

var colors        = require('colors');
var child_process = require('child_process');
var commander     = require('commander');
var fs            = require('fs');
var path          = require('path');
var request       = require('request');
var ytdl          = require('ytdl-core');

var exec = child_process.exec;
var spawn = child_process.spawn;


commander
  .usage('[options] <url ...>')
  .option('-i, --info',            'Print video info without downloading')
  .option('-q, --quality <ITAG>',  'Video quality to download. Default: highest')
  .option('-o, --output <FILE>',   'Where to save the file. Default: output.<FILE_TYPE>')
  .option('-w, --with-audio',      'Composite selected video with audio to create one file')
  .option('-r, --remove-borders',  'Remove black borders in the video if they exist')
  .option('-p, --print-url',       'Print direct download url')
  .parse(process.argv);

if (commander.args.length < 1) {
	console.log("Usage: ytcomp [options] <url ...>");
	process.exit(0);
}

var tmpStats;
try {
	tmpStats = fs.statSync(path.join(__dirname, "tmp"));
	if (!tmpStats.isDirectory()) {
		fs.unlinkSync(path.join(__dirname, "tmp"));
		fs.mkdirSync(path.join(__dirname, "tmp"));
	}
}
catch (exception) {
	fs.mkdirSync(path.join(__dirname, "tmp"));
}

var ytURL = commander.args[0];
try {
	ytdl.getInfo(ytURL, function(err, info) {
		if (err) {
			console.log("YouTube video not found: " + ytURL);
			process.exit(0);
		}

		var i;
		var j;
		var selectedFormatIdx = 0;
		var selectedFormatRes = 0;
		var audioFormatIdx = 0;
		var audioFormatBit = 0;

		// print the video info
		if (commander.info === true) {
			console.log("itag".green + "  container".blue + "  resolution".green + "  video enc".blue + "       profile".green + "   audio bitrate".blue + "  audio enc".green);
		}
		for (i=0; i<info.formats.length; i++) {
			// find selected format
			if (commander.quality === undefined) {
				var res = parseInt(info.formats[i].resolution, 10);
				if (res > selectedFormatRes) {
					selectedFormatRes = res;
					selectedFormatIdx = i;
				}
			}
			else {
				if (info.formats[i].itag === commander.quality) {
					selectedFormatIdx = i;
				}
			}
			// find audio format
			if ((info.formats[i].audioEncoding !== undefined && info.formats[i].audioEncoding !== null) &&
				(info.formats[i].resolution === undefined || info.formats[i].resolution === null)) {
				if (info.formats[i].audioBitrate > audioFormatBit) {
					audioFormatBit = info.formats[i].audioBitrate;
					audioFormatIdx = i;
				}
			}


			// print the video info
			if (commander.info === true) {
				// print ITAG if exists
				if (info.formats[i].itag !== undefined && info.formats[i].itag !== null)
					process.stdout.write(info.formats[i].itag + initString(" ", 6-info.formats[i].itag.length));
				else
					process.stdout.write(initString(" ", 6));
				// print CONTAINER if exists
				if (info.formats[i].container !== undefined && info.formats[i].container !== null)
					process.stdout.write(info.formats[i].container + initString(" ", 11-info.formats[i].container.length));
				else
					process.stdout.write(initString(" ", 11));
				// print RESOLUTION if exists
				if (info.formats[i].resolution !== undefined && info.formats[i].resolution !== null)
					process.stdout.write(info.formats[i].resolution + initString(" ", 12-info.formats[i].resolution.length));
				else
					process.stdout.write(initString(" ", 12));
				// print ENCODING if exists
				if (info.formats[i].encoding !== undefined && info.formats[i].encoding !== null)
					process.stdout.write(info.formats[i].encoding + initString(" ", 16-info.formats[i].encoding.length));
				else
					process.stdout.write(initString(" ", 16));
				// print PROFILE if exists
				if (info.formats[i].profile !== undefined && info.formats[i].profile !== null)
					process.stdout.write(info.formats[i].profile + initString(" ", 10-info.formats[i].profile.length));
				else
					process.stdout.write(initString(" ", 10));
				// print AUDIO BITRATE if exists
				if (info.formats[i].audioBitrate !== undefined && info.formats[i].audioBitrate !== null)
					process.stdout.write(info.formats[i].audioBitrate + initString(" ", 15-info.formats[i].audioBitrate.toString().length));
				else
					process.stdout.write(initString(" ", 15));
				// print AUDIO ENCODING if exists
				if (info.formats[i].audioEncoding !== undefined && info.formats[i].audioEncoding !== null)
					process.stdout.write(info.formats[i].audioEncoding);
				else
					process.stdout.write(initString(" ", 1));

				process.stdout.write("\n");
			}
		}
		if (commander.printUrl === true) {
			console.log(info.formats[selectedFormatIdx].url);
		}

		if (commander.info !== true && commander.printUrl !== true) {
			var tmpID = guid();
			var tmpVideo = path.join(__dirname, "tmp", "TMPV_" + tmpID + "." + info.formats[selectedFormatIdx].container);
			var tmpAudio = path.join(__dirname, "tmp", "TMPA_" + tmpID + "." + info.formats[audioFormatIdx].container);
			var finalOutput = commander.output || "output." + info.formats[selectedFormatIdx].container;
			downloadFile(info.formats[selectedFormatIdx].url, tmpVideo, function() {
				var outputType = path.extname(finalOutput);
				var inputVType = path.extname(tmpVideo);
				var inputAType = path.extname(tmpAudio);
				var videoEnc = outputType === ".mp4" ? "libx264" : "libvpx-vp9";
				var audioEnc = outputType === ".mp4" ? "aac" : "libvorbis";
				var videoMetaData = {width: 0, height: 0, nframes: 0, duration: 0};
				exec('ffprobe -v quiet -print_format json -show_format -show_streams ' + tmpVideo, function(error, stdout, stderr) {
					if (error) throw error;

					var meta = JSON.parse(stdout);
					videoMetaData.duration = parseFloat(meta.format.duration);
					for (i=0; i<meta.streams.length; i++) {
						if (meta.streams[i].codec_type === "video") {
							videoMetaData.width = parseInt(meta.streams[i].width, 10);
							videoMetaData.height = parseInt(meta.streams[i].height, 10);
							if (meta.streams[i].nb_frames !== undefined) {
								videoMetaData.nframes = parseInt(meta.streams[i].nb_frames, 10);
							}
							else {
								var fpsRational = meta.streams[i].avg_frame_rate.split("/");
								var fps = parseInt(fpsRational[0], 10) / parseInt(fpsRational[1], 10);
								videoMetaData.nframes = videoMetaData.duration * fps;
							}
							break;
						}
					}

					if ((commander.quality === undefined || commander.withAudio === true) && (info.formats[selectedFormatIdx].audioEncoding === undefined || info.formats[selectedFormatIdx].audioEncoding === null)) {
						downloadFile(info.formats[audioFormatIdx].url, tmpAudio, function() {
							var compositeOptions;
							if (commander.removeBorders === true) {
								checkForBlackBorders(tmpVideo, videoMetaData, function(crop) {
									if (crop !== null) {
										if (outputType === ".mp4") {
											compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-vf', crop, '-c:v', videoEnc, '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
										}
										else if (outputType === ".webm") {
											compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-vf', crop, '-c:v', videoEnc, '-c:a', audioEnc, '-quality', 'good', '-cpu-used', '1', '-qmin', '10', '-qmax', '42', '-threads', '4', '-y', finalOutput];
										}
										compositeVideo(compositeOptions, videoMetaData, function() {
											fs.unlinkSync(tmpVideo);
											fs.unlinkSync(tmpAudio);
											console.log("Finished!");
										});
									}
									else {
										if (outputType === inputVType) {
											compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-c:v', 'copy', '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
										}
										else {
											if (outputType === ".mp4") {
												compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-c:v', videoEnc, '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
											}
											else if (outputType === ".webm") {
												compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-c:v', videoEnc, '-c:a', audioEnc, '-quality', 'good', '-cpu-used', '1', '-qmin', '10', '-qmax', '42', '-threads', '4', '-y', finalOutput];
											}
										}
										compositeVideo(compositeOptions, videoMetaData, function() {
											fs.unlinkSync(tmpVideo);
											fs.unlinkSync(tmpAudio);
											console.log("Finished!");
										});
									}
								});
							}
							else {
								if (outputType === inputVType) {
									compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-c:v', 'copy', '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
								}
								else {
									if (outputType === ".mp4") {
										compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-c:v', videoEnc, '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
									}
									else if (outputType === ".webm") {
										compositeOptions = ['-i', tmpVideo, '-i', tmpAudio, '-c:v', videoEnc, '-c:a', audioEnc, '-quality', 'good', '-cpu-used', '1', '-qmin', '10', '-qmax', '42', '-threads', '4', '-y', finalOutput];
									}
								}
								compositeVideo(compositeOptions, videoMetaData, function() {
									fs.unlinkSync(tmpVideo);
									fs.unlinkSync(tmpAudio);
									console.log("Finished!");
								});
							}
						});
					}
					else {
						var compositeOptions;
						if (commander.removeBorders === true) {
							checkForBlackBorders(tmpVideo, videoMetaData, function(crop) {
								if (crop !== null) {
									if (outputType === ".mp4") {
										compositeOptions = ['-i', tmpVideo, '-vf', crop, '-c:v', videoEnc, '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
									}
									else if (outputType === ".webm") {
										compositeOptions = ['-i', tmpVideo, '-vf', crop, '-c:v', videoEnc, '-c:a', audioEnc, '-quality', 'good', '-cpu-used', '1', '-qmin', '10', '-qmax', '42', '-threads', '4', '-y', finalOutput];
									}
									compositeVideo(compositeOptions, videoMetaData, function() {
										fs.unlinkSync(tmpVideo);
										console.log("Finished!");
									});
								}
								else {
									if (outputType === inputVType) {
										fs.renameSync(tmpVideo, finalOutput);
										console.log("Finished!");
									}
									else {
										if (outputType === ".mp4") {
											compositeOptions = ['-i', tmpVideo, '-c:v', videoEnc, '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
										}
										else if (outputType === ".webm") {
											compositeOptions = ['-i', tmpVideo, '-c:v', videoEnc, '-c:a', audioEnc, '-quality', 'good', '-cpu-used', '1', '-qmin', '10', '-qmax', '42', '-threads', '4', '-y', finalOutput];
										}
										compositeVideo(compositeOptions, videoMetaData, function() {
											fs.unlinkSync(tmpVideo);
											console.log("Finished!");
										});
									}
								}
							});
						}
						else {
							if (outputType === inputVType) {
								fs.renameSync(tmpVideo, finalOutput);
								console.log("Finished!");
							}
							else {
								if (outputType === ".mp4") {
									compositeOptions = ['-i', tmpVideo, '-c:v', videoEnc, '-c:a', audioEnc, '-threads', '4', '-y', '-strict', 'experimental', finalOutput];
								}
								else if (outputType === ".webm") {
									compositeOptions = ['-i', tmpVideo, '-c:v', videoEnc, '-c:a', audioEnc, '-quality', 'good', '-cpu-used', '1', '-qmin', '10', '-qmax', '42', '-threads', '4', '-y', finalOutput];
								}
								compositeVideo(compositeOptions, videoMetaData, function() {
									fs.unlinkSync(tmpVideo);
									console.log("Finished!");
								});
							}
						}
					}
				});
			});
		}
	});
}
catch (exception) {
	console.log("YouTube video not found: " + ytURL);
	process.exit(0);
}

function downloadFile(reqURL, outFile, callback) {
	var req;
	var reqSize = 0;
	var progress = 0;
	process.stdout.write("Downloading: [                                        ]");
	
	req = request(reqURL);
	req.on('response', function(data){
		reqSize = data.headers['content-length'];
	});
	req.on('data', function(chunk) {
		progress += chunk.length;
		var percent = parseInt(40 * (progress / reqSize), 10);
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write("Downloading: [" + initString("#", percent) + initString(" ", 40-percent) + "]");
	});
	req.on('end', function() {
		process.stdout.write("\n");
		callback();
	})
	req.pipe(fs.createWriteStream(outFile));
}

function checkForBlackBorders(video, metadata, callback) {
	var seekTime = parseInt(metadata.duration / 2, 10);

	exec('ffmpeg -ss ' + seekTime + ' -i ' + video + ' -vframes 10 -vf cropdetect -f null -', function(error, stdout, stderr) {
		if (error) throw error;

		var lines = stderr.split("\n");
		var crop = [];
		for (j=0; j<lines.length; j++) {
			if (lines[j].indexOf('Parsed_cropdetect_0') >= 0) {
				crop.push(lines[j].split(" ")[13]);
			}
		}
		if (allEqual(crop) === true) {
			var dims = crop[0].split("=")[1].split(":");
			if (parseInt(dims[0], 10) < (metadata.width-8) || parseInt(dims[1], 10) < (metadata.height-8)) {
				callback(crop[0]);
			}
			else {
				callback(null);
			}
		}
		else {
			callback(null);
		}
	});
}

function compositeVideo(options, metadata, callback) {
	process.stdout.write("Compositing: [                                        ]");

	var cmd = spawn('ffmpeg', options);
	cmd.on('error', function(err) {
		throw err;
	});
	cmd.stdout.on('data', function (data) {
		//console.log('stdout: ' + data);
	});

	cmd.stderr.on('data', function (data) {
		var output = data.toString();
		var framePos = output.indexOf("frame=");
		if (framePos >= 0) {
			var tmpout = output.substring(framePos+6, output.length).trim();
			var frame = parseInt(tmpout.substring(0, tmpout.indexOf(" ")), 10);
			var percent = parseInt(40 * (frame / metadata.nframes), 10);
			process.stdout.clearLine();
			process.stdout.cursorTo(0);
			process.stdout.write("Compositing: [" + initString("#", percent) + initString(" ", 40-percent) + "]");
		}
	});

	cmd.on('close', function (code) {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write("Compositing: [########################################]\n");
		callback();
	});
}

function initString(char, length) {
	var i;
	var str = "";
	for (i=0; i<length; i++) {
		str += char;
	}
	return str;
}

function allEqual(arr) {
	var i;
	for (i=1; i<arr.length; i++) {
		if (arr[i] !== arr[0])
			return false;
	}
	return true;
}

function guid() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
