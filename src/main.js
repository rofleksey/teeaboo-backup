import Vue from 'vue';
import VueSidebarMenu from 'vue-sidebar-menu';
import 'vue-sidebar-menu/dist/vue-sidebar-menu.css';
import App from './App.vue';
import router from './router';
import store from './store';

Vue.config.productionTip = false;


Vue.use(VueSidebarMenu);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
