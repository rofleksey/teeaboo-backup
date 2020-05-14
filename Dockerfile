FROM alpine
EXPOSE 2020
RUN apk add --no-cache npm ca-certificates wget curl openssl ffmpeg python python3 aria2 && pip3 install youtube-dl ffpb
COPY megatools /bin
COPY /server/package-lock.json /server/package.json /app/server/
WORKDIR /app/server
RUN npm install
COPY /server/server.js /app/server/
COPY /dist /app/dist
COPY /server/compiler/compiler.js /server/compiler/videoSplitter.js /app/server/compiler/
COPY /server/downloader/downloader.js /app/server/downloader/
CMD [ "node", "server.js"]
