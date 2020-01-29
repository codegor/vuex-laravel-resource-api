import _ from 'lodash';
import axios from 'axios';
import gettersLib from './getters';
import errorMes from './errorMessage';

const issetPropString = (o, s) => (_.has(o, s) && _.isString(o[s]) && '' != o[s]);

const Resolver = {
  lazyTime: 100,       // time for collect requests and then update all what need once
  stREQ: 'requesting', // text for state requesting
  stFIN: 'finish',     // text for state finish request
  stERR: 'fail',     // text for state fail request
  defTargetMethodCashValidTime: 10*60, // 10*60 seconds - time throw which data in the cash will be valid

  defCSRF:'csrf-token',

  defPlaces: [],
  defLSSave: false,
  defLSTokenKey:        'jwt_axios_access_token',
  defLSTokenExpiredKey: 'jwt_axios_access_token_expired',
  defGlobalTokenKey:        'jwt_axios_access_token',
  defGlobalExpiredKey: 'jwt_axios_access_token_expired',
  defMetaTokenKey:        'jwt-axios-access-token',
  defMetaTokenExpiredKey: 'jwt-axios-access-token-expired',

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
  callAfterAuth: [],
  updateAfterAuth: [],
  updating: [],
  auth: false, // or token
  authExp: -1,
  debug: false,
  gettersLib,
  errorMes,

  m: _.invert(['get', 'load', 'show', 'create', 'update', 'delete']), //methods
  pm:_.invert(['show', 'update', 'delete']), //paramMethod (need id)
  d: _.invert(['create', 'update']), //data Method (need data field)
  md:_.invert(['delete']), //if data present data will be attached
  pd:_.invert(['load']), //param Method (data it is param)
  a: _.invert(['get', 'load', 'show']), //access Method (no need update after)
  c: _.invert(['get']), //store call of Methods when call without Auth, and call when Authenticated
  wa:_.invert(['load', 'show']), // methods which can be call without Authenticate, if set withoutAuthTargetMethods param for route
  s: _.invert(['get']), // methods for which check status, and if requesting, stop

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
  getAuthProp(){
    if(_.has(this.router, 'auth') && _.has(this.router.auth, 'places') && _.isArray(this.router.auth.places) && 0 < this.router.auth.places.length) {
      let a = this.router.auth;
      return {
        places: a.places,

        lsSave:        _.has(a, 'lsSave') ? a.lsSave : this.defLSSave,

        lsTokenKey:    issetPropString(a, 'lsTokenKey') ? a.lsTokenKey : this.defLSTokenKey,
        lsTokenExpKey: issetPropString(a, 'lsTokenExpiredKey') ? a.lsTokenExpiredKey : this.defLSTokenExpiredKey,

        globalTokenKey:    issetPropString(a, 'globalTokenKey') ? a.globalTokenKey : this.defGlobalTokenKey,
        globalTokenExpKey: issetPropString(a, 'globalTokenExpiredKey') ? a.globalTokenExpiredKey : this.defGlobalExpiredKey,

        metaTokenKey:    issetPropString(a, 'metaTokenKey') ? a.metaTokenKey : this.defMetaTokenKey,
        metaTokenExpKey: issetPropString(a, 'metaTokenExpiredKey') ? a.metaTokenExpiredKey : this.defMetaTokenExpiredKey,
      };
    } else
      return false;
  },
  authCheck() {
    let n = Date.now() / 1000 | 0;
    if(0 < this.authExp){
      if(n < this.authExp)
        return !!this.auth;
      else
        this.auth = false;
    }

    let auth = this.getAuthProp();
    if (!auth) return !!this.auth;

    let token = '', exp = -1;

    _.each(auth.places, p => {
      let t, e;
      if('ls' == p){
        t = localStorage.getItem(auth[p+'TokenKey']);
        e = localStorage.getItem(auth[p+'TokenExpKey']);
      }
      if('global' == p){
        t = window[auth[p+'TokenKey']];
        e = window[auth[p+'TokenExpKey']];
      }
      if('meta' == p){
        t = document.head.querySelector('meta[name="'+auth[p+'TokenKey']+'"]');
        e = document.head.querySelector('meta[name="'+auth[p+'TokenExpKey']+'"]');

        t = t ? t.content : t;
        e = e ? e.content : e;
      }
      if(t && n < e && '' == token) {
        token = t;
        exp = e;
      }
    });

    if(!this.auth && token)
      this.authorise(token, exp);


    return !!this.auth;
  },
  setHeaders(headers){
    if(!_.isObject(headers)) {console.error('Headers receive only object!'); return;}
    _.forEach(headers, (v, k) => {
      this.$http.defaults.headers.common[k] = v;
    });
  },
  setXMLHttpRequest(){
    this.setHeaders({'X-Requested-With': 'XMLHttpRequest'});
  },
  setCSRFFromMeta(){
    if(_.has(this.router, 'csrf') && this.router.csrf){
      let f = true === this.router.csrf ? this.defCSRF : this.router.csrf;
      if(!_.isString(f))
        console.error('config of CSRF token field error, should be String', this.router.csrf);

      let token = document.head.querySelector('meta[name="'+f+'"]');

      if(token)
        this.setHeaders({'X-CSRF-TOKEN': token.content});
      else
        console.error('CSRF token not found: https://laravel.com/docs/csrf#csrf-x-csrf-token');
    }
  },
  setSocket(socket){
    this.$socket = socket;
  },
  startSocket(token, userId){
    this.$socket = this.$socket.init(token);
    this.$channel = this.$socket.private('api.'+userId);
  },
  startTimer(a){ // auto update from pool requests (timer)
    // if(this.debug) console.log('REST API: update by timer fire!', a, this.timers);
    let obj = this;
    if(_.has(this.timers, a))
      this.timers[a].id = setTimeout(()=>{obj.$store.dispatch('update' + _.upperFirst(a)); if(obj.debug) console.log('REST API: update by timer fire!', a)}, this.timers[a].sec*1000);
  },
  startListen(a){ // auto update from WS
    if(_.has(this.listeners, a)){
      this.listeners[a]();
      delete this.listeners[a];
    }
  },
  emitUpdate(name) {
    let actions = this.events.get(name);
    if(this.debug) console.log('API Resolver update event', this.$store, this.$state);
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
      this.startUpdating(r);
      this.$store.commit('status'+_.upperFirst(r), this.stREQ);
    } else {
      if(_.has(this.requests, r))
        this.requests[r].concat(p);
      else
        this.requests[r] = [p];


      let finish = () => {
        let i = this.requests[r].indexOf(p);
        this.requests[r].splice(i, 1);
        if(0 === this.requests[r].length) {
          this.$store.commit('status' + _.upperFirst(r), this.stFIN);
          this.stopUpdating(r);
        }
      };

      p.then(finish, finish);
    }
  },
  setStatusFail(){
    this.$store.commit('statusResapi', this.stERR);
  },
  startUpdating(r){
    if(0 == this.updating.length)
      this.$store.commit('statusResapi', this.stREQ);

    if(!_.includes(this.updating, r))
      this.updating.push(r);
  },
  stopUpdating(r){
    _.pull(this.updating, r);

    if(0 == this.updating.length)
      this.$store.commit('statusResapi', this.stFIN);
  },
  authorise(authToken, exp){
    this.setJwt(authToken, exp);

    setTimeout(() => { // need new thread because this function used in vuex getters
      if(!!authToken){
        _.each(this.callAfterAuth, (r) => {
          this.$store.dispatch('update' + _.upperFirst(r));
        }); // action didn't removed from store, because some times you will need relogin or set another AuthJWT token and all call of method without auth should update

        _.each(this.updateAfterAuth, (r) => {
          this.$store.dispatch('update' + _.upperFirst(r));
        });
      }

    }, 5);
  },
  setJwt(authToken, exp){
    this.setHeaders({Authorization: 'Bearer ' + authToken});
    this.auth = authToken;
    this.authExp = exp;

    this.saveJwtToLs(authToken, exp);
  },
  saveJwtToLs(token, exp){
    let p = this.getAuthProp();
    if(p && p.lsSave){
      localStorage.setItem(p.lsTokenKey, token);
      localStorage.setItem(p.lsTokenExpKey, exp);
    }
  },
  isSaveToLs(){
    let p = this.getAuthProp();
    return (p && p.lsSave);
  },
  clearJwtAtLs(){
    let p = this.getAuthProp();
    if(p && p.lsSave){
      localStorage.removeItem(p.lsTokenKey);
      localStorage.removeItem(p.lsTokenExpKey);
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
    }, this.lazyTime);
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

  /**
   *
   * @param path command 'getMeneger'
   * @param data payload
   * @return {
   *          {
   *           go: boolean,
   *           met: *, = 'get | load | show | create | update | delete'
   *           r, = action name 'manager' | 'companyItem'
   *           u: string, = url
   *           peculiar: boolean = own methods
   *          } | {
   *           go: boolean
   *          }
   *         }
   */
  validate(path, data){
    let {s, c, wa, m, pm} = this;
    let res = {go:true};

    if(!_.isString(path)) {console.error('API Resolver don\'t know what to do - path has not a string type! if you want xhr request use vue.$http or vue.$axios'); return;}

    let o = _.split(_.snakeCase(path), '_'); //o = output of operation

    if(!_.has(o, 1)) {console.error('API Resolver don\'t know what to do - path has not 2 part of name!'); return;}

    let d = _.has(this.router, 'delimiter') ? this.router.delimiter : '-';

    let met = o.shift(); //method
    let u = o.join(d);   // url of resourse
    let r = _.camelCase(u); // action in routes.js
    res = {...res, met, r, u, peculiar: false};

    if(_.has(s, met) && _.includes(this.updating, r)){
      if (this.debug) console.log(`Request for ${r} is calling, skip this call...`);
      return;
    }

    if(!_.has(this.router.actions, r)) {console.error('API Resolver don\'t know what to do - path follow to undefined route!'); return;}

    if(_.has(this.router.actions[r], 'needAuth') && true == this.router.actions[r]['needAuth'] &&
      !(_.has(wa, met) && _.has(this.router.actions[r], 'withoutAuthTargetMethods') && true == this.router.actions[r]['withoutAuthTargetMethods'])){
      if (_.has(c, met) && !(_.has(this.router.actions[r], 'updateAfterAuthOff') && true == this.router.actions[r]['updateAfterAuthOff'])
        && !_.includes(this.updateAfterAuth, r))
        this.updateAfterAuth.push(r); // this is for recall always when reauth

      if(!this.authCheck()) { // check for auth
        if (this.debug) console.log('Auth has not set, store request, and after set AuthJWT all will be called...');

        if (_.has(c, met)) {
          if (_.has(this.router.actions[r], 'updateAfterAuthOff') && true == this.router.actions[r]['updateAfterAuthOff']
            && !_.includes(this.callAfterAuth, r))
            this.callAfterAuth.push(r);
        } else if (this.debug)
          console.info('You ran api request for route with Auth, but Auth has not set, first, set Auth ($resapi.setAuthJWT(token)) or use auth prop from route.js conf file');

        if(this.hasOwnProperty('authFail') && _.isFunction(this.authFail))
          this.authFail();

        return;
      }
    }

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
    let {pm, d, pd, md} = this;
    let t = {get: 'get', load: 'get', show: 'get', create: 'post', update: 'put', delete: 'delete'}; // transform

    let {u, r, met, go, peculiar} = this.validate(path, data);
    if(!go) return;

    let url = this.router.prefix + u;

    let p, c;

    this.status(r);

    // request
    if(peculiar)
      c = this.router.actions[r].methods[met](url, data);
    else {
      c = {
        method: t[met],
        url: url + ((_.has(pm, met)) ? '/' + data.id : '')
      };

      if (_.has(d, met) || (_.has(md, met) && 1 < Object.getOwnPropertyNames(data).length))
        c.data = data;

      if (_.has(pd, met))
        c.params = data;
    }
    p = this.$http(c);

    this.afterReq(p, r, met);

    return p;
  },

  states(){
    let r = {};
    r['resapiStatus'] = null;
    _.each(this.router.actions, (v, k) => {
      r[k] = null;
      r[k+'State'] = null;
      if(!(_.has(v, 'loadMethodCashOff') && true == v['loadMethodCashOff']))
        r[k+'CashLoad'] = {};
      if(!(_.has(v, 'showMethodCashOff') && true == v['showMethodCashOff']))
        r[k+'CashShow'] = {};
    });
    return r;
  },
  mutations(){
    let r = {};
    if(this.isSaveToLs)
      r.resapiLogout = r.resapiClearJwtAtLs = () => this.clearJwtAtLs();

    r['statusResapi'] = (state, status) => {if(this.debug) console.log('setted '+'statusResapi', status); state['resapiStatus'] = status;};

    _.forEach(this.router.actions, (v, k) => {
      r['resapi'+_.upperFirst(k)] = (state, data) => {if(this.debug) console.log('setted '+'resapi'+_.upperFirst(k), data); state[k] = data;};
      r['status'+_.upperFirst(k)] = (state, status) => {if(this.debug) console.log('setted '+'status'+_.upperFirst(k), status); state[k+'State'] = status;};

      if(!(_.has(v, 'loadMethodCashOff') && true == v['loadMethodCashOff']))
        r['cashLoad'+_.upperFirst(k)] = (state, {params, resp}) => {
          if(this.debug) console.log('setted '+'cashLoad'+_.upperFirst(k), params, resp);
          state[k+'CashLoad'][JSON.stringify(params)] =  {time: Date.now(), resp: resp};
        };
      if(!(_.has(v, 'showMethodCashOff') && true == v['showMethodCashOff']))
        r['cashShow'+_.upperFirst(k)] = (state, {params, resp}) => {
          if(this.debug) console.log('setted '+'cashShow'+_.upperFirst(k), params, resp);
          state[k+'CashShow'][JSON.stringify(params)] = {time: Date.now(), resp: resp};
        };
    });
    return r;
  },
  actions(){
    let obj = this;
    let r = {};
    _.forEach(this.router.actions, (v, k) => {
      r['get'+_.upperFirst(k)] = async ({ dispatch, state }) => {
        if(this.debug) console.log('run get'+_.upperFirst(k));
        if(_.isNull(state[k])){
          await dispatch('update'+_.upperFirst(k));
        }
      };
      r['update'+_.upperFirst(k)] = async ({ commit }) => {
        obj.startTimer(k);
        obj.startListen(k);
        if(this.debug) console.log('run update '+_.upperFirst(k));
        try{
          let res = await this.resolve('get'+_.upperFirst(k));
          commit('resapi'+_.upperFirst(k), !_.isEmpty(res.data.data) ? ((res.data.data && res.data.data[0] && res.data.data[0]['id']) ? _.keyBy(res.data.data, 'id') : res.data.data) : {});
        } catch (exception) {

        }
      };

      if(!(_.has(v, 'loadMethodCashOff') && true == v['loadMethodCashOff'])) {
        r['load' + _.upperFirst(k)] = async ({dispatch, state}, params) => {
          if (this.debug) console.log('run load' + _.upperFirst(k), params);
          let paramKey = JSON.stringify(params);
          if (_.has(state[k+'CashLoad'], paramKey)) {
            let liveTime = _.has(v, 'loadMethodCashUpdate') ? v['loadMethodCashUpdate'] : this.defTargetMethodCashValidTime;

            if(('number' == typeof liveTime && Date.now() <= state[k+'CashShow'][paramKey].time+(liveTime*1000)) || 'socket' === liveTime)
              return state[k+'CashLoad'][paramKey].resp;
            else
              return await dispatch('updateLoad' + _.upperFirst(k), params);

          } else
            return await dispatch('updateLoad' + _.upperFirst(k), params);
        };
        r['updateLoad'+_.upperFirst(k)] = async ({ commit }, params) => {
          // obj.startListen(k); // TODO: uncomment when socket update will be work on
          if(this.debug) console.log('run update cashLoad'+_.upperFirst(k));
          let resp = {};
          try{
            let res = await this.resolve('load'+_.upperFirst(k), params);
            resp = !_.isEmpty(res.data.data) ? ((res.data.data && res.data.data[0] && res.data.data[0]['id']) ? _.keyBy(res.data.data, 'id') : res.data.data) : {};
            commit('cashLoad'+_.upperFirst(k), {params, resp});
          } catch (exception) {

          }
          return resp;
        };

        if(_.has(v, 'loadGetters') && !_.isEmpty(v.loadGetters)) {
          _.each(this.createGetters(v.loadGetters, k), (vv, kk) => {
            r['load' + _.upperFirst(kk)] = async ({dispatch}, params) => {
              let res = await dispatch('load' + _.upperFirst(k), params);
              return !_.isEmpty(res) ? vv(res) : res;
            };;
          });
        }
      }
      if(!(_.has(v, 'showMethodCashOff') && true == v['showMethodCashOff'])) {
        r['show' + _.upperFirst(k)] = async ({dispatch, state}, params) => {
          if (this.debug) console.log('run show' + _.upperFirst(k), params);
          let paramKey = JSON.stringify(params);
          if (_.has(state[k+'CashShow'], paramKey)) {
            let liveTime = _.has(v, 'showMethodCashUpdate') ? v['showMethodCashUpdate'] : this.defTargetMethodCashValidTime;

            if(('number' == typeof liveTime && Date.now() <= state[k+'CashShow'][paramKey].time+(liveTime*1000)) || 'socket' === liveTime)
              return state[k+'CashShow'][paramKey].resp;
            else
              return await dispatch('updateShow' + _.upperFirst(k), params);

          } else
            return await dispatch('updateShow' + _.upperFirst(k), params);
        };
        r['updateShow'+_.upperFirst(k)] = async ({ commit }, params) => {
          // obj.startListen(k); // TODO: uncomment when socket update will be work on
          if(this.debug) console.log('run update cashShow'+_.upperFirst(k));
          let resp = {};
          try{
            let res = await this.resolve('show'+_.upperFirst(k), params);
            resp = !_.isEmpty(res.data.data) ? ((res.data.data && res.data.data[0] && res.data.data[0]['id']) ? _.keyBy(res.data.data, 'id') : res.data.data) : {};
            commit('cashShow'+_.upperFirst(k), {params, resp});
          } catch (exception) {

          }
          return resp;
        };

        if(_.has(v, 'showGetters') && !_.isEmpty(v.showGetters)) {
          _.each(this.createGetters(v.showGetters, k), (vv, kk) => {
            r['show' + _.upperFirst(kk)] = async ({dispatch}, params) => {
              let res = await dispatch('show' + _.upperFirst(k), params);
              return !_.isEmpty(res) ? vv([res])[0] : res;
            };
          });
        }
      }
    });
    return r;
  },
  createGetters(getters, k){
    let r = {};
    let getNameOf = function(getts){
      let name  = (-1 != _.indexOf(getts, '>')) ? _.split(getts, '>')[0] : '';
      let data  = (-1 != _.indexOf(getts, '>')) ? _.split(getts, '>')[1] : getts;
      let get = (g) => {
        g = _.split(g, ':');
        let n = g[0]; // name of getter
        let v  = []; // vars for getter
        if(_.isString(g[1]))
          v = _.map(_.split(g[1], ','), _.trim);

        return {name:n, vars: v};
      };
      let chain = [];

      getts  = (-1 != _.indexOf(data, '|')) ? _.split(data, '|') : [data];

      _.each(getts, gett => {
        let d = get(gett);

        if('' === name)
          name = d.name;

        chain.push(d);
      });

      return {name, chain};
    };

    _.each(getters, (vv, kk) => { // ['present', 'byKey', 'name>byKey|present'] || {byKeyName: byKey, presentName: present}
      if(_.isArray(getters)){
        let conf = getNameOf(vv);
        r[conf.name+_.upperFirst(k)] = res => {
          _.each(conf.chain, gett => {
            if(_.has(this.gettersLib, gett.name)){
              res = this.gettersLib[gett.name](res, ...gett.vars);
            } else
              console.error(`Unknown API getter ${vv} (${gett.name})`);
          });
          return res;
        }
      } else { // seems getters is object
        if(_.isFunction(vv))
          r[kk+_.upperFirst(k)] = res => vv(res);
        else {
          let conf = getNameOf(vv);
          r[kk+_.upperFirst(k)] = res => {
            _.each(conf.chain, gett => {
              if(_.has(this.gettersLib, gett.name)){
                res = this.gettersLib[gett.name](res, ...gett.vars);
              } else if(_.has(getters, gett.name)){
                res = getters[gett.name](res, ...gett.vars);
              } else
                console.error(`Unknown API getter ${vv} (${gett.name})`);
            });
            return res;
          };
        }
      }
    });

    return r;
  },
  getters(){
    let r = {
      resapiIsAuthorized: () => this.authCheck(),
      resapiAuthToken:    () => this.auth,
      resapiAuthTokenExp: () => this.authExp
    };
    r['resapiStatus'] = state => state['resapiStatus'];
    r['isResapiRequesting'] = state => state['resapiStatus'] == this.stREQ;
    r['isResapiFail'] = state => state['resapiStatus'] == this.stERR;

    _.each(this.router.actions, (v, k) => {
      r[k] = state => state[k];                  // add itself getter
      r[k+'Status'] = state => state[k+'State']; // add getter for itself status
      r['is'+_.upperFirst(k)+'Requesting'] = state => state[k+'State'] == this.stREQ; // add getter for itself status bool

      if(_.has(v, 'getters') && !_.isEmpty(v.getters))
        _.each(this.createGetters(v.getters, k), (vv, kk) => { r[kk] = state => vv(state[k]); });

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

    this.$http = axios.create();
    this.setXMLHttpRequest();
    this.setCSRFFromMeta();
    this.authCheck();

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
              obj.errorMes[s](error, obj);
            else
              obj.errorMes.def(error, obj);
          }

          obj.setStatusFail();

          if(obj.debug) console.dir(error);
        }, 50);
        return Promise.reject(error);
      }
    );
    this.debug = $Vue.config.devtools;

    /**
     * @param path string - this filed have 2 connected part: first is the method, and second is the resource
     *                    method could be: get, load, show, create, update, delete
     *                      get = method: 'GET', url: {prefix} + {action key} + '/'; (below in short view)
     *                      load = GET /?param=xxx&...;
     *                      show = GET /id;
     *                      create = POST /;
     *                      update = PUT /id;
     *                      delete = DELETE /id;
     *                    resource - it is a key of routes in config file with fist letter in upper case
     *
     *                    example: 'getManager', 'createManager', 'deleteCompanyItem' (see example/routes.js)
     *                      'deleteCompanyItem' url will be "{prefix} + 'company-item' + '/id'",
     *                          by default the lib use kebab case (with "-") for transform CamelCase,
     *                          but you can change to snake (with "_"), if you set in routes.js file 'delimiter' field to "_";
     *
     *                    About methods:
     *                    - 'show', 'update', 'delete' methods these are methods with a parameter, and in @param 'data' you should set 'id' key
     *                    - 'create' and 'update' methods these are data methods and @param 'data' should be every times
     *                    - 'load' method it is param method. It is like get method, but with params (in @param 'data' you can set all params)
     *                    - 'get', 'load', 'show' methods these are data access methods and after these methods will not be called auto update of itself (and cascade updates)
     *                    - You can add your own methods, for this you can set 'methods' field in route config.
     *                      Methods field expects object where key it is a name of new method and value should be a function and lib will send 2 params function(url, data),
     *                      where url - it is a action name, data - it is a data from $resapi call.
     *
     * @param data object - it is data for Axios request, but for some method must be id field (see above, @param path)
     */
    $Vue.prototype.$apiResource = $Vue.prototype.$resapi = async (path, data) => {
      let res = await obj.resolve(path, data);
      return (res.data.data && res.data.data[0] && res.data.data[0]['id']) ? _.keyBy(res.data.data, 'id') : res.data.data;
    };

    /**
     * @param name string - Name of event,  which set at 'updateOn' field of API route resource at routes.js cofig file
     */
    $Vue.prototype.$resapi.emit = name => {
      obj.emitUpdate(name);
    };

    /**
     * @param headers object - {name_of_header: "this is value of named header", ...}
     */
    $Vue.prototype.$resapi.setHeaders = headers => {
      obj.setHeaders(headers);
    };

    /**
     * If you use JWT Auth, to set Header you can use this function
     *
     * @param token string - Bearer token for auth
     *
     * @example
     * App.vue {
     *   created(){
     *     this.$resapi.setAuthJWT(session_token);
     *   }
     * }
     */
    $Vue.prototype.$resapi.setAuthJWT = (token, exp) => {
      obj.authorise(token, exp);
    };

    /**
     * If you want to use auto show message, you need set Vue instance at the App.vue, created() hook
     *
     * @param vue object Vue instance
     *
     * @example
     * App.vue {
     *   created(){
     *     this.$resapi.setVue(this);
     *   }
     * }
     */
    $Vue.prototype.$resapi.setVue = vue => {
      obj.$vue = vue;
    };

    /**
     * @param token string - Bearer token for auth
     * @param userId integer - user id for Laravel Echo node server
     *
     * In routers.js you must set post in 'socket' field.
     */
    $Vue.prototype.$resapi.startEchoChannel = (token, userId) => {
      if(this.$socket && !this.$channel)
        this.startSocket(token, userId);
    };

    $Vue.prototype.$resapi.logout = $Vue.prototype.$resapi.clearJwtAtLs = () => this.clearJwtAtLs();

    $Vue.prototype.$http = this.$http;
  }
};


export default Resolver;

export function needAuth(routes){
  let res = {};
  _.each(routes, (conf, name) => {
    res[name] = Object.assign({needAuth: true}, conf);
  });
  return res;
};
