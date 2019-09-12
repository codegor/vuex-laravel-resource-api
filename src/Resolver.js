import _ from 'lodash';
import axios from 'axios';
import gettersLib from './getters';
import errorMes from './errorMessage';

const lazyTime = 100;

const Resolver = {
  router: {},
  $http: {},
  $store: {},
  $vue: {},
  $socket: null,
  $channel: null,
  events: {
    store: {},
    add(name, route){
      if(_.has(this.store, name))
        this.store[name].push(route);
      else
        this.store[name] = [route];
    },
    get(name){
      if(_.has(this.store, name))
        return this.store[name];
      else
        console.error('API Resolver: you wish call event for update for which no one route does register. Event name: '+name);
    }
  },
  timers: {},
  listeners: {},
  lazyUpdates: {},
  requests: {},
  debug: false,
  gettersLib,
  errorMes,

  m: _.invert(['get', 'load', 'show', 'create', 'update', 'delete']), //methods
  pm: _.invert(['show', 'update', 'delete']), //paramMethod (need id)
  d: _.invert(['create', 'update']), //data Method (need data field)
  pd: _.invert(['load']), //param Method (data it is param)
  a: _.invert(['get', 'load', 'show']), //access Method (no need update after)

  init(router) {
    this.router = router;
    _.each(this.router.actions, (a, r) => {
      if(_.has(a, 'updateOn')){
        let e = a.updateOn;
        if(_.isString(e)){
          this.events.add(e, r);
        } else if(_.isArray(e)){
          // let obj = this;
          _.each(e, (v) => {
            this.events.add(v, r);
          });
        }
      }
      if(_.has(a, 'updateTimer')){
        this.timers[r] = {sec: a.updateTimer, id: ''};
      }
      if(_.has(a, 'updateSocket') && this.$socket){
        this.listeners[r] = () => {
          if(!this.$channel)
            return;
          let obj = this;
          this.$channel.listen(`.update.${r}`, (e)=>{  // . befor event - it is for ranamed events
            obj.$store.dispatch('update' + _.upperFirst(r));
            if(obj.debug) console.log('REST API: update by socket fire!', a)
          });
        };
      }
    });
    // if(this.debug && this.$socket && this.$channel)
    //   console.log("REST API WS Channels:", this.$channel)
  },
  setSocket(socket){
    this.$socket = socket;
  },
  startSocket(token, userId){
    this.$socket = this.$socket.init(token);
    this.$channel = this.$socket.private('api.'+userId);
  },
  startTimer(a){
    // console.log('REST API: update by timer fire!', a, this.timers);
    let obj = this;
    if(_.has(this.timers, a))
      this.timers[a].id = setTimeout(()=>{obj.$store.dispatch('update' + _.upperFirst(a)); if(obj.debug) console.log('REST API: update by timer fire!', a)}, this.timers[a].sec*1000);
  },
  startListen(a){
    if(_.has(this.listeners, a)){
      this.listeners[a]();
      delete this.listeners[a];
    }
  },
  emitUpdate(name) {
    let actions = this.events.get(name);
    console.log('API Resolver update event', this.$store, this.$state);
    if (!_.isEmpty(this.$store.state)) {
      _.each(actions, (a) => {
        if (!_.isNull(this.$store.state[a])) {
          this.$store.dispatch('update' + _.upperFirst(a));
        }
      });
    }
  },
  status(r, p){
    if(_.isUndefined(p)){
      this.$store.commit('status'+_.upperFirst(r), 'requesting');
    } else {
      if(_.has(this.requests, r))
        this.requests[r].concat(p);
      else
        this.requests[r] = [p];

      let finish = () => {
        let i = this.requests[r].indexOf(p);
        this.requests[r].splice(i, 1);
        if(0 === this.requests[r].length)
          this.$store.commit('status'+_.upperFirst(r), 'finish');
      };

      p.then(finish, finish);
    }
  },
  showMess(p, met, r){
    if(!this.$vue.showMess) return;

    if(_.has(this.router.actions[r], 'autoMessOff') && this.router.actions[r].autoMessOff) return;

    let t = {
      create: _.template('<%= name %> created successfully'),
      update: _.template('<%= name %><%= id %> saved successfully'),
      delete: _.template('<%= name %><%= id %> deleted successfully!')
    };
    let name = _.upperFirst(r);
    if(_.has(this.router.actions[r], 'name'))
      name = this.router.actions[r].name;

    p.then((d) => {
      let id = '';
      if(_.isObject(d) && _.has(d, 'data') && _.has(d.data, 'data') && _.has(d.data.data, 'id'))
        id = ' '+d.data.data.id;

      this.$vue.showMess(t[met]({name, id}));
    });
    p.catch(() => {
      this.$vue.showMess('Something went wrong...');
    })

  },

  lazyUpdate(p, r){
    let obj = this;
    if(_.has(this.lazyUpdates, r)) {
      clearTimeout(this.lazyUpdates[r].t);
      this.lazyUpdates[r].p.push(p);
    } else
      this.lazyUpdates[r] = {p: [p]};

    this.lazyUpdates[r].t = setTimeout(() => {
      let np = this.lazyUpdates[r].p;
      delete(this.lazyUpdates[r]);
      obj.update(Promise.all(np), r);
    }, lazyTime);
  },
  update(p, r){
    let u = []; // updated from update field
    if(_.has(this.router.actions[r], 'update') && !_.isEmpty(this.router.actions[r].update)){
      p.then(() => {
        _.forEach(this.router.actions[r].update, (v, k) => {
          this.$store.dispatch('update'+_.upperFirst(v));
        });
      });
      u = u.concat(this.router.actions[r].update);
    }

    let acts = [];
    _.each(this.router.actions, (act, name) => {
      if(_.has(act, 'connected') && !_.isEmpty(act.connected)){
        if(_.isString(act.connected) && r == act.connected)
          acts.push(name);
        else
          _.each(act.connected, n => {
            if(n == r)
              acts.push(name);
          });

      }
    });
    if(!_.isEmpty(acts)){
      p.then(() => {
        _.each(acts, a => {
          this.$store.dispatch('update'+_.upperFirst(a));
        });
      });
      u = u.concat(acts);
    }

    //auto update
    if(!_.includes(u, r) && !(_.has(this.router.actions[r], 'autoUpdateOff') && this.router.actions[r].autoUpdateOff)){
      p.then(() => {
        this.$store.dispatch('update'+_.upperFirst(r));
      });
    }
  },
  validate(path, data){
    let {m, pm} = this;
    let res = {go:true};

    if(!_.isString(path)) {console.error('API Resolver don\'t know what to do - path has not a string type! if you want xhr request use vue.$http or vue.$axios'); return;}

    let o = _.split(_.snakeCase(path), '_'); //o = output of operation

    if(!_.has(o, 1)) {console.error('API Resolver don\'t know what to do - path has not 2 part of name!'); return;}

    let d = _.has(this.router, 'delimiter') ? this.router.delimiter : '-';

    let met = o.shift(); //method
    let u = o.join(d); //resourse
    let r = _.camelCase(u);
    res = {...res, met, r, u, peculiar: false};

    if(!_.has(this.router.actions, r)) {console.error('API Resolver don\'t know what to do - path follow to undefined route!'); return;}

    if(_.has(this.router.actions[r], 'methods') && _.has(this.router.actions[r].methods, met)){
      res.peculiar = true;
      return res
    }

    if(!_.has(m, met)) {console.error('API Resolver don\'t know what to do - 1 part of path has not in ('+_.toString(_.keys(m))+')!'); return;}
    if('get' != met && !_.isObject(data)) {console.error('API Resolver don\'t know what to do - data should be an object type!'); return;}
    if(_.has(pm, met) && !_.has(data, 'id')) {console.error('API Resolver don\'t know what to do - in data object has not id field!'); return;}

    return res;
  },
  afterReq(p, r, met){
    let {a} = this;
    if(p instanceof Promise) {
      this.status(r, p);

      if (!_.has(a, met)) {
        if (_.has(this.router.actions[r], 'lazyUpdateOff') && this.router.actions[r].lazyUpdateOff)
          this.update(p, r);
        else
          this.lazyUpdate(p, r);

        this.showMess(p, met, r);
      }
    } else console.error('API Resolver: the custom method http request or something else return is not a Promise instanse!');
  },

  resolve(path, data) { //path = action + api name of Resourse. actions - get, show, update, create, delete and etc
    let {pm, d, pd} = this;
    let t = {get: 'get', load: 'get', show: 'get', create: 'post', update: 'put', delete: 'delete'}; // transform

    let {u, r, met, go, peculiar} = this.validate(path, data);
    if(!go) return;

    let url = this.router.prefix + u;

    let p;

    this.status(r);

    // request
    if(peculiar)
      p = this.router.actions[r].methods[met](url, data);
    else {
      let c = {
        method: t[met],
        url: url + ((_.has(pm, met)) ? '/' + data.id : '')
      };

      if (_.has(d, met)) {
        c.data = data;
      }
      if (_.has(pd, met)) {
        c.params = data;
      }

      p = this.$http(c);
    }

    this.afterReq(p, r, met);

    return p;
  },

  states(){
    let r = {};
    _.each(this.router.actions, (v, k) => {
      r[k] = null;
      r[k+'State'] = null;
    });
    return r;
  },
  mutations(){
    let r = {};
    _.forEach(this.router.actions, (v, k) => {
      r['raSet'+_.upperFirst(k)] = (state, data) => {if(this.debug) console.log('setted '+'raSet'+_.upperFirst(k), data); state[k] = data;};
      r['status'+_.upperFirst(k)] = (state, status) => {if(this.debug) console.log('setted '+'status'+_.upperFirst(k), status); state[k+'State'] = status;};
    });
    return r;
  },
  actions(){
    let obj = this;
    let r = {};
    _.forEach(this.router.actions, (v, k) => {
      r['get'+_.upperFirst(k)] = async ({ dispatch, commit, state }) => {
        if(this.debug) console.log('run create '+'get'+_.upperFirst(k));
        if(_.isNull(state[k])){
          await dispatch('update'+_.upperFirst(k));
        }
      };
      r['update'+_.upperFirst(k)] = async ({ commit, state }) => {
        obj.startTimer(k);
        obj.startListen(k);
        if(this.debug) console.log('run update '+'update'+_.upperFirst(k));
        try{
          let res = await this.resolve('get'+_.upperFirst(k));
          commit('raSet'+_.upperFirst(k), !_.isEmpty(res.data.data) ? ((res.data.data && res.data.data[0] && res.data.data[0]['id']) ? _.keyBy(res.data.data, 'id') : res.data.data) : {});
        } catch (exception) {

        }
      };
    });
    return r;
  },
  getters(){
    let r = {};
    let getNameOf = function(name){
      name = _.split(name, ':');
      let vars = [];
      if(_.isString(name[1]))
        vars = _.map(_.split(name[1], ','), _.trim);

      name = name[0];

      return {name, vars};
    };
    _.forEach(this.router.actions, (v, k) => {
      r[k] = state => state[k]; // add itself getter
      r[k+'Status'] = state => state[k+'State'];
      if(_.has(v, 'getters') && !_.isEmpty(v.getters)){
        _.forEach(v.getters, (vv, kk) => { // ['present', 'byKey'] || {byKeyName: byKey, presentName: present}
          if(_.isArray(v.getters)){
            let conf = getNameOf(vv);
            if(_.has(this.gettersLib, conf.name)){
              r[conf.name+_.upperFirst(k)] = state => this.gettersLib[conf.name](state[k], ...conf.vars);
            } else
              console.error(`Unknown API getter ${vv}`);
          } else {
            if(_.isFunction(vv))
              r[kk+_.upperFirst(k)] = vv;
            else {
              let conf = getNameOf(vv);
              if(_.has(this.gettersLib, conf.name)){
                r[kk+_.upperFirst(k)] = state => this.gettersLib[conf.name](state[k], ...conf.vars);
              } else
                console.error(`Unknown API getter ${vv}`);
            }
          }
        });
      }
    });
    return r;
  },
  plugins(){
    return [
      store => {
        this.$store = store;
      }
    ];
  },

  install($Vue, options) {
    let obj = this;
    this.$http = axios.create(); //Vue.prototype.$http;
    if(this.$socket){
      // this.$http.defaults.headers.common['X-Socket-Id'] = this.$socket.socketId();
      this.$http.interceptors.request.use(config => {
        if (obj.$socket.socketId)
          config.headers['X-Socket-Id'] = obj.$socket.socketId();
          // if(obj.debug ) console.log('SOCKET_ID', obj.$socket.socketId());
        return config;
      });
    }

    // Add a response interceptor
    this.$http.interceptors.response.use((response) => response, error => {
        setTimeout(() => {
          if(_.has(error, 'response') && _.has(error.response, 'status')) {
            let s = error.response.status;
            if (_.has(obj.errorMes, s))
              obj.errorMes[s](error);
            else
              obj.errorMes.def(error);
          }

          console.dir(error);
        }, 50);
        return Promise.reject(error);
      }
    );
    this.debug = $Vue.config.devtools;
    // $Vue.mixin({
    //   created: function () {
    //     if(_.isEmpty(obj.$vue))
    //       obj.$vue = this;
    //
    //     if(_.isEmpty(obj.$store))
    //       obj.$store = this.$store;
    //   }
    // });

    $Vue.prototype.$apiResource = $Vue.prototype.$resapi = async (path, data) => {
      obj.$vue = this;
      // obj.$store = this.$store;
      let res = await obj.resolve(path, data);
      return (res.data.data && res.data.data[0] && res.data.data[0]['id']) ? _.keyBy(res.data.data, 'id') : res.data.data;
    };

    $Vue.prototype.$resapi.emit = function(name){
      // console.log('RESAPI emit', obj);
      obj.emitUpdate(name);
    };
    $Vue.prototype.$resapi.setHeaders = (headers) => {
      if(!_.isObject(headers)) {console.error('Headers receive only object!'); return;}
      _.forEach(headers, (v, k) => {
        this.$http.defaults.headers.common[k] = v;
      });
    };
    $Vue.prototype.$resapi.setAuthJWT = token => {
      // this.$http.defaults.headers.common['Authorization'] = 'Bearer ' + token; // {Authorization: 'Bearer ' + user.token}
      $Vue.prototype.$resapi.setHeaders({Authorization: 'Bearer ' + token});
      //
      // if(this.$socket && !this.$channel)
      //   this.startSocket(token);

    };
    $Vue.prototype.$resapi.startEchoChannel = (token, userId) => {
      if(this.$socket && !this.$channel)
        this.startSocket(token, userId);
    };

    $Vue.prototype.$http = this.$http;
  }
};


export default Resolver;
