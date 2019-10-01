import {needAuth} from 'vuex-laravel-resource-api';

export default { // example of api routing for laravel resources rest api
  prefix: '/api/',
  socket: '', // set only port like ':6001' or nothing, empty string like ''
  // delimiter: '-', // kebab = "-" (default), snake = "_"

  actions: {
    ...needAuth({ // if you need show, than some api points is under auth protection, you can use this help function, all call for getData will be called when Auth will be set
      manager: { // name of resource CamelCase (will be transformed to kebab case (with "-"))
        // will be by default: get - get /; load - get /?param=xxx; show - get /id; create - post /; update - put /id; delete - delete /id;
//      methods: {}, // if ever I will have another request like rest it will be there (object of functions)
//      update: [], // if we need some update actions after this action (by default after change action resourse update itself) // ['name of resource 1 (without 'get' or else)', 'name 2', etc] - will be get request
//      connected: '',  //'' | [] // it means that if connected action run update, this action will updated too
//      autoUpdateOff: true, // if need turn off autoupdate
//      lazyUpdateOff: true, // if need turn off lazyupdate
//      updateAfterAuthOff: true, // if need turn off auto update if you change Auth JWT
        updateOn: ['createProject', 'export'], //'' | [] //event name, which will be called for update cache for this route. May be string may be array
        // updateTimer: 10*60, // number of seconds for timer for update cache
        updateSocket: true, // if present REST API will be listen Laravel-WebSocket.IO event (name like action key) from 'api' channel
        autoMessOff: true, // if need turn off message after success api request
        name: 'Manager', // name for auto message which will be inserted to
//      getters: [], // if we need calculated fields there we can write it. Name will be curent name + resourse name, like examplManager or can be listed from getters lib like [string, string] or {name:'getter1', name2:'getter2'} (operate only with resource state var)
        getters: ['groupedTree:project_id,id,parent_id,name', 'sumUniq:url,size', // example: 'byKey'
          'sumUniq:url,size|byCustKey:name',                // use chain of getters (name will be from first getters)
          'sumUniqFiltered>sumUniq:url,size|byCustKey:name' // use chain of getters with set name of getters
        ],
//    getters: { // or you can add your own getter function or rename gatters from default lib
//        presentMy: data => {                // add getter with name 'presentMy'
//          return _.filter(data, { 'deleted_at': null });
//        },
//        byKey: data => {                    // add getter with name 'byKey'
//          return _.keyBy(data, 'id');
//        },
//        myCoolKey: 'sumUniq:url,size'
//        myCoolKeyFiltered: 'sumUniq:url,size|byCustKey:name' // use chain of getters (name will be from key of var)
//        presentMyByKey: 'presentMy|byKey',  // you can use your own getters, defined in this object
//      }
      },
    }),
    companyItem: { // name of resource CamelCase (will be transformed to kebab case (with "-"))
      // will be by defoult: // get-all - get /, show - get /id, create - post /, update - put /id, delete - delete /id
//      methods: {}, // if ever i will have another request like rest it will be there (object of functions)
//      update: [], // if we need some update actions after this action (by default after change action resourse update itself) // ['name of resource 1 (without 'get' or else)', 'name 2', etc] - will be get request
      connected: 'manager',  //'' | [] // it means that if connected action run update, this action will updated too
//      autoUpdateOff: true, // if need turn off autoupdate
//      lazyUpdateOff: true, // if need turn off lazyupdate
      updateOn: 'createProject', //'' | [] //event name, which will be called for update cache for this route. May be string may be array
      // updateTimer: 20*60, // number of seconds for timer for update cache
      updateSocket: true, // if present REST API will be listen Laravel-WebSocket.IO event (name like action key) from 'api' channel
      autoMessOff: true, // if need turn off message after success api request
      name: 'Thumbnails', // name for auto message which will be inserted to
//      getters: [], // if we need calculated fields there we can write it. Name will be curent name + resourse name, like examplCompanyItem or can be listed from getters lib like [string, string] or {name:'getter1', name2:'getter2'} (operate only with resource state var)
      getters: ['byCustKey:file_url'], // example: 'byKey'
    },
    // ...
  }
}
