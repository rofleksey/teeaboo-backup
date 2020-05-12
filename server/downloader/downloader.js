/* eslint-disable no-unused-vars */
const axios = require('axios');
const path = require('path');
const youtubedl = require('youtube-dl');
const getUrls = require('get-urls');
const cheerio = require('cheerio');
const download = require('download');

const apiKey = process.env.YOUTUBE_API_KEY || '';
const apiPrefix = 'https://www.googleapis.com/youtube/v3/';
const channelId = 'UCcAJb3qfTvEZdDl6tOv0nfA';

// QRajskbC-BQ

async function listCommand(count) {
  const response = await axios.get(`${apiPrefix}search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${count}`);
  process.send({
    result: response.data,
  });
  console.log(`Retreived ${response.data.items ? response.data.items.length : 'unknown number of'} items!`);
}

async function downloadYoutube(id, output) {
  process.send({
    status: 'Downloading youtube thumbnail...',
  });
  await new Promise((res, rej) => {
    console.log('Downloading youtube thumbnail...');
    youtubedl.exec(
      `https://www.youtube.com/watch?v=${id}`,
      ['--write-thumbnail', '--skip-download', '--output', path.join(output, 'thumbnail.jpg')],
      {},
      (err, msg) => {
        if (err) {
          rej(err);
        }
        console.log(msg.join('\n'));
        res();
      },
    );
  });
  process.send({
    status: 'Downloading youtube video...',
  });
  await new Promise((res, rej) => {
    console.log('Downloading youtube video...');
    youtubedl.exec(
      `https://www.youtube.com/watch?v=${id}`,
      ['-f', 'bestvideo+bestaudio[ext=m4a]/bestvideo+bestaudio/best', '--merge-output-format', 'mp4', '--output', path.join(output, 'youtube.mp4')],
      {},
      (err, msg) => {
        if (err) {
          rej(err);
        }
        console.log(msg.join('\n'));
        res();
      },
    );
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
  let bitchuteFound = false;
  // eslint-disable-next-line no-restricted-syntax
  for (const link of links) {
    if (link.includes('bitchute')) {
      console.log(`>${link}`);
      // eslint-disable-next-line no-await-in-loop
      await downloadBitchute(link, output);
      bitchuteFound = true;
    } else {
      console.log(link);
    }
  }
  if (!bitchuteFound) {
    throw new Error('couldn\'t find bitchute link!');
  }
  await downloadYoutube(id, output);
  console.log('Done');
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
