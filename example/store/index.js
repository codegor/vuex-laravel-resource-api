import Vue from 'vue';
import Vuex from 'vuex';
//import VuexI18n from 'vuex-i18n'; // load vuex i18n module

import api from './modules/api';
// import other-modules from './modules/_other-modules_';

Vue.use(Vuex);

const store = new Vuex.Store({
  strict: true, // process.env.NODE_ENV !== 'production',
  //getters,
  modules: {
    api,
    // ... other modules
  },
  // state: {},
  // mutations: {},
  plugins: [...api.plugins]
});

//Vue.use(VuexI18n.plugin, store);
//Vue.prototype.$resapi.setAuthJWT('empty');

export default store;
