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
  },
  props: {
    q: String,
  },
  mounted() {
    const poll = () => {
      axios.get('/api/videos').then((res) => {
        this.videos = res.data.map((v) => ({
          ...v,
          statusText: v.status === 'ready' ? v.time : v.statusText,
        })).reverse();
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
    videos: [
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 7 - Disillusioned',
      //   id: 0,
      //   status: 'processing',
      //   statusText: 'Generating video...',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 8 - Test',
      //   id: 1,
      //   status: 'ready',
      //   statusText: '6 hours ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 8 - ewfewuqhfiore',
      //   id: 2,
      //   status: 'ready',
      //   statusText: '7 hours ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test3',
      //   id: 3,
      //   status: 'error',
      //   statusText: 'Array index out of bounds',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test4',
      //   id: 4,
      //   status: 'ready',
      //   statusText: '1 day ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test5',
      //   id: 5,
      //   status: 'ready',
      //   statusText: '3 day ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test6',
      //   id: 6,
      //   status: 'ready',
      //   statusText: 'a week ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test7',
      //   id: 7,
      //   status: 'ready',
      //   statusText: 'two weeks ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test8',
      //   id: 8,
      //   status: 'ready',
      //   statusText: 'three week ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test9',
      //   id: 9,
      //   status: 'ready',
      //   statusText: 'a month ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test10',
      //   id: 10,
      //   status: 'ready',
      //   statusText: 'three week ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test11',
      //   id: 11,
      //   status: 'ready',
      //   statusText: 'a month ago',
      // },
      // {
      //   thumbnail: 'https://i.ytimg.com/vi/wXOzHXE61j4/hqdefault.jpg?sqp=-oaymwEZCPYBEIoBSFXyq4qpAwsIARUAAIhCGAFwAQ==&rs=AOn4CLCOaQtOGr7L0rFECxbxmySj8bt7ZA',
      //   name: 'test12',
      //   id: 12,
      //   status: 'ready',
      //   statusText: 'a month ago',
      // },
    ],
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
