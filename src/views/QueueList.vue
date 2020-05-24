<template>
  <v-container align="center" style="max-width: 1000px">
    <loading
      :active.sync="isLoading"
      :opacity="0.25"
      loader="dots"
      color="#6f930b"
      :is-full-page="false"
      :can-cancel="true" />
    <v-container>
      <v-row
        class="my-1"
        align="center"
        justify="center"
      >
        <strong class="mx-4 info--text text--darken-2">
          Cpu usage ({{cpuUsage}}%)
        </strong>
        <v-progress-circular
          class="mr-2"
          rotate="270"
          :value="cpuUsage || 0" />
      </v-row>
      <v-row
        class="my-1"
        align="center"
        justify="center"
      >
        <strong class="mx-4 info--text text--darken-2">
          Mem usage ({{
            memInfo ? memInfo.usedMemMb : ''}} / {{memInfo ? memInfo.totalMemMb : ''}} Mb)
        </strong>
        <v-progress-circular
          class="mr-2"
          :value="memInfo ? (100 - memInfo.freeMemPercentage) : 0"
          rotate="270" />
      </v-row>
      <v-row
        class="my-1"
        justify="center"
        align="center"
      >
        <strong class="mx-4 info--text text--darken-2">
        Disk usage ({{
          driveInfo ? driveInfo.usedGb : ''}} / {{driveInfo ? driveInfo.totalGb : ''}} Gb)
        </strong>
        <v-progress-circular
          class="mr-2"
          :value="driveInfo ? driveInfo.usedPercentage : 0"
          rotate="270" />
      </v-row>
    </v-container>
    <v-list align="center" two-line>
      <template v-for="(item, index) in filteredTasks">
        <v-list-item
          :style="{'background-color': item.color}"
          :class="item.status === 'processing' ? 'processing-queue-item' : ''"
          :dark="item.status === 'processing'"
          :key="item.name"
        >
          <v-list-item-avatar>
            <v-icon>{{item.icon}}</v-icon>
          </v-list-item-avatar>

          <v-list-item-content>
            <v-list-item-title v-text="item.name"></v-list-item-title>
            <v-list-item-subtitle v-text="item.statusText"></v-list-item-subtitle>
          </v-list-item-content>

          <v-list-item-action>
            <v-list-item-action-text v-text="item.time"></v-list-item-action-text>
          </v-list-item-action>
        </v-list-item>

        <v-divider v-if="index + 1 < filteredTasks.length" :key="index"></v-divider>
      </template>
    </v-list>
    <v-snackbar v-model="snackbar" :color="snackbarColor" :right="true" :timeout="5000" :top="true">
      {{ snackbarText }}
      <v-btn dark text @click="snackbar = false">Close</v-btn>
    </v-snackbar>
    <v-dialog v-if="manualMode" v-model="addDialog" scrollable max-width="300px">
      <template v-slot:activator="{ on }">
        <v-btn
          color="#DC143C"
          fab
          large
          dark
          bottom
          right
          fixed
          class="fab-add"
          v-on="on"
          @click="resetAddDialog"
        >
          <v-icon>mdi-plus</v-icon>
        </v-btn>
      </template>
      <v-card>
        <v-tabs v-model="addDialogTab" centered dark icons-and-text>
          <v-tabs-slider></v-tabs-slider>

          <v-tab href="#tab-single">
            Single video
            <v-icon>mdi-video</v-icon>
          </v-tab>

          <v-tab href="#tab-playlist">
            Playlist
            <v-icon>mdi-playlist-play</v-icon>
          </v-tab>
        </v-tabs>

        <v-tabs-items v-model="addDialogTab">
          <v-tab-item value="tab-single">
            <v-card flat>
              <v-card-text>
                <v-form v-model="addDialogValid">
                  <v-text-field
                    v-model="addDialogId"
                    :rules="[v => (v || '').trim().length > 0 || 'ID is empty']"
                    label="Video ID"
                    required
                  ></v-text-field>
                  <v-btn
                    :loading="addDialogLoading"
                    :disabled="!addDialogValid"
                    color="blue-grey"
                    class="ma-2 white--text"
                    @click="submitSingle"
                  >
                    Upload
                    <v-icon right dark>mdi-cloud-upload</v-icon>
                  </v-btn>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>
          <v-tab-item value="tab-playlist">
            <v-card flat>
              <v-card-text>
                <v-form v-model="addDialogValid">
                  <v-text-field
                    v-model="addDialogId"
                    :rules="[v => (v || '').trim().length > 0 || 'ID is empty']"
                    label="Playlist ID"
                    required
                  ></v-text-field>
                  <v-btn
                    :loading="addDialogLoading"
                    :disabled="!addDialogValid"
                    color="blue-grey"
                    class="ma-2 white--text"
                    @click="submitPlaylist"
                  >
                    Upload
                    <v-icon right dark>mdi-cloud-upload</v-icon>
                  </v-btn>
                </v-form>
              </v-card-text>
            </v-card>
          </v-tab-item>
        </v-tabs-items>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import axios from 'axios';
import VueScrollTo from 'vue-scrollto';
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';

const POLL_INTERVAL = 15 * 1000;
const INFO_POLL_INTERVAL = 10 * 1000;

export default {
  name: 'QueueList',
  computed: {
    filteredTasks() {
      return this.tasks.filter((v) => v.name.toLowerCase().includes(this.q.toLowerCase()));
    },
    tasks() {
      return this.$store.state.tasks;
    },
    manualMode() {
      return this.$store.state.manualMode;
    },
  },
  components: {
    Loading,
  },
  props: {
    q: String,
  },
  mounted() {
    if (this.tasks.length !== 0) {
      this.isLoading = false;
    }
    this.poll();
    this.intervalId = setInterval(this.poll, POLL_INTERVAL);
    const pollInfo = () => {
      axios.get('/api/info').then((res) => {
        const { cpuUsage, memInfo, driveInfo } = res.data;
        this.cpuUsage = cpuUsage;
        this.memInfo = memInfo;
        this.driveInfo = driveInfo;
      });
    };
    pollInfo();
    this.infoIntervalId = setInterval(pollInfo, INFO_POLL_INTERVAL);
  },
  unmounted() {
    clearInterval(this.intervalId);
    clearInterval(this.infoIntervalId);
  },
  methods: {
    submitSingle() {
      if (this.addDialogValid && !this.addDialogLoading) {
        this.addDialogLoading = true;
        axios
          .post('/api/add', {
            single: this.addDialogId,
          })
          .then(() => {
            this.poll();
            this.addDialog = false;
            this.showSnackbar('OK', 'success');
          })
          .catch(() => {
            this.showSnackbar('Error', 'error');
          })
          .finally(() => {
            this.addDialogLoading = false;
          });
      }
    },
    submitPlaylist() {
      if (this.addDialogValid && !this.addDialogLoading) {
        this.addDialogLoading = true;
        axios
          .post('/api/add', {
            playlist: this.addDialogId,
          })
          .then(() => {
            this.poll();
            this.addDialog = false;
            this.showSnackbar('OK', 'success');
          })
          .catch(() => {
            this.showSnackbar('Error', 'error');
          })
          .finally(() => {
            this.addDialogLoading = false;
          });
      }
    },
    showSnackbar(text, color) {
      this.snackbarText = text;
      this.snackbarColor = color;
      this.snackbar = true;
    },
    poll() {
      axios.get('/api/queue').then((res) => {
        const { array, manualMode } = res.data;
        this.$store.commit('setTasks', array.map((task) => {
          let icon = 'mdi-question-mark';
          let color = 'black';
          if (task.status === 'pending') {
            icon = 'mdi-timer-sand';
            color = 'gray';
          } else if (task.status === 'ready') {
            icon = 'mdi-check';
            color = 'green';
          } else if (task.status === 'error') {
            icon = 'mdi-bug';
            color = 'red';
          } else if (task.status === 'processing') {
            icon = 'mdi-cog';
            color = 'purple';
          }
          return ({
            ...task,
            icon,
            color,
          });
        }).reverse());
        this.$store.commit('setManualMode', manualMode);
        if (!this.alreadyScrolled) {
          setTimeout(() => {
            VueScrollTo.scrollTo('.processing-queue-item', 1000, {
              easing: 'ease-in-out',
            });
          }, 10);
          this.alreadyScrolled = true;
        }
        this.$Progress.finish();
      }).catch((e) => {
        console.error(e);
        this.$Progress.fail();
      }).finally(() => {
        this.isLoading = false;
      });
    },
  },
  data: () => ({
    alreadyScrolled: false,
    intervalId: undefined,
    infoIntervalId: undefined,
    isLoading: true,
    cpuUsage: 0,
    driveInfo: null,
    memInfo: null,
    snackbar: false,
    snackbarText: '',
    snackbarColor: '',
    addDialog: false,
    addDialogId: '',
    addDialogValid: false,
    addDialogTab: null,
    addDialogLoading: false,
  }),
};
</script>

<style>
.processing-queue-item {
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradient 4s ease infinite;
}
@keyframes gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
.fab-add {
  margin: 16px;
}
</style>
