import Vue from 'vue';
import VueRouter from 'vue-router';
import VideoGallery from '../views/VideoGallery.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'VideoGallery',
    component: VideoGallery,
  },
  {
    path: '/queue',
    name: 'Queue',
    component: () => import(/* webpackChunkName: "about" */ '../views/QueueList.vue'),
  },
  {
    path: '/watch/:id',
    name: 'Watch',
    component: () => import(/* webpackChunkName: "about" */ '../views/VideoPage.vue'),
  },
];

const router = new VueRouter({
  routes,
});

export default router;
