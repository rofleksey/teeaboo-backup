<template>
  <v-container align="center">
    <loading
      :active.sync="isLoading"
      :opacity="0.25"
      loader="dots"
      color="#6f930b"
      :is-full-page="false"
      :can-cancel="true" />
    <v-container>
      <div>
        Cpu usage ({{cpuUsage}}%)
        <v-progress-linear :value="cpuUsage"></v-progress-linear>
      </div>
      <div v-if="memInfo">
        Mem usage ({{memInfo.usedMemMb}} / {{memInfo.totalMemMb}} Mb)
        <v-progress-linear :value="100 - memInfo.freeMemPercentage"></v-progress-linear>
      </div>
      <div v-if="driveInfo">
        Disk usage ({{driveInfo.usedGb}} / {{driveInfo.totalGb}} Gb)
        <v-progress-linear :value="driveInfo.usedPercentage"></v-progress-linear>
      </div>
    </v-container>
    <v-list align="center" two-line max-width="1000">
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
            <v-menu offset-y>
              <template v-slot:activator="{ on }">
                <v-btn icon color="white" v-on="on">
                  <v-icon class="mx-2" medium>mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="() => {}">
                  <v-list-item-title>Reschedule</v-list-item-title>
                </v-list-item>
                <v-list-item @click="() => {}">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-list-item-action>
        </v-list-item>

        <v-divider v-if="index + 1 < filteredTasks.length" :key="index"></v-divider>
      </template>
    </v-list>
  </v-container>
</template>

<script>
import axios from 'axios';
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
  },
  components: {
    Loading,
  },
  props: {
    q: String,
  },
  mounted() {
    const poll = () => {
      axios.get('/api/queue').then((res) => {
        const { array } = res.data;
        this.tasks = array.map((task) => {
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
        }).reverse();
      }).finally(() => {
        this.isLoading = false;
      });
    };
    poll();
    this.intervalId = setInterval(poll, POLL_INTERVAL);
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
  data: () => ({
    intervalId: undefined,
    infoIntervalId: undefined,
    isLoading: true,
    cpuUsage: 0,
    driveInfo: null,
    memInfo: null,
    tasks: [
      // {
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 100 - Pending',
      //   statusText: 'Pending',
      //   status: 'pending',
      //   time: '1 month ago',
      //   icon: 'mdi-timer-sand',
      //   color: 'gray',
      // },
      // {
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 7 - Disillusioned',
      //   statusText: 'Generating video...',
      //   status: 'processing',
      //   time: '15 min ago',
      //   icon: 'mdi-cog',
      //   color: 'purple',
      // },
      // {
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 9 - Test',
      //   statusText: 'Ready',
      //   status: 'ready',
      //   time: '1 day ago',
      //   icon: 'mdi-check',
      //   color: 'green',
      // },
      // {
      //   name: 'Teeaboo Reacts - Flip Flappers Episode 10 - Error',
      //   statusText: 'Array index out of bounds',
      //   status: 'error',
      //   time: '2 days ago',
      //   icon: 'mdi-bug',
      //   color: 'red',
      // },
    ],
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
</style>
