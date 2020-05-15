<template>
  <v-app id="inspire">
    <vue-progress-bar></vue-progress-bar>
    <v-navigation-drawer v-model="drawer" color="#303034" mini-variant app clipped>
      <v-list dense>
        <v-list-item v-for="item in items" :key="item.text" :to="item.link" link>
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item link>
          <v-list-item-action>
            <v-icon color="grey darken-1">mdi-cog</v-icon>
          </v-list-item-action>
          <v-list-item-title class="grey--text text--darken-1">
            Settings
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app clipped-left color="#6f930b" dense>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-icon class="mx-2" medium>mdi-tea</v-icon>
      <v-toolbar-title class="mr-12 align-center">
        <span class="title">Teeaboo</span>
      </v-toolbar-title>
      <v-spacer />
      <v-row align="center" style="max-width: 300px">
        <v-text-field
          :append-icon-cb="() => {}"
          placeholder="Search..."
          single-line
          append-icon="mdi-magnify"
          color="black"
          hide-details
          v-model="q"
        />
      </v-row>
    </v-app-bar>

    <v-content class="content">
      <router-view :q="q"></router-view>
    </v-content>
  </v-app>
</template>

<script>

export default {
  name: 'App',
  components: {},
  props: {
    source: String,
  },
  data: () => ({
    q: '',
    drawer: null,
    items: [
      { icon: 'mdi-youtube-subscription', text: 'Videos', link: '/' },
      { icon: 'mdi-tray-full', text: 'Queue', link: '/queue' },
    ],
  }),
  created() {
    this.$Progress.start();
    this.$router.beforeEach((to, from, next) => {
      this.$Progress.start();
      next();
    });
    this.$vuetify.theme.dark = true;
  },
};
</script>

<style scoped>
.content {
  background-color: #222222
}
</style>
