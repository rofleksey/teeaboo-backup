import Vue from 'vue';
import VueScrollTo from 'vue-scrollto';
import VueProgressBar from 'vue-progressbar';
import App from './App.vue';
import router from './router';
import store from './store';
import vuetify from './plugins/vuetify';

Vue.use(VueProgressBar, {
  color: 'white',
  failedColor: 'red',
  thickness: '4px',
  transition: {
    speed: '0.2s',
    opacity: '0.3s',
    termination: 300,
  },
  autoRevert: true,
  autoFinish: false,
  location: 'top',
  inverse: false,
});
Vue.use(VueScrollTo);

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  vuetify,
  render: (h) => h(App),
}).$mount('#app');
