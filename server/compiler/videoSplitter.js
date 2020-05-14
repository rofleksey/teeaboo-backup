/* eslint-disable max-classes-per-file */
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { throttle } = require('lodash');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);

class CutInfo {
  constructor() {
    this.cuts = [];
  }

  addPart(from, to, filter) {
    this.cuts.push({
      from,
      to,
      filter,
    });
  }

  freeze() {
    if (this.cuts.length === 0) {
      this.addPart();
    }
  }

  async fastConcat(tempDir, output, dest) {
    console.log('Applying concat demuxer...');
    const concatListName = path.join(tempDir, `${dest}_concat_list.txt`);
    await writeFile(concatListName, [...Array(this.cuts.length).keys()].map(
      (i) => `file '${dest}_${i}.mp4'`,
    ).join('\n'));
    await new Promise((res, rej) => {
      let lastPercentage = 0;
      ffmpeg(concatListName, {
        // stdoutLines: Infinity,
      })
        .inputOptions([
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
        .save(path.join(output, `${dest}.mp4`));
    });
    fs.unlinkSync(concatListName);
  }

  async concat(tempDir, output, dest) {
    console.log('Applying concat filter...');
    const iOption = [...Array(this.cuts.length).keys()].map(
      (i) => `-i "${path.join(tempDir, `${dest}_${i}.mp4`)}"`,
    ).join(' ');
    const concatInputs = [...Array(this.cuts.length).keys()].map(
      (i) => `[${i}:v][${i}:a]`,
    ).join('');
    const outputFile = path.join(output, `${dest}.mp4`);
    await new Promise((res, rej) => {
      const command = `ffpb -y ${iOption} -movflags faststart -filter_complex "${concatInputs}concat=n=${this.cuts.length}:v=1:a=1[v][a]" -map "[v]" -map "[a]" ${outputFile}`;
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
      cp.stderr.on('data', (data) => {
        updateStatus(`[${dest}] ${data.toString()}`);
      });
    });
  }

  async process(src, tempDir, output, dest) {
    for (let i = 0; i < this.cuts.length; i += 1) {
      console.log(`Cut #${i + 1}/${this.cuts.length}...`);
      const outputPath = path.join(tempDir, `${dest}_${i}.mp4`);
      const { from, to, filter } = this.cuts[i];
      const filterOption = filter ? `-filter_complex "${filter}" -map "[v]" -map "[a]"` : '';
      const fastOption = !filter ? '-c:v copy -c:a copy' : '';
      const ssOption = from ? `-ss ${from}` : '';
      const toOption = to ? `-to ${to - (from || 0)}` : '';
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res, rej) => {
        const command = `ffmpeg -y ${ssOption} -i "${src}" ${toOption} ${filterOption} ${fastOption} ${outputPath}`;
        console.log(command);
        exec(command, (e, out) => {
          if (e) {
            rej(out);
          }
          res();
        });
      });
    }
    if (this.cuts.every((cut) => !cut.filter)) {
      await this.fastConcat(tempDir, output, dest);
    } else {
      await this.concat(tempDir, output, dest);
    }
    console.log('Cleaning up...');
    [...Array(this.cuts.length).keys()].forEach((i) => {
      fs.unlinkSync(path.join(tempDir, `${dest}_${i}.mp4`));
    });
  }
}

class VideoSplitter {
  constructor(tempDir, output) {
    this.tempDir = tempDir;
    this.output = output;
    this.parts = [];
  }

  withFile(src, dest, cb) {
    const cutInfo = new CutInfo();
    if (cb) {
      cb(cutInfo);
    }
    cutInfo.freeze();
    this.parts.push({
      src,
      dest,
      cutInfo,
    });
  }

  async process(singleFile) {
    for (let i = 0; i < this.parts.length; i += 1) {
      const { src, dest, cutInfo } = this.parts[i];
      process.send({
        status: `Generating part ${i + 1}/${this.parts.length}...`,
      });
      // eslint-disable-next-line no-await-in-loop
      await cutInfo.process(src, this.tempDir, singleFile ? this.tempDir : this.output, dest);
    }
    // TODO: scale bitchute up
    if (!singleFile) {
      return this.parts.map((part) => part.dest);
    }
    throw new Error('Single file option is not implemented yet');
  }
}

module.exports = {
  VideoSplitter,
};
