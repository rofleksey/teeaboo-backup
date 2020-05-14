/* eslint-disable no-unused-vars */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const getUrls = require('get-urls');
const cheerio = require('cheerio');
const download = require('download');
const { exec } = require('child_process');
const { throttle } = require('lodash');

const apiKey = process.env.YOUTUBE_API_KEY;
const megaEmail = process.env.MEGA_EMAIL;
const megaPass = process.env.MEGA_PASS;
const apiPrefix = 'https://www.googleapis.com/youtube/v3/';
const channelId = 'UCcAJb3qfTvEZdDl6tOv0nfA';

if (!apiKey) {
  console.error('YOUTUBE_API_KEY env var is undefined!');
  process.exit(1);
}

if (!megaEmail || !megaPass) {
  console.warn('MEGA_EMAIL or MEGA_PASS env vars are undefined!');
}

if (!process.send) {
  process.send = (a, cb) => {
    console.log(JSON.stringify(a, null, 1));
    if (cb) {
      cb();
    }
  };
}

async function listCommand(count) {
  const response = await axios.get(`${apiPrefix}search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${count}`);
  await new Promise((res) => process.send({
    result: response.data,
  }, res));
  console.log(`Retreived ${response.data.items ? response.data.items.length : 'unknown number of'} items!`);
}

async function downloadYoutube(id, output) {
  process.send({
    status: 'Downloading youtube video...',
  });
  await new Promise((res, rej) => {
    console.log('Downloading youtube video...');
    const command = `youtube-dl 'https://www.youtube.com/watch?v=${id}' -f 'bestvideo+bestaudio[ext=m4a]/bestvideo+bestaudio/best' --merge-output-format mp4 --output '${path.join(output, 'youtube.mp4')}'`;
    console.log(command);
    const updateStatus = throttle((status) => {
      process.send({
        status,
      });
    }, 15000);
    const cp = exec(command, (e, out) => {
      updateStatus.flush();
      if (e) {
        rej(out);
      }
      res();
    });
    cp.stdout.on('data', (data) => {
      updateStatus(data.toString().replace('[download]', '[youtube]'));
    });
  });
}

async function downloadBitchute(url, output) {
  process.send({
    status: 'Downloading bitchute video...',
  });
  console.log('Downloading bitchute video...');
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const downloadUrl = $('video source').attr('src');
  await download(downloadUrl, output, {
    filename: 'bitchute.mp4',
  });
}

async function downloadMega(url, output) {
  if (!megaEmail || !megaPass) {
    throw new Error('MEGA credentials are not defined, skipping...');
  }
  process.send({
    status: 'Downloading mega video...',
  });
  const filePath = path.join(output, 'mega.mp4');
  const before = Date.now();
  const fastSkipped = await new Promise((res, rej) => {
    const updateStatus = throttle((status) => {
      process.send({
        status,
      });
    }, 15000);
    const cp = exec(`megatools dl --username '${megaEmail}' --password '${megaPass}' --path '${filePath}' '${url}'`, (e, out, stderr) => {
      updateStatus.flush();
      if (e) {
        if (stderr.toString().includes('File already exists')) {
          console.log('MEGA file already downloaded!');
          res(true);
          return;
        }
        rej(stderr);
      }
      res(false);
    });
    cp.stdout.on('data', (data) => {
      const status = data.toString().trim();
      if (status.length > 0) {
        updateStatus(`[mega] ${data.toString()}`);
      }
    });
  });
  if (!fastSkipped && Date.now() - before < 5000) {
    throw new Error('unexpected megatools error!');
  }
}

function getVideoIdFromLink(url) {
  const regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : null;
}


async function extractLinks(id) {
  const response = await axios.get(`${apiPrefix}videos?key=${apiKey}&id=${id}&part=snippet`);
  const { description } = response.data.items[0].snippet;
  const urlsSet = getUrls(description);
  return Array.from(urlsSet);
}

async function videoCommand(id, output) {
  const links = await extractLinks(id);
  process.send({
    status: 'Downloading youtube thumbnail...',
  });
  await new Promise((res, rej) => {
    console.log('Downloading youtube thumbnail...');
    const command = `youtube-dl 'https://www.youtube.com/watch?v=${id}' --write-thumbnail --skip-download --output '${path.join(output, 'thumbnail.jpg')}'`;
    console.log(command);
    exec(command, (e, out) => {
      if (e) {
        rej(out);
      }
      res();
    });
  });
  const validLinks = {
    bitchute: null,
    mega: null,
  };
  // eslint-disable-next-line no-restricted-syntax
  for (const link of links) {
    if (link.includes('bitchute')) {
      console.log(`>${link}`);
      validLinks.bitchute = link;
    } else if (link.includes('mega')) {
      console.log(`>${link}`);
      validLinks.mega = link;
    } else {
      console.log(link);
    }
  }

  if (!validLinks.mega && !validLinks.bitchute) {
    throw new Error('couldn\'t find any valid link!');
  }

  let usedMega = true;

  if (validLinks.mega) {
    try {
      await downloadMega(validLinks.mega, output);
    } catch (e) {
      console.log(`Failed to download MEGA: ${e}`);
      console.log('Downloading bitchute instead');
      usedMega = false;
      await downloadBitchute(validLinks.bitchute, output);
    }
  } else {
    console.log('No MEGA links found!');
    console.log('Downloading bitchute instead');
    usedMega = false;
    await downloadBitchute(validLinks.bitchute, output);
  }

  await downloadYoutube(id, output);

  await new Promise((res) => process.send({
    result: {
      usedMega,
    },
  }, res));

  console.log('Done');
  // fix async leak?
  process.exit(0);
}

function axiosErrorCatcher(e) {
  if (e.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error(e.response.data);
    console.error(e.response.status);
    console.error(e.response.headers);
  } else if (e.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.error(e.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Error', e.message);
  }
  process.send({
    error: 'connection error in downloader module',
  }, () => {
    process.exit(1);
  });
  // console.error(e.config);
}

function simpleErrorCatcher(e) {
  console.error(e);
  process.send({
    error: e.toString(),
  }, () => {
    process.exit(1);
  });
}

const { argv } = require('yargs')
  .scriptName('downloader')
  .command('list <count>', 'get list of videos', (yargs) => {
    yargs
      .positional('count', {
        describe: 'number of videos to retreive',
        type: 'number',
        demandOption: true,
      });
  }, (args) => {
    listCommand(args.count).catch(axiosErrorCatcher);
  })
  .command('video <id> <output>', 'download target video', (yargs) => {
    yargs
      .positional('id', {
        describe: 'id of the video to crawl',
        type: 'string',
        demandOption: true,
      })
      .positional('output', {
        describe: 'output directory',
        type: 'string',
        demandOption: true,
      });
  }, (args) => {
    videoCommand(args.id, args.output).catch(simpleErrorCatcher);
  })
  // .command('playlist <url>', 'crawl target playlist', (yargs) => {
  //   yargs
  //     .positional('url', {
  //       describe: 'url of the playlist to crawl',
  //       type: 'string',
  //       demandOption: true,
  //     })
  //     .positional('output', {
  //       describe: 'output directory',
  //       type: 'string',
  //       demandOption: true,
  //     });
  // }, (argv) => {
  //   console.log(`playlist: ${JSON.stringify(argv)}`);
  // })
  .demandCommand()
  .help();
