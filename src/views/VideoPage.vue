<template>
  <v-container
      class="fill-height"
    >
      <v-row
        align="center"
        justify="center"
      >
        <v-col
          cols="9"
        >
          <video
              ref="video"
              class="video-js"
              controls
              disablePictureInPicture
              preload="auto">
            <p class="vjs-no-js">
              To view this video please enable JavaScript, and consider upgrading to a
              web browser that
              <a href="https://videojs.com/html5-video-support/" target="_blank">
                supports HTML5 video
              </a>
            </p>
          </video>
          <v-bottom-navigation
            color="purple lighten-1"
            v-model="curButton"
          >
            <v-btn
              v-for="(item, index) in buttons"
              :value="item.name"
              :key="item.name"
              @click="() => playlistGoTo(index)">
              <span>{{item.name}}</span>
              <v-icon>{{item.icon}}</v-icon>
            </v-btn>
          </v-bottom-navigation>
        </v-col>
      </v-row>
  </v-container>
</template>

<script>
import axios from 'axios';
import videojs from 'video.js';
import '../../public/video-js.min.css';
import '../../public/videojs-seek-buttons.css';
// import '../../public/videojs-playlist-ui.css';
import '../../public/videojs-playlist-ui.vertical.css';

// import '../../public/videojs-download';
import '../../public/videojs-playlist-ui.min';
import 'videojs-hotkeys';
import 'videojs-landscape-fullscreen';
import 'videojs-seek-buttons';
import 'videojs-playlist';

let player = null;

export default {
  name: 'VideoPage',
  components: {},
  computed: {},
  methods: {
    playlistGoTo(index) {
      player.playlist.currentItem(index);
    },
    getIcon(name) {
      if (name.includes('discussion')) {
        return 'mdi-tea';
      }
      if (name.includes('reaction')) {
        return 'mdi-account';
      }
      if (name.includes('intro')) {
        return 'mdi-kettle';
      }
      return 'mdi-help';
    },
  },
  mounted() {
    const videoId = this.$route.params.id;
    player = videojs(this.$refs.video, {
      playbackRates: [1.0, 1.25, 1.5, 2.0],
      fluid: true,
      poster: `/data/${videoId}/thumbnail.jpg`,
      sources: [{
        src: `/data/${videoId}/intro.mp4`,
        type: 'video/mp4',
      }],
    }, () => {
      console.log('Player initialized!');
      player.landscapeFullscreen({
        fullscreen: {
          enterOnRotate: true,
          alwaysInLandscapeMode: true,
          iOS: true,
        },
      });
      player.hotkeys({
        volumeStep: 0.1,
        seekStep: 5,
        enableModifiersForNumbers: false,
      });
      player.seekButtons({
        forward: 30,
        back: 10,
      });
    });
    axios.get(`/api/watch?id=${videoId}`).then((res) => {
      const playlist = res.data.map((file) => ({
        name: file.replace('.mp4', ''),
        sources: [{
          src: `/data/${videoId}/${file}`,
          type: 'video/mp4',
        }],
        poster: `/data/${videoId}/thumbnail.jpg`,
      }));
      this.buttons = playlist.map((item) => ({
        name: item.name,
        icon: this.getIcon(item.name),
      }));
      this.curButton = this.buttons[0].name;
      player.playlist(playlist);
      console.log('Playlist loaded!');
      player.playlist.autoadvance(0);
      player.on('playlistitem', () => {
        this.curButton = this.buttons[player.playlist.currentItem()].name;
      });
      player.play();
      this.$Progress.finish();
    }).catch((e) => {
      console.error(e);
      this.$Progress.fail();
    });
  },
  unmounted() {
    player.dispose();
  },
  data: () => ({
    buttons: [],
    curButton: null,
  }),
};
</script>

<style scoped>
/* .player {
  width: 85% !important;
  height: auto !important;
} */
</style>
