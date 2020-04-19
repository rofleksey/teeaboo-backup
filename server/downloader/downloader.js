const axios = require('axios');
const path = require('path');
const youtubedl = require('youtube-dl');
const getUrls = require('get-urls');
const cheerio = require('cheerio');
const download = require('download');

const apiKey = process.env.YOUTUBE_API_KEY;
const apiPrefix = 'https://www.googleapis.com/youtube/v3/';
const channelId = 'UCcAJb3qfTvEZdDl6tOv0nfA';

// QRajskbC-BQ

async function listCommand() {
  const response = await axios.get(`${apiPrefix}search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50`);
  console.log(JSON.stringify(response.data, null, 1));
}

async function downloadYoutube(url, output) {
  await new Promise((res, rej) => {
    console.log('Downloading youtube video...');
    youtubedl.exec(
      url,
      ['-f', 'bestvideo[height>=720]+bestaudio[ext=m4a]', '--output', path.join(output, 'youtube.mp4')],
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
  console.log('Downloading bitchute video...');
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const downloadUrl = $('video source').attr('src');
  await download(downloadUrl, output);
}

function getVideoIdFromLink(url) {
  const regExp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : null;
}


async function extractLinks(url) {
  const id = getVideoIdFromLink(url);
  const response = await axios.get(`${apiPrefix}videos?key=${apiKey}&id=${id}&part=snippet`);
  const { description } = response.data.items[0].snippet;
  const urlsSet = getUrls(description);
  return Array.from(urlsSet);
}

async function videoCommand(url, output) {
  await downloadYoutube(url, output);
  const links = await extractLinks(url);
  // eslint-disable-next-line no-restricted-syntax
  for (const link of links) {
    if (link.includes('bitchute')) {
      console.log(`>${link}`);
      // eslint-disable-next-line no-await-in-loop
      await downloadBitchute(link, output);
    } else {
      console.log(link);
    }
  }
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
  // console.error(e.config);
}

function simpleErrorCatcher(e) {
  console.error(e);
}

require('yargs')
  .scriptName('downloader')
  .command('list', 'get list of videos', () => { }, (argv) => {
    listCommand(argv.id).catch(axiosErrorCatcher);
  })
  .command('video <url> <output>', 'download target video', (yargs) => {
    yargs
      .positional('url', {
        describe: 'url of the video to crawl',
        type: 'string',
        demandOption: true,
      })
      .positional('output', {
        describe: 'output directory',
        type: 'string',
        demandOption: true,
      });
  }, (argv) => {
    videoCommand(argv.url, argv.output).catch(simpleErrorCatcher);
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
