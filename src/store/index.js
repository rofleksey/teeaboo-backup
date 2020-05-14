import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    videos: [],
    tasks: [],
  },
  mutations: {
    setVideos(state, videos) {
      state.videos = videos;
    },
    setTasks(state, tasks) {
      state.tasks = tasks;
    },
  },
  actions: {
  },
  modules: {
  },
});
