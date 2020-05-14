<template>
  <v-container>
    <loading
      :active.sync="isLoading"
      :opacity="0.25"
      loader="dots"
      color="#6f930b"
      :is-full-page="false"
      :can-cancel="true" />
    <v-row align="start" justify="start">
      <v-col
        v-for="video in filteredData"
        :key="video.id"
        :cols="cols"
        class="ml-left lg">
        <v-card
        color="#303034"
        :class="(video.status && video.status==='error') ? 'error-vid' : ''"
        :hover="true"
        :to="`/watch/${video.folder}`"
        :loading="(video.status && video.status==='processing') ? '#296c08' : false"
        :disabled="video.status && (video.status==='processing' || video.status==='error')"
        loader-height="7">
          <v-img
            :src="video.thumbnail"
            :class="(video.status && video.status==='processing') ? 'processing' : ''"
            class="white--text align-end"
            gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
          >
            <v-card-title class="body-1 font-weight-bold" v-text="video.name"></v-card-title>
          </v-img>

          <v-card-actions>
            <v-list-item-content>
              <v-list-item-title class="font-weight-light caption">
                {{video.statusText}}
              </v-list-item-title>
            </v-list-item-content>

            <!-- <v-spacer></v-spacer> -->

            <!-- <v-btn icon>
              <v-icon>mdi-tea</v-icon>
            </v-btn> -->
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import axios from 'axios';
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';

const POLL_INTERVAL = 15 * 1000;

export default {
  name: 'VideoGallery',
  components: {
    Loading,
  },
  computed: {
    cols() {
      const {
        lg, sm,
        md, xs,
      } = this.$vuetify.breakpoint;
      if (lg) {
        return 3;
      }
      if (md) {
        return 4;
      }
      if (sm) {
        return 6;
      }
      if (xs) {
        return 12;
      }
      return 2;
    },
    filteredData() {
      return this.videos.filter((v) => v.name.toLowerCase().includes(this.q.toLowerCase()));
    },
    videos() {
      return this.$store.state.videos;
    },
  },
  props: {
    q: String,
  },
  mounted() {
    if (this.videos.length !== 0) {
      this.isLoading = false;
    }
    const poll = () => {
      axios.get('/api/videos').then((res) => {
        this.$store.commit('setVideos', res.data.map((v) => ({
          ...v,
          statusText: v.status === 'ready' ? v.time : v.statusText,
        })).reverse());
        this.$Progress.finish();
      }).catch((e) => {
        console.error(e);
        this.$Progress.fail();
      }).finally(() => {
        this.isLoading = false;
      });
    };
    poll();
    this.intervalId = setInterval(poll, POLL_INTERVAL);
  },
  unmounted() {
    clearInterval(this.intervalId);
  },
  data: () => ({
    intervalId: undefined,
    isLoading: true,
  }),
};
</script>

<style>
.processing {
  filter: hue-rotate(135deg);
}
.error-vid {
  filter: sepia(100%);
}
</style>
