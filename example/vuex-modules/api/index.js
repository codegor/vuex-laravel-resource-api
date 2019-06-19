import Vue from 'vue'
import routes from './routes'
import Resolver from 'vuex-laravel-rest-api'
import socket from 'vuex-laravel-resource-api/src/socket.io'
// import conf from '...config/dev.env'

// const WS = conf.hasOwnProperty('WS') ? conf.WS : true;
const WS =true;

if('undefined' != typeof routes.socket && WS) {
  // console.log("WSS adr", window.location.hostname + routes.socket);
  socket.host = window.location.hostname + routes.socket;
  Resolver.setSocket(socket);
}

Resolver.init(routes);
Vue.use(Resolver);

const state = { //state mapState // var for save data
  ...Resolver.states() // owners: {}
};

const mutations = { //commit mapMutations // action to change data only sinc
  ...Resolver.mutations() // SET_* SET_OWNERS(state, data): {state.owners = data}
};

const actions = { //dispach mapActions // action for loading data or chein of actions(mutations)
  ...Resolver.actions() // getOwners: {}
};

const getters = { //getters mapGetters //computed fields from state var
  ...Resolver.getters() // owners: {}
};

export default { //export vuex module
  state,
  mutations,
  actions,
  getters
}
