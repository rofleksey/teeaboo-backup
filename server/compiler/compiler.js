const ffmpeg = require('fluent-ffmpeg');

const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

const { VideoSplitter } = require('./videoSplitter');

if (!process.send) {
  process.send = (a, cb) => {
    console.log(JSON.stringify(a, null, 1));
    if (cb) {
      cb();
    }
  };
}

const mkdir = promisify(fs.mkdir);

const minBlackDurationSeconds = 60;
const maxCreditsSearchSeconds = 20;
const minCreditsSearchSeconds = 1;
const fullBlackCountThreshold = 0.75;
const fullBlackColorThreshold = 0.04;
const reactionFromYoutubeSafetySeconds = 30;

const [cropW, cropH, cropOffsetX, cropOffsetY] = [100, 3, 10, 10];
const timerTime = 5;
const speedUpTime = 20;
const speedUpFactor = 8;
const zoomTime = 2;
const zoomLateTime = 1;
const zoomFactor = 1.75;
const zoomSlowFactor = 1.6;
const expectedSize = [];

const args = yargs
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

async function findBlackIntervals(video, opts) {
  console.log('Searching black intervals...');
  const options = opts || {};
  console.log(`options: ${JSON.stringify(options)}`);
  const minDuration = options.minDuration || minBlackDurationSeconds;
  const ss = options.from ? `-ss ${options.from}` : '';
  const to = options.to ? `-to ${options.to - (options.from || 0)}` : '';
  const output = await new Promise((res, rej) => {
    const command = `ffmpeg ${ss} -i "${video}" ${to} -vf "crop=${cropW}:${cropH}:${cropOffsetX}:in_h-${cropH + cropOffsetY}, \
    blackdetect=d=${minDuration}:pic_th=${fullBlackCountThreshold}:pix_th=${fullBlackColorThreshold}" \
    -an -f null - 2>&1`;
    console.log(command);
    exec(command, (e, out) => {
      if (e) {
        rej(out);
      }
      res(out);
    });
  });
  return output
    .split('\n')
    .filter((line) => line.includes('blackdetect'))
    .map((line) => {
      const regex = /black_start:(.*?)\s+black_end:(.*?)\s+/g;
      const match = regex.exec(line);
      if (options.from) {
        return [options.from + Number(match[1]), options.from + Number(match[2])];
      }
      return [Number(match[1]), Number(match[2])];
    });
}

async function getYoutubeIntervals() {
  console.log('Getting youtube time intervals...');
  return findBlackIntervals(args.tee);
}

async function findTransition(video, from, to) {
  console.log('Searching for transition...');
  const res = await findBlackIntervals(video, {
    from,
    to,
    minDuration: 0.1,
  });
  if (res.length === 0) {
    return res;
  }
  return [res[0][0], res[res.length - 1][1]];
}

async function searchForCredits(video) {
  console.log('Checking for credits...');
  const res = await findTransition(
    video,
    minCreditsSearchSeconds,
    maxCreditsSearchSeconds,
  );
  if (res.length > 0) {
    console.log('Credits FOUND!');
  } else {
    console.log('Credits not found');
  }
  return res;
}

async function getReactionTimeIntervals(youtubeIntervals) {
  if (youtubeIntervals.length === 1) {
    const creditsDelta = await searchForCredits(args.tee);
    const start = creditsDelta.length === 0 ? 0 : creditsDelta[1];
    return [[start, -1]];
  }
  const result = [];
  const creditsDelta = await searchForCredits(args.tee);
  console.log(`credits: ${creditsDelta}`);
  let prevStart = creditsDelta.length === 0 ? 0 : creditsDelta[1];
  for (let i = 0; i < youtubeIntervals.length; i += 1) {
    console.log(`Getting reaction time interval ${i + 1}/${youtubeIntervals.length}`);
    const ytInterval = youtubeIntervals[i];
    const middle = ytInterval[1] - (ytInterval[0] - timerTime) + prevStart;
    if (i !== youtubeIntervals.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      const blackFrameInterval = await findTransition(
        args.e,
        middle - reactionFromYoutubeSafetySeconds,
        middle + reactionFromYoutubeSafetySeconds,
      );
      console.log(`${middle - reactionFromYoutubeSafetySeconds} - ${middle + reactionFromYoutubeSafetySeconds}`);
      if (blackFrameInterval.length === 0) {
        throw new Error(`Couldn't find reaction part #${i + 1}!`);
      }
      const [blackoutStart, blackoutFinish] = blackFrameInterval;
      result.push([prevStart, blackoutStart]);
      prevStart = blackoutFinish;
    } else {
      result.push([prevStart, -1]);
    }
  }
  return result;
}

async function generateVideo(youtubeIntervals, reactionIntervals) {
  console.log('Generating video...');
  const tempDir = path.join(args.o, 'temp');
  if (!fs.existsSync(tempDir)) {
    await mkdir(tempDir);
  }
  const videoSplitter = new VideoSplitter(tempDir, args.o);
  for (let i = 0; i < youtubeIntervals.length; i += 1) {
    const c = 'PTS-STARTPTS';
    const cBrackets = `(${c})`;
    const seconds = youtubeIntervals[i];
    const rInterval = reactionIntervals[i];
    const next = youtubeIntervals[i + 1] || null;
    if (i === 0) {
      videoSplitter.withFile(args.tee, 'intro', (cuts) => {
        // intro
        cuts.addPart(0, seconds[0] - speedUpTime - zoomTime);
        // speed up
        cuts.addPart(
          seconds[0] - speedUpTime - zoomTime,
          null,
          `[0:v]trim=end=${speedUpTime},setpts=${1 / speedUpFactor}*${cBrackets}[v];[0:a]atrim=end=${speedUpTime},asetpts=${c},atempo=${speedUpFactor}[a]`,
        );
        // zoom
        cuts.addPart(
          seconds[0] - zoomTime,
          null,
          `[0:v]trim=end=${zoomTime + zoomLateTime},setpts=${zoomSlowFactor}*${cBrackets},scale=${zoomFactor}*iw:-1,crop=iw/${zoomFactor}:ih/${zoomFactor}[v];[0:a]atrim=end=${zoomTime + zoomLateTime},asetpts=${c},atempo=${Math.max(0.5, 1 / zoomSlowFactor)}[a]`,
        );
      });
    }
    videoSplitter.withFile(args.e, `reaction${i + 1}`, (cuts) => {
      cuts.addPart(rInterval[0], rInterval[1] === -1 ? null : rInterval[1]);
    });
    videoSplitter.withFile(args.tee, `discussion${i + 1}`, (cuts) => {
      cuts.addPart(
        seconds[1],
        next === null ? null : next[0] - zoomTime,
      );
    });
  }
  return videoSplitter.process(false);
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
  try {
    process.send({
      status: 'Analyzing videos...',
    });
    await determineTeeSize();
    const youtubeIntervals = await getYoutubeIntervals();
    console.log(youtubeIntervals);
    const reactionIntervals = await getReactionTimeIntervals(youtubeIntervals);
    if (reactionIntervals.length !== youtubeIntervals.length) {
      throw new Error(`Reaction intervals count (${reactionIntervals.length}) is not the same as youtube count (${youtubeIntervals.length})`);
    }
    process.send({
      status: 'Generating video...',
    });
    const result = await generateVideo(youtubeIntervals, reactionIntervals);
    process.send({
      result,
    });
  } catch (e) {
    console.error(e);
    process.send({
      error: e.toString(),
    }, () => {
      process.exit(1);
    });
  }
})().catch((e) => {
  console.error(e);
  process.send({
    error: e.toString(),
  }, () => {
    process.exit(1);
  });
});
