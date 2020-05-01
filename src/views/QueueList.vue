<template>
  <v-container>
    <v-list align="center" two-line max-width="800">
      <template v-for="(item, index) in tasks">
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

        <v-divider v-if="index + 1 < tasks.length" :key="index"></v-divider>
      </template>
    </v-list>
  </v-container>
</template>

<script>
export default {
  name: 'QueueList',
  computed: {},
  data: () => ({
    pointer: 1,
    tasks: [
      {
        name: 'Teeaboo Reacts - Flip Flappers Episode 100 - Pending',
        statusText: 'Pending',
        status: 'pending',
        time: '1 month ago',
        icon: 'mdi-timer-sand',
        color: 'gray',
      },
      {
        name: 'Teeaboo Reacts - Flip Flappers Episode 7 - Disillusioned',
        statusText: 'Generating video...',
        status: 'processing',
        time: '15 min ago',
        icon: 'mdi-cog',
        color: 'purple',
      },
      {
        name: 'Teeaboo Reacts - Flip Flappers Episode 9 - Test',
        statusText: 'Ready',
        status: 'ready',
        time: '1 day ago',
        icon: 'mdi-check',
        color: 'green',
      },
      {
        name: 'Teeaboo Reacts - Flip Flappers Episode 10 - Error',
        statusText: 'Array index out of bounds',
        status: 'error',
        time: '2 days ago',
        icon: 'mdi-bug',
        color: 'red',
      },
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
