const ffmpeg = require('fluent-ffmpeg');
const tmp = require('tmp');
const Jimp = require('jimp');
const cliProgress = require('cli-progress');

const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

const framesPerSecond = 4;
const frameInterval = 1000 / framesPerSecond;
const minBlackDurationSeconds = 60;
const minBlackFrames = minBlackDurationSeconds * framesPerSecond;
const colorThreshold = 3;
const [cropW, cropH, cropOffsetX, cropOffsetY] = [100, 3, 10, 10];
const speedUpTime = 15;
const speedUpFactor = 8;
const zoomTime = 2;
const zoomLateTime = 1;
const zoomFactor = 1.75;
const zoomSlowFactor = 1.6;
const expectedSize = [1280, 720];

const args = require('yargs')
  .scriptName('compiler')
  .option('e', {
    alias: 'episode',
    demandOption: true,
    describe: 'path to episode',
    type: 'string',
    array: true,
  })
  .option('t', {
    alias: 'tee',
    demandOption: true,
    describe: 'path to teeaboo video',
    type: 'string',
  })
  .option('d', {
    alias: 'dir',
    describe: 'temp directory to use (for testing only)',
    type: 'string',
  })
  .help()
  .argv;

function extractThumbnails(folder, video) {
  console.log('Extracting thumbnails...');
  return new Promise((res, rej) => {
    const bar = new cliProgress.SingleBar({
      hideCursor: true,
    }, cliProgress.Presets.shades_classic);
    bar.start(100);
    let lastPercentage = 0;
    ffmpeg(video, {
      // stdoutLines: Infinity,
    })
      .videoFilters([
        `fps=${framesPerSecond}`,
        `crop=${cropW}:${cropH}:${cropOffsetX}:in_h-${cropH + cropOffsetY}`,
        'showinfo',
      ])
      .on('end', () => {
        bar.stop();
        res();
      })
      .on('progress', (info) => {
        const ceiledPercent = Math.ceil(info.percent);
        if (ceiledPercent !== lastPercentage) {
          lastPercentage = ceiledPercent;
          bar.increment();
        }
      })
      .on('error', (e) => {
        bar.stop();
        rej(e);
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

async function getReactionIntervals(folder) {
  console.log('Getting reaction time intervals...');
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const sortedImages = await findImagesInDir(folder);
  const result = [];
  let lastBlack = -1;
  bar.start(sortedImages.length);
  try {
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
          console.log('\nFound potential start of the reaction');
          lastBlack = i;
        }
      } else if (lastBlack !== -1) {
        if (i - lastBlack > minBlackFrames) {
          result.push([lastBlack, i - 1]);
          if (result.length === args.e.length) {
            return result;
          }
        } else {
          console.log('\nPotential reaction interval is too short, discarded');
        }
        lastBlack = -1;
      }
      bar.increment();
    }
    if (lastBlack !== -1) {
      result.push([lastBlack, sortedImages.length - 1]);
    }
    return result;
  } finally {
    bar.stop();
  }
}

function testInterval(video, episode, interval) {
  console.log('Generating video...');
  const seconds = interval.map((it) => (it * frameInterval) / 1000);
  return new Promise((res, rej) => {
    const bar = new cliProgress.SingleBar({
      hideCursor: true,
    }, cliProgress.Presets.shades_classic);
    bar.start(100);
    let lastPercentage = 0;
    const c = 'PTS-STARTPTS';
    const cBrackets = `(${c})`;
    ffmpeg(video, {
      // stdoutLines: Infinity,
    })
      .input(episode)
      .complexFilter([
        `[0:v]trim=0:${seconds[0] - speedUpTime - zoomTime},setpts=${c}[before]`,
        `[0:v]trim=${seconds[0] - speedUpTime - zoomTime}:${seconds[0] - zoomTime},setpts=${1 / speedUpFactor}*${cBrackets}[speedUp]`,
        `[0:v]trim=${seconds[0] - zoomTime}:${seconds[0] + zoomLateTime},scale=${zoomFactor}*iw:-1,crop=iw/${zoomFactor}:ih/${zoomFactor},setpts=${zoomSlowFactor}*${cBrackets}[zoom]`,
        `[1:v]scale=${expectedSize[0]}:${expectedSize[1]},setpts=${c}[reaction]`,
        `[0:v]trim=start=${seconds[1]},setpts=${c}[after]`,
        `[0:a]atrim=0:${seconds[0] - speedUpTime - zoomTime},asetpts=${c}[beforeA]`,
        `[0:a]atrim=${seconds[0] - speedUpTime - zoomTime}:${seconds[0] - zoomTime},asetpts=${c},atempo=${speedUpFactor}[speedUpA]`,
        `[0:a]atrim=${seconds[0] - zoomTime}:${seconds[0] + zoomLateTime},asetpts=${c},atempo=${Math.max(0.5, 1 / zoomSlowFactor)}[zoomA]`,
        `[1:a]asetpts=${c}[reactionA]`,
        `[0:a]atrim=start=${seconds[1]},asetpts=${c}[afterA]`,
        '[before][beforeA][speedUp][speedUpA][zoom][zoomA][reaction][reactionA][after][afterA]concat=n=5:v=1:a=1[output]',
      ], 'output')
      .outputOptions([
        // `-ss ${seconds[0] - speedUpTime - zoomTime - 5}`,
        // '-t 30',
        '-threads 8',
        '-y',
      ])
      .on('start', (commandLine) => {
        console.error(`\n${commandLine}\n`);
      })
      .on('end', () => {
        bar.stop();
        res();
      })
      .on('progress', (info) => {
        const ceiledPercent = Math.ceil(info.percent);
        if (ceiledPercent !== lastPercentage) {
          lastPercentage = ceiledPercent;
          bar.increment();
        }
      })
      .on('error', (e) => {
        bar.stop();
        rej(e);
      })
      // .on('end', (stdout, stderr) => {
      //   console.log(stdout);
      //   console.log(stderr);
      // })
      .save('test.mp4');
  });
}

(async () => {
  const tmpFolder = tmp.dirSync();
  const tmpFolderPath = args.dir ? args.dir : tmpFolder.name;
  try {
    const images = await findImagesInDir(tmpFolderPath);
    if (images.length === 0) {
      await extractThumbnails(tmpFolderPath, args.tee);
    }
    const intervals = await getReactionIntervals(tmpFolderPath);
    console.log(intervals);
    await testInterval(args.tee, args.e[0], intervals[0]);
  } catch (e) {
    console.error(e);
  } finally {
    tmpFolder.removeCallback();
  }
})().finally(() => {
  //
});
