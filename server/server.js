/* eslint-disable no-await-in-loop */
const { v5: uuidv5 } = require('uuid');
const TimeAgo = require('javascript-time-ago');
const TimeAgoEn = require('javascript-time-ago/locale/en');
const express = require('express');
const bodyParser = require('body-parser');
const sanitize = require('sanitize-filename');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { fork } = require('child_process');
const { drive, mem, cpu } = require('node-os-utils');
const rimraf = require('rimraf');

const VIDEO_HISTORY_SIZE = 45;

const consoleArgs = require('yargs')
  .scriptName('server')
  .option('m', {
    alias: 'manual',
    describe: 'runs server in manual mode',
    type: 'boolean',
    default: false,
  })
  .option('s', {
    alias: 'size',
    describe: 'maximum history size',
    type: 'number',
    default: VIDEO_HISTORY_SIZE,
  })
  .help()
  .argv;


const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

const app = express();
const port = 2020;
const VIDEO_CHECK_INTERVAL = 1000 * 60 * 20;
const NAMESPACE = 'd9d88ddb-af7e-4e34-83bb-dafc12f56b47';
const DATA_DIR = '../data';
const INFO_UPDATE_INTERVAL = 10 * 1000;

let cpuUsage = 0;
let driveInfo = 0;
let memInfo = 0;
let lastInfoUpdate = 0;

TimeAgo.addLocale(TimeAgoEn);
const timeAgo = new TimeAgo('en-US');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

app.use(express.static(`${__dirname}/../dist`));
app.use('/data', express.static(`${__dirname}/../data`));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));

let queue = {};
let videos = [];

// eslint-disable-next-line no-unused-vars
let videoCheckTimeoutId = -1;
let curTask = null;

async function saveObjectToFile(obj, filename) {
  try {
    await writeFile(path.join(DATA_DIR, filename), JSON.stringify(obj, null, 1));
    console.log(`Updated ${filename}!`);
  } catch (e) {
    console.error(`Failed to save object to ${filename}: ${e}`);
  }
}

async function loadObjectFromFile(filename, def) {
  const file = path.join(DATA_DIR, filename);
  if (await exists(file)) {
    console.log(`Loading ${filename}...`);
    const content = await readFile(file);
    return JSON.parse(content.toString().trim());
  }
  console.log(`${filename} doesn't exist, using default`);
  return def;
}

async function runExternalNode(name, command, args, messageCb) {
  return new Promise((res, rej) => {
    const externalNode = fork(command, args);
    let output = null;
    externalNode.on('message', (message) => {
      if (message.result) {
        output = message.result;
      }
    });
    externalNode.on('close', (code) => {
      console.log(`${name} exited with code ${code}`);
      if (code === 0) {
        res({ code, output });
      } else {
        rej(new Error(code));
      }
    });
    if (messageCb) {
      externalNode.on('message', messageCb);
    }
  });
}

async function addItemsToQueue(items) {
  let newTasks = 0;
  if (items) {
    items.reverse().forEach((item) => {
      try {
        if (
          queue.array.findIndex((task) => task.id === (item.id.videoId || item.id)) < 0
        ) {
          const vIndex = videos.findIndex((v) => v.id === (item.id.videoId || item.id));
          if (vIndex >= 0 && videos[vIndex].status === 'ready') {
            queue.array.push({
              type: 'youtube',
              id: item.id.videoId || item.id,
              name: sanitize(item.snippet.title),
              status: 'ready',
              statusText: 'Ready!',
              time: videos[vIndex].time,
            });
          } else {
            queue.array.push({
              type: 'youtube',
              id: item.id.videoId || item.id,
              name: sanitize(item.snippet.title),
              status: 'pending',
              statusText: 'Pending',
              time: Date.now(),
            });
          }
          newTasks += 1;
        }
      } catch (e) {
        console.error(`Error parsing video info: ${e}`);
      }
    });
    await saveObjectToFile(queue, 'queue.json');
  }
  return newTasks;
}

async function checkVideos() {
  console.log('Checking for new videos...');
  let resultCode = 1;
  let resultOutput = null;
  try {
    const { code, output } = await runExternalNode('Checker', 'downloader/downloader.js', ['list', `${consoleArgs.size}`]);
    resultCode = code;
    resultOutput = output;
  } catch (e) {
    console.warn(e);
  }
  if (resultCode === 0) {
    videoCheckTimeoutId = setTimeout(checkVideos, VIDEO_CHECK_INTERVAL);
    const newTasks = await addItemsToQueue(resultOutput.items);
    console.log(`Queued ${newTasks} new videos!`);
  } else {
    console.warn('Failed to queue new videos!');
  }
}

function messagesHandler(task, video) {
  const taskArg = task;
  const videoArg = video;
  return (message) => {
    if (message.status) {
      console.log(`Received status '${message.status}' for task ${taskArg.name}`);
      taskArg.statusText = message.status;
      videoArg.statusText = message.status;
    } else if (message.error) {
      console.warn(`Error for task ${taskArg.name}: ${message.error}`);
      videoArg.statusText = 'Error occured :(';
      videoArg.status = 'error';
      taskArg.statusText = message.error;
      taskArg.status = 'error';
    }
  };
}

async function cleanupVideos() {
  try {
    while (videos.length > consoleArgs.size) {
      if (videos[0].status === 'processing') {
        return;
      }
      const video = videos.shift();
      console.log(`Deleting video with id=${video.id}...`);
      const task = queue.array.find((t) => t.id === video.id);
      if (video.folder) {
        const videoDir = path.join(DATA_DIR, video.folder);
        await new Promise((res, rej) => {
          rimraf(videoDir, (err) => {
            if (err) {
              rej(err);
            }
            res();
          });
        });
      }
      if (task) {
        task.status = 'deleted';
        task.statusText = 'Deleted';
        task.time = Date.now();
        await saveObjectToFile(queue, 'queue.json');
      }
      await saveObjectToFile(videos, 'videos.json');
    }
  } catch (e) {
    console.error(`Error while cleaning up videos: ${e}`);
  }
}

async function executeTask(task) {
  curTask = task;
  if (task.type === 'youtube') {
    curTask.status = 'processing';
    curTask.statusText = 'Initializing...';
    curTask.time = Date.now();
    const oldVideo = videos.find((v) => v.id === task.id);
    const video = oldVideo || {
      name: task.name,
      id: task.id,
      status: 'processing',
      statusText: 'Initializing...',
      time: Date.now(),
    };
    if (!oldVideo) {
      videos.push(video);
    } else {
      video.status = 'processing';
      video.statusText = 'Reinitializing...';
      video.time = Date.now();
    }
    try {
      const actualFolderName = uuidv5(task.name, NAMESPACE);
      const videoDir = path.join(DATA_DIR, actualFolderName);
      if (!await exists(videoDir)) {
        await mkdir(videoDir);
      }
      video.thumbnail = path.join(videoDir, 'thumbnail.jpg');
      console.log(`Downloading ${task.name}...`);
      const { code: downloaderCode, output: downloadOutput } = await runExternalNode(
        'Downloader',
        './downloader/downloader.js',
        ['video', JSON.stringify(task.id.toString()), videoDir],
        messagesHandler(task, video),
      );
      if (downloaderCode === 0) {
        console.log(`Successfully downloaded ${task.name}!`);
      } else {
        throw new Error(`Failed to download ${task.name}!`);
      }
      console.log(`Compiling ${task.name}...`);
      const youtubeVideo = path.join(videoDir, 'youtube.mp4');
      const reactionVideo = downloadOutput.usedMega ? path.join(videoDir, 'mega.mp4') : path.join(videoDir, 'bitchute.mp4');
      const { code: compilerCode, output: compilerOutput } = await runExternalNode(
        'Compiler',
        './compiler/compiler.js',
        ['-t', youtubeVideo, '-e', reactionVideo, '-o', videoDir],
        messagesHandler(task, video),
      );
      if (compilerCode === 0) {
        console.log(`Successfully compiled ${task.name}!`);
      } else {
        throw new Error(`Failed to compile ${task.name}!`);
      }
      console.log('Deleting original files...');
      if (fs.existsSync(youtubeVideo)) {
        await unlink(youtubeVideo);
      }
      if (fs.existsSync(reactionVideo)) {
        await unlink(reactionVideo);
      }
      video.status = 'ready';
      video.statusText = 'Ready';
      video.folder = actualFolderName;
      video.files = compilerOutput.map((file) => `${file}.mp4`);
      curTask.status = 'ready';
      curTask.statusText = 'Ready!';
    } catch (e) {
      console.warn(`Failed to process task ${task.name}: ${e}`);
      if (video.status !== 'error') {
        video.status = 'error';
        video.statusText = e.toString();
      }
      if (curTask.status !== 'error') {
        curTask.status = 'error';
        curTask.statusText = e.toString();
      }
    } finally {
      video.time = Date.now();
      curTask.time = Date.now();
      await saveObjectToFile(videos, 'videos.json');
    }
  }
}

async function handleManualRequest(req) {
  let commandType = '';
  if (req.single) {
    commandType = 'single';
  } else if (req.playlist) {
    commandType = 'playlist';
  }
  const id = req.single || req.playlist;
  let resultCode = 1;
  let resultOutput = null;
  try {
    const { code, output } = await runExternalNode('Checker', 'downloader/downloader.js', [commandType, `${id}`]);
    resultCode = code;
    resultOutput = output;
  } catch (e) {
    console.warn(e);
  }
  if (resultCode === 0) {
    videoCheckTimeoutId = setTimeout(checkVideos, VIDEO_CHECK_INTERVAL);
    const newTasks = await addItemsToQueue(resultOutput.items);
    console.log(`Queued ${newTasks} new videos!`);
  } else {
    console.warn('Failed to queue new videos!');
  }
}

function delay(time) {
  return new Promise((res) => setTimeout(res, time));
}

// function sortVideos() {
//   const indexedVideos = videos.map((video) => {
//     const index = queue.array.findIndex((task) => task.id === video.id);
//     return {
//       video,
//       pos: index < 0 ? Infinity : index,
//     };
//   });
//   videos = sortBy(indexedVideos, (v) => v.pos).map((v) => v.video);
// }

async function mainLoop() {
  queue = await loadObjectFromFile('queue.json', {
    array: [],
    pointer: 0,
  });
  queue.pointer = 0;
  videos = await loadObjectFromFile('videos.json', []);
  // sortVideos();
  if (!consoleArgs.manual) {
    checkVideos().catch((e) => {
      console.error(e);
    });
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await cleanupVideos();
    if (queue.pointer < queue.array.length) {
      const task = queue.array[queue.pointer];
      try {
        if (task.status !== 'ready' && task.status !== 'deleted') {
          await executeTask(task);
          console.log(`Task finished! ${queue.array.length - queue.pointer - 1} remaining`);
          await delay(1000);
        } else {
          console.log(`Task is already finished! ${queue.array.length - queue.pointer - 1} remaining`);
        }
      } catch (e) {
        console.error(e);
        await delay(1000);
      } finally {
        queue.pointer += 1;
        await saveObjectToFile(queue, 'queue.json');
      }
    } else {
      await delay(1000);
    }
  }
}

app.get('/api/watch', async (req, res) => {
  try {
    const video = videos.find((v) => v.folder === req.query.id);
    if (!video) {
      throw new Error('Can\'t find video with target id!');
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(video.files));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get('/api/videos', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(videos.map((v) => ({ ...v, time: timeAgo.format(v.time || 0) }))));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.post('/api/add', async (req, res) => {
  try {
    console.log(req.body);
    await handleManualRequest(req.body);
    res.end('OK');
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get('/api/queue', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      array: queue.array.map((t) => ({ ...t, time: timeAgo.format(t.time || 0) })),
      pointer: queue.pointer,
      manualMode: consoleArgs.manual,
    }));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.get('/api/info', async (req, res) => {
  try {
    if (Date.now() - lastInfoUpdate > INFO_UPDATE_INTERVAL) {
      [cpuUsage, driveInfo, memInfo] = await Promise.all([cpu.usage(), drive.info(), mem.info()]);
      lastInfoUpdate = Date.now();
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      cpuUsage,
      driveInfo,
      memInfo,
    }));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.post('/api/admin', async (req, res) => {
  try {
    // res.status(200).end({
    //   array: queue.array.map((t) => ({ ...t, time: timeAgo.format(t.time || 0) })),
    //   pointer: queue.pointer,
    // });
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.listen(port);

console.log(`Server running on port ${port}!`);

mainLoop().catch((e) => {
  console.error(e);
});
