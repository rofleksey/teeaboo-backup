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

const exists = util.promisify(fs.exists);
const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const app = express();
const port = 2020;
const VIDEO_CHECK_INTERVAL = 1000 * 60 * 30;
const VIDEO_HISTORY_SIZE = 15;
const NAMESPACE = 'd9d88ddb-af7e-4e34-83bb-dafc12f56b47';
const DATA_DIR = '../data';
const INFO_UPDATE_INTERVAL = 4 * 1000;

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

async function checkVideos() {
  console.log('Checking for new videos...');
  let resultCode = 1;
  let resultOutput = null;
  try {
    const { code, output } = await runExternalNode('Checker', 'downloader/downloader.js', ['list', `${VIDEO_HISTORY_SIZE}`]);
    resultCode = code;
    resultOutput = output;
  } catch (e) {
    console.warn(e);
  }
  if (resultCode === 0) {
    videoCheckTimeoutId = setTimeout(checkVideos, VIDEO_CHECK_INTERVAL);
    let newTasks = 0;
    if (resultOutput.items) {
      resultOutput.items.reverse().forEach((item) => {
        try {
          if (
            queue.array.findIndex((task) => task.id === item.id.videoId) < 0
            && videos.findIndex((v) => v.id === item.id.videoId) < 0
          ) {
            queue.array.push({
              type: 'youtube',
              id: item.id.videoId,
              name: sanitize(item.snippet.title),
              status: 'pending',
              statusText: 'Pending',
              time: Date.now(),
            });
            newTasks += 1;
          }
        } catch (e) {
          console.error(`Error parsing video info: ${e}`);
        }
      });
      await saveObjectToFile(queue, 'queue.json');
    }
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
    }
  };
}

async function executeTask(task) {
  curTask = task;
  if (task.type === 'youtube') {
    curTask.status = 'processing';
    curTask.statusText = 'Initializing...';
    const video = {
      name: task.name,
      id: task.id,
      status: 'processing',
      statusText: 'Initializing...',
      date: Date.now(),
    };
    videos.push(video);
    try {
      const actualFolderName = uuidv5(task.name, NAMESPACE);
      const videoDir = path.join(DATA_DIR, actualFolderName);
      if (!await exists(videoDir)) {
        await mkdir(videoDir);
      }
      video.thumbnail = path.join(videoDir, 'thumbnail.jpg');
      console.log(`Downloading ${task.name}...`);
      const { code: downloaderCode } = await runExternalNode(
        'Downloader',
        './downloader/downloader.js',
        ['video', task.id.toString(), videoDir],
        messagesHandler(task, video),
      );
      if (downloaderCode === 0) {
        console.log(`Successfully downloaded ${task.name}!`);
      } else {
        throw new Error(`Failed to download ${task.name}!`);
      }
      console.log(`Compiling ${task.name}...`);
      const youtubeVideo = path.join(videoDir, 'youtube.mp4');
      const bitchuteVideo = path.join(videoDir, 'bitchute.mp4');
      const { code: compilerCode } = await runExternalNode(
        'Compiler',
        './compiler/compiler.js',
        ['-t', youtubeVideo, '-e', bitchuteVideo, '-o', videoDir],
        messagesHandler(task, video),
      );
      if (compilerCode === 0) {
        console.log(`Successfully compiled ${task.name}!`);
      } else {
        throw new Error(`Failed to compile ${task.name}!`);
      }
      video.status = 'ready';
      video.statusText = 'Ready';
      video.folder = actualFolderName;
      video.file = 'full.mp4';
      video.link = `/data/${actualFolderName}/full.mp4`;
      curTask.status = 'ready';
      curTask.statusText = 'Ready!';
    } catch (e) {
      console.warn(`Failed to process task ${task.name}: ${e}`);
      video.status = 'error';
      video.statusText = 'Error occured :(';
      curTask.status = 'error';
      curTask.statusText = e.toString();
    } finally {
      video.time = Date.now();
      curTask.time = Date.now();
      await saveObjectToFile(videos, 'videos.json');
    }
  }
}

function delay(time) {
  return new Promise((res) => setTimeout(res, time));
}

async function mainLoop() {
  queue = await loadObjectFromFile('queue.json', {
    array: [],
    pointer: 0,
  });
  videos = await loadObjectFromFile('videos.json', []);
  checkVideos().catch((e) => {
    console.error(e);
  });
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (queue.pointer < queue.array.length) {
      const task = queue.array[queue.pointer];
      try {
        await executeTask(task);
        console.log(`Task finished! ${queue.array.length - queue.pointer - 1} remaining`);
      } catch (e) {
        console.error(e);
      } finally {
        queue.pointer += 1;
        await saveObjectToFile(queue, 'queue.json');
      }
    }
    await delay(1000);
  }
}

app.get('/api/videos', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(videos.map((v) => ({ ...v, time: timeAgo.format(v.time || 0) }))));
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
