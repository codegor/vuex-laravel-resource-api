import Vue from 'vue';
import routes from './routes';
import Resolver from 'vuex-laravel-resource-api';
import socket from 'vuex-laravel-resource-api/src/socket.io';

/** if you need message add showMess vue global method, example below */
/*
import {Toast} from 'quasar'
Vue.mixin({
	methods: {
		showMess (msg, options) {
		  Toast.create.info({ html: msg, timeout: 1500, position: 'right'});
		}
	}
});
*/

const WS = false;
/** Also you can load WS const from conf file or from env file, example below */
/*
import conf from '...config/dev.env'
const WS = conf.hasOwnProperty('WS') ? conf.WS : true;
*/

if('undefined' != typeof routes.socket && WS) {
  // console.log("WSS adr", window.location.hostname + routes.socket);
  socket.host = window.location.hostname + routes.socket;
  Resolver.setSocket(socket);
}

/** if you wont set your own getters library or your own error massages... */
// Resolver.gettersLib = {/* your lib */};
// Resolver.errorMe = {/* your lib for error mess */};

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

const plugins = Resolver.plugins();

export default { //export vuex module
  state,
  mutations,
  actions,
  getters,
  plugins
}
