<template>
  <v-container
      class="fill-height"
    >
      <v-row
        align="center"
        justify="center"
      >
        <v-col
          cols="10"
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
        </v-col>
      </v-row>
  </v-container>
</template>

<script>
import videojs from 'video.js';
import '../../public/video-js.min.css';
import 'videojs-hotkeys';
import 'videojs-landscape-fullscreen';

let player = null;

export default {
  name: 'VideoPage',
  components: {},
  computed: {},
  mounted() {
    const videoId = this.$route.params.id;
    player = videojs(this.$refs.video, {
      playbackRates: [1.0, 1.5, 2.0],
      fluid: true,
      poster: `/data/${videoId}/thumbnail.jpg`,
      sources: [{
        src: `/data/${videoId}/full.mp4`,
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
      player.play();
    });
  },
  unmounted() {
    player.dispose();
  },
  data: () => ({
    //
  }),
};
</script>

<style scoped>
/* .player {
  width: 85% !important;
  height: auto !important;
} */
</style>
