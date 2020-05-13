FROM alpine
EXPOSE 2020
RUN apk add --no-cache npm ca-certificates wget curl openssl ffmpeg python python3 aria2 && pip3 install youtube-dl
COPY megatools /bin
COPY /dist /app/dist
COPY /server/compiler/compiler.js /server/compiler/videoSplitter.js /app/server/compiler/
COPY /server/downloader/downloader.js /app/server/downloader/
COPY /server/package-lock.json /server/package.json /server/server.js /app/server/
WORKDIR /app/server
RUN npm install
CMD [ "node", "server.js"]
