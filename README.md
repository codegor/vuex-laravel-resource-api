# vuex-laravel-resource-api
**Library for Vuex+Laravel REST Controller API**

Easy Vuex api request when at Laravel you use REST Controller.

**Installation**
npm install vuex-laravel-resource-api

**How to use?**

First you need create in store vuex folder module api, then create at that folder 2 files:
 - index.js
 - routes.js
 
 Example of this files you can see at example folder.
 
 At any component you can use rest-api request by call (use somewhere in your code)
 ```javascript
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
 this.$resapi(path, data).then(a => {
   // actions after success
 });
 ``` 
 or 
 ```javascript
 /**
 * @param path string (see above)
 * @param data object (see above)
 */
 this.$apiResource(path, data).then(a => {
  // actions after success
});
 ``` 
 
 You can use Vuex mapActions, mapGetters for get data from Laravel REST API Controller (example of Vue component, with routes.js from example/routes.js):
 ```javascript
 import _ from 'lodash';
 import {mapGetters, mapActions} from 'vuex';
 import {validate} from "promised-form-validate";

 export default {
  computed: {
      ...mapGetters({ // getters created from routes.js config file, first part it is from 'getters' config field, second part it is a resource name with upper case first letter
        manager: 'groupedTreeManager', // 'groupedTree' it is a getter, 'manager' it is a source of data for getters (data received from manager API point)
        managerStatus: 'managerStatus', // Can bee 'requesting' or 'finish'. It is a special getter, it's created for all resources, and its show loading status (request progress). Current is for 'manager' resource 
        item: 'byCustKeyCompanyItem' // 'byCustKey' getter, resource - 'companyItem'
      }),
      
      //....
      
      processing(){
        return 'requesting' === this.managerStatus;
      }
  },
  methods: {
      ...mapActions([
        'getManager', // action for run API request for get data, resource - 'manager'
        'updateManager', // action for update data for Manager resource
        'getCompanyItem' // action for run API request for get data, resource - 'companyItem'
      ]),
      
      // ....
      
      updateAll() {
        this.updateManager(); // run action update data from manager API point
      },
      
      // .....
      
      renderManager() {
        if (!_.isUndefined(this.manager[this.p_id])) {
          let p = this.manager[this.p_id];
          // and other work ....
          
        }
      },
      create(form){
        validate(form).then( a => {
          this.$resapi('createManager', a).then(r => {
            this.newId = r.id;
            // and so on ....
          });
        });
      },
      update(item){
        validate(form).then( a => {
          this.$resapi('updateManager', a);
        });
      },
      
      // ....
  },
  created() { // or mounted()
      this.getManager().then(() => { // run action gat data from manager API point
        // any your code which will be executed after data will received
      });
      this.getCompanyItem(); // run action gat data from company-item API point
  }
 }
  ``` 
 
 The library create global var for its **Axios** instance, you can get it from (usually unnecessary):
 ```javascript
 this.$http
 ```
 
 **Function** for set Bearer Auth header (will be cool if you set up JWT Token in app.js file or in vuex init file, when init Vue and Vuex):
 ```javascript
  /**
  * @param token string - Bearer token for auth
  */
  this.$resapi.setAuthJWT(token)
 ```
 
 **Function** for set headers for rest API Axios (function for more control of headers of Axios, usually unused):
 ```javascript
  /**
  * @param headers object - {name_of_header: "this is value of named header", ...}
  */
  this.$resapi.setHeaders(headers)
 ```
 
 **Function** for emit event from application, after which all marked resource updated (use somewhere in your code):
  ```javascript
  /**
  * @param name string - Name of event,  which set at 'updateOn' field of API route resource at routes.js cofig file
  */
  this.$resapi.emit(name);
  ```
 
 **Function** for start web socket (implements with Laravel Echo), use somewhere in your code:
 ```javascript
 /**
 * @param token string - Bearer token for auth
 * @param userId integer - user id for Laravel Echo node server
 */
 this.$resapi.startEchoChannel(token, userId);
 ```
 
 You can set (at route config file for resource (action) field: _**'updateSocket'**_) update API data by event from Echo. 
 REST API will be listen Laravel-WebSocket.IO event (name like route resource key) from 'api' channel.
 (For this functionality you should set in routes.js _**'socket'**_ field with port number of current server for WS connection, 
 for example ':6001', or set to empty string like '' for disable its.)
 
 Or you can use long pooling: _**'updateTimer'**_ field of action config at routes.js.
 
 Also you can set cascade update some actions when one action updated, for this use field of action config - **_'update'_**.
 Or you can set at field of action config: _**'connected'**_ list of resource after update which the resource should update itself.
 
 Also after you modify resource (call update or delete or create), the resource will auto update itself, 
 if you want to disable this behavior at config file for action set field: _**'autoUpdateOff'**_ to true.
 
 The library has lazy update behavior (by default). This means that if you quickly invoke the creation action many times,
 usually, after each create action, the resource update itself will be called, but with a lazy update, only one auto update action will be called. 
 If you want to disable this behavior you can set in config of resource field: _**'lazyUpdateOff'**_ to true.
 
 The library also has auto massage after success action (create, update, delete). 
 The library call global method of Vue _**'showMess'**_ for show massage.
 If you want use this functionality, you should to define this global method at **example/index.js**.
 If you want disable this functionality for one or more action (resource) you can set field of config _**"autoMessOff"**_ to true.
 For normal work of auto message you should set _**'name'**_ field of resource at config file.
 
 The library has default error massage (500, 401, 404, unexpected error), and you can change it to your own, as you can see on **example/index.js**.
 
 The _**'getters'**_ field of resource config set vuex getters for data from API. 
 It is very convenient for structure row data from DB from Laravel REST API. 
 The list of available getters you can see at **src/getters.js**. You can set your own getters, as you can see on **example/index.js**
 
_**Getters List**_

Getters file consist fom 2 part: 1 part it is a help constant, and second part it is a work of getters.
Getters come in 3 types:
 1) without params
 2) with params
 3) and with return function from getters
 
 If getters with params, in routes.js in action config in getters field you should set those params are through the colon:
 ```javascript
  {
    getters: ['sumUniq:url,size'] // where 'url' and 'size' it is first and second param of sumUniq getter
  }
 ```
 
 If getters with return function from getters:
 
 
routes.js:
```javascript
    {
     getters: ['presentFilterDateFilteredFormatted:properties,id,status,active'] // where 'properties', 'id', 'status', 'active' it is params of presentFilterDateFilteredFormatted getter
    }
```
  
in code:
```javascript
  //function(field, operation, val)
  let data = this.presentFilterDateFilteredFormattedManager('price', '<=', this.price, ); 
```
 
list of getters:
```javascript
/**
* Get only present items from DB data, without deleted items
* filtered by "deleted_at == null" 
* 
* @return array
*/
present();

/**
* Get only present items from DB data, without deleted items, and filter that result by @param field with @param val
* 
* @return function(val, field);
* 
* returned function params:
* @param val string - value for filtering 
* @param field string - field for filtering
* 
* @returnd_function_return array
* 
* @example 
*   in routers.js:
*     getters: [presentFilter]
*   in code:
*     let data = this.presentFilterManager(this.user_id, 'user_id');
*/
presentFilter();

/**
* It is like presentFilter(), but without present filter.
* 
* @return function(val, field);
* 
* see above
*/
filter();

/**
* Filter data by field and value like above, but with different operation, variants: '>', '>=', '<', '<=', '==', '!=' 
* 
* @return function(field, operation, val);
* 
* returned function params:
* @param val string - value for filtering 
* @param field string - field for filtering
* @param operation string from ['>', '>=', '<', '<=', '==', '!=']
*/
filterDate();

/**
* It is like filterDate(), but with present filter.
* 
* @return function(field, operation, val);
* 
* see above
*/
presentFilterDate();

/**
* It is like presentFilterDate(), but with pre filter by @param fd_field and array of values for this field.
*  
* @param fd_field string - field for filtering
* @param fd_val array - In config to fd_val gets all after first param; example: 'presentFilterDateFiltered:field,val1,val2,val3'
* 
* @return function(field, operation, val);
* 
* see above
*/
presentFilterDateFiltered(fd_field, ...fd_val);

/**
* It is like presentFilterDateFiltered(), but with change format of element - transform Laravel many to many relation.
* 
* @param fr_field string foreign table name
* @param fr_key string key in foreign table
* 
* @return function(field, operation, val);
* 
* see above
*/
presentFilterDateFilteredFormatted(fr_field, fr_key, fd_field, ...fd_val);

/**
* Filter present() items by @param field and array of values for this field.
* 
* @param filed string - field for filtering
* @param val array - In config to fd_val gets all after first param; example: 'presentFiltered:field,val1,val2,val3'
* 
* @return array
*/
presentFiltered(field, ...val);

/**
* Filter by @param field and array of values for this field.
*
* @param filed string - field for filtering
* @param val array - In config to fd_val gets all after first param; example: 'presentFiltered:field,val1,val2,val3'
*
* @return array
*/
filtered(field, ...val);

/**
* Formatter which change format of element - transform Laravel many to many relation
* 
* @param field string foreign table name
* @param key string key in foreign table
* 
* @return array
*/
presentFormatted(field, key);

/**
* Return present items but like object, where key is id form collection
* 
* @return object || array (if function cannot find id key)
*/
presentByKey();

/**
* Return items but like object, where key is id form collection
* 
* @return object || array (if function cannot find id key)
*/
byKey();

/**
* Return items but like object, where key is @param 'key' form collection
* 
* @param key string - name of col for set key for row of collection
* 
* @retrun object || array (if function cannot find key in collection from 'key' @param)
*/
byCustKey(key);

presentFilterByKey(val, field); // return object || array (if function cannot find id key)

filterByKey(); // return function(val, field); and then return object || array (if function cannot find id key)

filterDateByKey(); // return function(field, operation, val); and then return object || array (if function cannot find id key)

presentFilterDateByKey(); // return function(field, operation, val); and then return object || array (if function cannot find id key)

presentFilterDateFilteredByKey(fd_field, ...fd_val);  // return function(field, operation, val); and then return object || array (if function cannot find id key)

presentFilteredByKey(field, ...val); // return object || array (if function cannot find id key)

filteredByKey(field, ...val); // return object || array (if function cannot find id key)

presentFormattedByKey(field, key); // return object || array (if function cannot find id key)

/**
* Find item of collection with later definition of condition
* 
* @return function(val, field); 
* @then_return any - item of collection with this condition
*/
filterByVal();

/**
* Create a tree from flat data
* 
* @param mainGroupName string - col for first grouping
* @param id string - name of key value
* @param parent string - name of parent key value
* @param name string - name value which will be index of item
* 
* @retrun object {proj1: {name:{...row recursive}}}
*/
groupedTree(mainGroupName, id, parent, name);

groupTwice(fieldRoot, fieldSecond); // return object { fieldRoot: {filedSecond: [..], ..}, ...}

/**
* Return Grouped Twicw Tree object from flat data
* 
* @param fieldRoot string
* @param fieldSecond string
* @param id string - name of key value
* @param parent string - name of parent key value
* @param name string - name value which will be index of item
* 
* @return object { fieldRoot: {filedSecond: [..], ..}, ...}
*/
groupTwiceTree(fieldRoot, fieldSecond, id, parent, name);
 
/**
* getter with lodash function
* 
* @param field string
* 
* @return groupeg by @param field object
*/
group(field);

/**
* getter with lodash function sumBy @param 'field'
* 
* @param field string
* 
* @return number
*/
sum(field);

/**
* getter with lodash function sumBy @param 'sumfield' but only uniqBy @param 'unicfield' of its
* 
* @param unicfield string
* @param sumfield string
* 
* @return number
*/
sumUniq(unicfield, sumfield);
```