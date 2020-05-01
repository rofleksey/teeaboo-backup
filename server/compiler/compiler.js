const ffmpeg = require('fluent-ffmpeg');
const tmp = require('tmp');
const Jimp = require('jimp');

const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// TODO: fix temp files leak on process.exit and ctrl + c

const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);

const framesPerSecond = 4;
const searchForBlackFramesPerSecond = 20;
const minBlackDurationSeconds = 60;
const minBlackFrames = minBlackDurationSeconds * framesPerSecond;
const colorThreshold = 3;
const maxCreditsSearchSeconds = 20;
const minCreditsSearchSeconds = 1;
const fullBlackCountThreshold = 0.75;
const fullBlackColorThreshold = 10;
const reactionFromYoutubeSafetySeconds = 15;

const [cropW, cropH, cropOffsetX, cropOffsetY] = [100, 3, 10, 10];
const timerTime = 5;
const speedUpTime = 15;
const speedUpFactor = 8;
const zoomTime = 2;
const zoomLateTime = 1;
const zoomFactor = 1.75;
const zoomSlowFactor = 1.6;
const expectedSize = [];

const args = require('yargs')
  .scriptName('compiler')
  .option('e', {
    alias: 'episode',
    demandOption: true,
    describe: 'path to episode',
    type: 'string',
  })
  .option('t', {
    alias: 'tee',
    demandOption: true,
    describe: 'path to teeaboo video',
    type: 'string',
  })
  .option('o', {
    alias: 'output',
    demandOption: true,
    describe: 'output directory',
    type: 'string',
  })
  .help()
  .argv;

// ARGUMENTS AND RETURN VALUES SHOULD BE SECONDS EVERYWHERE!

function extractThumbnails(folder, video, opts) {
  console.log('Extracting thumbnails...');
  const options = opts || {};
  return new Promise((res, rej) => {
    let lastPercentage = 0;
    let command = ffmpeg(video, {
      // stdoutLines: Infinity,
    })
      .videoFilters([
        `fps=${opts.fps || framesPerSecond}`,
      ].concat(options.crop ? [`crop=${cropW}:${cropH}:${cropOffsetX}:in_h-${cropH + cropOffsetY}`] : []));
    if (options.from && options.to) {
      command = command
        .outputOptions([
          `-ss ${options.from}`,
          `-to ${options.to}`,
        ]);
    }
    command
      .on('end', res)
      .on('error', rej)
      .on('progress', (info) => {
        const ceiledPercent = Math.ceil(info.percent);
        if (ceiledPercent !== lastPercentage) {
          lastPercentage = ceiledPercent;
        }
      })
      // .on('end', (stdout, stderr) => {
      //   console.log(stdout);
      //   console.log(stderr);
      // })
      .save(path.join(folder, '%04d.bmp'));
  });
}

async function findImagesInDir(folder) {
  const images = await readdir(folder);
  const sortedImages = images.map((it) => [it, Number(it.replace('.bmp', ''))])
    .sort((a, b) => a[1] - b[1])
    .map((it) => path.join(folder, it[0]));
  return sortedImages;
}

// function formatFrame(frameNum) {
//   function pad(n, padLen) {
//     const actualPad = padLen || 2;
//     return `00${n}`.slice(-actualPad);
//   }
//   const totalMs = Math.floor(frameNum * frameInterval);
//   const ms = Math.floor(totalMs % 1000);
//   const seconds = Math.floor((totalMs / 1000) % 60);
//   const minutes = Math.floor((totalMs / 60000) % 60);
//   const hours = Math.floor(totalMs / 3600000);
//   if (hours > 0) {
//     return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
//   }
//   if (minutes > 0) {
//     return `${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
//   }
//   return `${pad(seconds)}.${pad(ms, 3)}`;
// }

async function getYoutubeIntervals(folder) {
  console.log('Getting youtube time intervals...');
  const sortedImages = await findImagesInDir(folder);
  const result = [];
  let lastBlack = -1;

  for (let i = 0; i < sortedImages.length; i += 1) {
    const imagePath = sortedImages[i];
    // eslint-disable-next-line no-await-in-loop
    const img = await Jimp.read(imagePath);
    let isBlack = true;
    for (let x = 0; x < img.getWidth(); x += 1) {
      const color = Jimp.intToRGBA(img.getPixelColor(x, img.getHeight() - 1));
      if (color.r > colorThreshold || color.g > colorThreshold || color.b > colorThreshold) {
        isBlack = false;
        break;
      }
    }
    if (isBlack) {
      if (lastBlack === -1) {
        console.log('Found potential start of the reaction');
        lastBlack = i;
      }
    } else if (lastBlack !== -1) {
      if (i - lastBlack > minBlackFrames) {
        result.push([lastBlack / framesPerSecond, (i - 1) / framesPerSecond]);
      } else {
        console.log('Potential reaction interval is too short, discarded');
      }
      lastBlack = -1;
    }
  }
  if (lastBlack !== -1) {
    result.push([lastBlack / framesPerSecond, (sortedImages.length - 1) / framesPerSecond]);
  }
  return result;
}

async function searchForBlackFrames(from, to, threshold) {
  console.log('Checking for black frames...');
  const tempFolder = tmp.dirSync();
  let lastBlack = -1;
  try {
    await extractThumbnails(tempFolder.name, args.e, {
      from,
      to,
      fps: searchForBlackFramesPerSecond,
      crop: true,
    });
    const sortedImages = await findImagesInDir(tempFolder.name);
    for (let i = 0; i < sortedImages.length; i += 1) {
      const imagePath = sortedImages[i];
      // eslint-disable-next-line no-await-in-loop
      const img = await Jimp.read(imagePath);
      let numberOfBlackFrames = 0;
      for (let x = 0; x < img.getWidth(); x += 1) {
        for (let y = 0; y < img.getHeight(); y += 1) {
          const color = Jimp.intToRGBA(img.getPixelColor(x, y));
          if (
            color.r < fullBlackColorThreshold
            && color.g < fullBlackColorThreshold
            && color.b < fullBlackColorThreshold
          ) {
            numberOfBlackFrames += 1;
          }
        }
      }
      if (numberOfBlackFrames > img.getWidth() * img.getHeight() * threshold) {
        if (lastBlack === -1) {
          lastBlack = i;
        }
      } else if (lastBlack !== -1) {
        return [
          from + lastBlack / searchForBlackFramesPerSecond,
          from + (i - 1) / searchForBlackFramesPerSecond,
        ];
      }
    }
    if (lastBlack !== -1) {
      return [
        from + lastBlack / searchForBlackFramesPerSecond,
        from + (sortedImages.length - 1) / searchForBlackFramesPerSecond,
      ];
    }
    return [];
  } finally {
    tempFolder.removeCallback();
  }
}

async function searchForCredits() { // returns frames
  console.log('Checking for credits...');
  return searchForBlackFrames(
    minCreditsSearchSeconds,
    maxCreditsSearchSeconds,
    fullBlackCountThreshold,
  );
}

async function getReactionTimeIntervals(youtubeIntervals) {
  if (youtubeIntervals.length === 1) {
    const creditsDelta = await searchForCredits();
    const start = creditsDelta.length === 0 ? 0 : creditsDelta[1];
    return [[start, -1]];
  }
  const tempFolder = tmp.dirSync();
  const result = [];
  const creditsDelta = await searchForCredits();
  console.log(`credits: ${creditsDelta}`);
  let prevStart = creditsDelta.length === 0 ? 0 : creditsDelta[1];
  try {
    for (let i = 0; i < youtubeIntervals.length; i += 1) {
      console.log(`Getting reaction time interval ${i + 1}/${youtubeIntervals.length}`);
      const ytInterval = youtubeIntervals[i];
      const middle = ytInterval[1] - (ytInterval[0] - timerTime) + prevStart;
      if (i !== youtubeIntervals.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        const blackFrameInterval = await searchForBlackFrames(
          middle - reactionFromYoutubeSafetySeconds,
          middle + reactionFromYoutubeSafetySeconds,
          fullBlackCountThreshold,
        );
        console.log(`${middle - reactionFromYoutubeSafetySeconds} - ${middle + reactionFromYoutubeSafetySeconds}`);
        if (blackFrameInterval.length === 0) {
          console.error(`Couldn't find reaction part #${i + 1}!`);
          process.exit(1);
        }
        const [blackoutStart, blackoutFinish] = blackFrameInterval;
        result.push([prevStart, blackoutStart]);
        prevStart = blackoutFinish;
      } else {
        result.push([prevStart, -1]);
      }
    }
    return result;
  } finally {
    tempFolder.removeCallback();
  }
}

async function generateVideo(youtubeIntervals, reactionIntervals) {
  console.log('Generating video...');
  for (let i = 0; i < youtubeIntervals.length; i += 1) {
    if (!fs.existsSync(path.join(args.o, `temp_part${i}.mp4`))) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res, rej) => {
        let lastPercentage = 0;
        const c = 'PTS-STARTPTS';
        const cBrackets = `(${c})`;
        const seconds = youtubeIntervals[i];
        const rInterval = reactionIntervals[i];
        const next = youtubeIntervals[i + 1] || null;
        const filters = (i === 0 ? [
          `[0:v]trim=0:${seconds[0] - speedUpTime - zoomTime},setpts=${c}[before]`,
          `[0:a]atrim=0:${seconds[0] - speedUpTime - zoomTime},asetpts=${c}[beforeA]`,
        ] : []).concat([
          `[0:v]trim=${seconds[0] - speedUpTime - zoomTime}:${seconds[0] - zoomTime},setpts=${1 / speedUpFactor}*${cBrackets}[speedUp]`,
          `[0:v]trim=${seconds[0] - zoomTime}:${seconds[0] + zoomLateTime},scale=${zoomFactor}*iw:-1,crop=iw/${zoomFactor}:ih/${zoomFactor},setpts=${zoomSlowFactor}*${cBrackets}[zoom]`,
          `[1:v]trim=start=${rInterval[0]}${rInterval[1] === -1 ? '' : `:end=${rInterval[1]}`},scale=${expectedSize[0]}:${expectedSize[1]},setpts=${c}[reaction]`,
          next === null ? `[0:v]trim=start=${seconds[1]},setpts=${c}[after]` : `[0:v]trim=${seconds[1]}:${next[0] - speedUpTime - zoomTime},setpts=${c}[after]`,
          // audio
          `[0:a]atrim=${seconds[0] - speedUpTime - zoomTime}:${seconds[0] - zoomTime},asetpts=${c},atempo=${speedUpFactor}[speedUpA]`,
          `[0:a]atrim=${seconds[0] - zoomTime}:${seconds[0] + zoomLateTime},asetpts=${c},atempo=${Math.max(0.5, 1 / zoomSlowFactor)}[zoomA]`,
          `[1:a]atrim=start=${rInterval[0]}${rInterval[1] === -1 ? '' : `:end=${rInterval[1]}`},asetpts=${c}[reactionA]`,
          next === null ? `[0:a]atrim=start=${seconds[1]},asetpts=${c}[afterA]` : `[0:a]atrim=${seconds[1]}:${next[0] - speedUpTime - zoomTime},asetpts=${c}[afterA]`,
        ]);
        const outputs = (i === 0 ? [
          'before', 'beforeA',
        ] : []).concat([
          'speedUp', 'speedUpA',
          'zoom', 'zoomA',
          'reaction', 'reactionA',
          'after', 'afterA',
        ]);
        const prefix = outputs.map((it) => `[${it}]`).join('');
        filters.push(`${prefix}concat=n=${Math.round(outputs.length / 2)}:v=1:a=1[output]`);
        ffmpeg(args.tee, {
          // stdoutLines: Infinity,
        })
          .input(args.e)
          .complexFilter(filters, 'output')
          .outputOptions([
            // `-ss ${seconds[0] - speedUpTime - zoomTime - 5}`,
            // '-t 30',
            '-y',
          ])
          .on('start', (commandLine) => {
            console.log(`\n${commandLine}\n`);
          })
          .on('end', res)
          .on('error', rej)
          .on('progress', (info) => {
            const ceiledPercent = Math.ceil(info.percent);
            if (ceiledPercent !== lastPercentage) {
              lastPercentage = ceiledPercent;
              process.send({
                status: `Generating part ${i + 1}/${youtubeIntervals.length} (${lastPercentage}%)...`,
              });
            }
          })
          // .on('end', (stdout, stderr) => {
          //   console.log(stdout);
          //   console.log(stderr);
          // })
          .save(path.join(args.o, `temp_part${i}.mp4`));
      });
    }
  }
  await writeFile(path.join(args.o, 'concat_list_temp.txt'), [...Array(youtubeIntervals.length).keys()].map(
    (it) => `file 'temp_part${it}.mp4'`,
  ).join('\n'));
  await new Promise((res, rej) => {
    let lastPercentage = 0;
    ffmpeg(path.join(args.o, 'concat_list_temp.txt'), {
      // stdoutLines: Infinity,
    })
      .inputOptions([
        '-safe 0',
        '-f concat',
        '-y',
      ])
      .outputOptions([
        '-c copy',
        '-movflags faststart',
      ])
      .on('start', (commandLine) => {
        console.log(`\n${commandLine}\n`);
      })
      .on('end', res)
      .on('error', rej)
      .on('progress', (info) => {
        const ceiledPercent = Math.ceil(info.percent);
        if (ceiledPercent !== lastPercentage) {
          lastPercentage = ceiledPercent;
        }
      })
      .save(path.join(args.o, 'full.mp4'));
  });
  console.log('Cleaning up...');
  [...Array(youtubeIntervals.length).keys()].forEach((it) => {
    fs.unlinkSync(path.join(args.o, `temp_part${it}.mp4`));
  });
  fs.unlinkSync(path.join(args.o, 'concat_list_temp.txt'));
}

async function determineTeeSize() {
  await new Promise((res, rej) => {
    ffmpeg.ffprobe(args.tee, (err, metadata) => {
      if (err) {
        rej(err);
        return;
      }
      const videoStream = metadata.streams.find((it) => it.width);
      if (!videoStream) {
        rej(new Error('Can\'t determine video size!'));
        return;
      }
      expectedSize.push(videoStream.width);
      expectedSize.push(videoStream.height);
      console.log(`Tee video size: ${expectedSize}`);
      res();
    });
  });
}

(async () => {
  const youtubeTempFolder = tmp.dirSync();
  const youtubeTempFolderPath = youtubeTempFolder.name;
  try {
    process.send({
      status: 'Analyzing videos...',
    });
    await determineTeeSize();
    // youtube
    const youtubeImages = await findImagesInDir(youtubeTempFolderPath);
    if (youtubeImages.length === 0) {
      await extractThumbnails(youtubeTempFolderPath, args.tee, {
        crop: true,
      });
    }
    const youtubeIntervals = await getYoutubeIntervals(youtubeTempFolderPath);
    console.log(youtubeIntervals);
    // reaction
    const reactionIntervals = await getReactionTimeIntervals(youtubeIntervals);
    if (reactionIntervals.length !== youtubeIntervals.length) {
      console.error(`Reaction intervals count (${reactionIntervals.length}) is not the same as youtube count (${youtubeIntervals.length})`);
      process.exit(1);
    }
    process.send({
      status: 'Generating video...',
    });
    await generateVideo(youtubeIntervals, reactionIntervals);
  } catch (e) {
    console.error(e);
  } finally {
    youtubeTempFolder.removeCallback();
  }
})().finally(() => {
  //
});
