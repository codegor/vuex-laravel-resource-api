import _ from 'lodash';

const act = { //actions
  present(r){
    return _.filter(r, { 'deleted_at': null });
  },
  byKey(r){
    return (r[0] && r[0]['id']) ? _.keyBy(r, 'id') : r;
  },
  byCustKey(r,k){ // k - key
    let a = _.values(r);
    return (a[0] && a[0][k]) ? _.keyBy(r, k) : r;
  },
  filter(r,v,f){ // filter by value - v of the col - f, r - data
    let conf = {};
    conf[f] = v;
    return _.filter(r, conf);
  },
  formatte(r, f, k){ // change formatte of element - many to many relation
    let res = [];
    _.each(r, (v) =>{
      let c = _.clone(v);
      c[f] = _.map(c[f],k);
      res.push(c);
    });
    return res;
  },
  filterDate(r,f,op,v){ // filter by date - v of the col - f, r - data, op - operation type - > >= < <= == !=
    let ops = {'>':'gt', '<':'lt', '<=':'lte', '>=':'gte', '==':'eq'};
    if(!_.has(ops, op)){
      console.error('Wrong operation', op);
      return [];
    }
    return _.filter(r, function(o){
      return _[ops[op]](o[f],v);
    });
  },
  filterArray(r,f,v){ // filter by values - v of the col - f, r - data
    return _.filter(r, function(o){
      return _.includes(v, o[f]);
    });
  },
  groupBy(r, f){ // col - f, r - data
    return _.groupBy(r, f);
  },
  treeWithParent(r,p,k){ // r - data p - parent, k - nameKay
    let getNestedChildren = (arr, parent, k) =>{
      k = k || 'id';
      let out = {};
      for(var i in arr) {
        if(arr[i].parent == parent) {
          let children = getNestedChildren(arr, arr[i].id, k);

          out[arr[i][k]] = _.clone(arr[i]);

          if(Object.keys(children).length) {
            out[arr[i][k]].children = children;
          }
        }
      }
      return out;
    };
    return getNestedChildren(r, p, k);
  },
  tree(r,k,p,n){ // r - data, k - name of key value, p - name of parent key value, n - name value which will be index of item
    let data = [];
    let keys = [];
    r.map(function(x){
      data.push(_.clone(x));
      keys.push(x[k]);
    });
    data.map(function(x){
      x.children = {};
    });
    var roots = data.filter(function(x){return keys.indexOf(x[p])==-1});
    var nodes = [];
    roots.map(function(x){nodes.push(x)});
    while(nodes.length > 0){
      let node = nodes.pop();
      let children =  data.filter(function(x){return x[p] == node[k]});
      children.map(function(x){
        node.children[x[n]] = x;
        nodes.push(x);
      });
    }
    return roots;
  },
  getParentRoots(r, p, n){ // r- data, p - parent, n - name, value which will be index of item
    let out = {};
    r.map(function(x){out[x[n]] = x});
    let tmp = _.groupBy(out, p);
    out = {};
    for(let i in tmp) {
      out[i] = {};
      tmp[i].map(function(x){out[i][x[n]] = x});
    }
    return out;
  },
  sum(r,f){ // sum by field (f)
    return _.sumBy(r,f);
  },
  uniq(r,f){ // get unic items from resource (r) by field f
    return _.uniqBy(_.values(r),f);
  },
};

export default {
  present: resource => {
    return act.present(resource);
  },
  presentFilter: (resource) => (val, field) => {
    return act.filter(act.present(resource), val, field);
  },
  filter: (resource) => (val, field) => {
    return act.filter(resource, val, field);
  },
  filterDate: (resource) => (field, operation, val) => {
    return act.filterDate(resource, field, operation, val);
  },
  presentFilterDate: (resource) => (field, operation, val) => {
    return act.filterDate(act.present(resource), field, operation, val);
  },
  presentFilterDateFiltered: (resource, fd_field, ...fd_val) => (field, operation, val) => {
    return act.filterDate(act.filterArray(act.present(resource), fd_field, fd_val), field, operation, val);
  },
  presentFilterDateFilteredFormatted: (resource, fr_field, fr_key, fd_field, ...fd_val) => (field, operation, val) => {
    return act.formatte(act.filterDate(act.filterArray(act.present(resource), fd_field, fd_val), field, operation, val), fr_field, fr_key);
  },
  presentFiltered: (resource, field, ...val) => {
    return act.filterArray(act.present(resource), field, val);
  },
  filtered: (resource, field, ...val) => {
    return act.filterArray(resource, field, val);
  },
  presentFormatted: (resource, field, key) => { // field and set with `:field,key`
    return act.present(act.formatte(resource, field, key));
  },
  presentByKey: resource => {
    return act.byKey(act.present(resource));
  },
  byKey: resource => {
    return act.byKey(resource);
  },
  byCustKey: (resource, key) => {
    return act.byCustKey(resource, key);
  },
  presentFilterByKey: (resource) => (val, field) => {
    return act.byKey(act.filter(act.present(resource), val, field));
  },
  filterByKey: (resource) => (val, field) => {
    return act.byKey(act.filter(resource, val, field));
  },
  filterDateByKey: (resource) => (field, operation, val) => {
    return act.byKey(act.filterDate(resource, field, operation, val));
  },
  presentFilterDateByKey: (resource) => (field, operation, val) => {
    return act.byKey(act.filterDate(act.present(resource), field, operation, val));
  },
  presentFilterDateFilteredByKey: (resource, fd_field, ...fd_val) => (field, operation, val) => {
    return act.byKey(act.filterDate(act.filterArray(act.present(resource), fd_field, fd_val), field, operation, val));
  },
  presentFilteredByKey: (resource, field, ...val) => {
    return act.byKey(act.filterArray(act.present(resource), field, val));
  },
  filteredByKey: (resource, field, ...val) => {
    return act.byKey(act.filterArray(resource, field, val));
  },
  presentFormattedByKey: (resource, field, key) => {
    if(_.isUndefined(field) || _.isUndefined(key)){
      console.error('Getter presentFormattedByKey need 2 and 3 arguments');
      return [];
    }
    return act.byKey(act.present(act.formatte(resource, field, key)));
  },
  filterByVal: (resource) => (val, field) => {
    return resource.find(todo => todo[field] === val)
  },
  groupedTree: (resource, mainGroupName, id, parent, name) => { // mainGroupName - col for first grouping, id - name of key value, parent - name of parent key value, name - name value which will be index of item
    let groups = act.groupBy(resource, mainGroupName);
    let out = {};
    for(let i in groups)
      out[i] = act.getParentRoots(act.tree(groups[i], id, parent, name), parent, name);

    return out;
  },
  groupTwice: (resource, fieldRoot, fieldSecond) => { // { fieldRoot: {filedSecond: [..], ..}, ...}
    let root = act.groupBy(resource, fieldRoot);
    let out = {};
    _.each(root, (data, key) => {
      out[key] = act.groupBy(data, fieldSecond);
    });

    return out;
  },
  groupTwiceTree:(resource, fieldRoot, fieldSecond, id, parent, name) => { // { fieldRoot: {filedSecond: [..], ..}, ...} id - name of key value, parent - name of parent key value, name - name value which will be index of item, tag - field for tag mark, tegVal - val of tag mark
    let root = act.groupBy(resource, fieldRoot);
    let out = {};
    _.each(root, (data, prj) => {
      let types = _.keys(act.groupBy(data, fieldSecond));
      let tree = act.getParentRoots(act.tree(data, id, parent, name), parent, name);
      out[prj] = {};
      _.each(types, type => {
        let filter = val => {
          if(!val.hasOwnProperty('children')) { // this is item? Has children?
            for (let i in val)
              if( 'del' == filter(val[i]))
                delete(val[i]);
          } else { // if item then (has children prop)
            if(!_.isEmpty(val.children)) // if children present filter its first
              filter(val.children);

            if(val.hasOwnProperty(fieldSecond)){
              if (type != val[fieldSecond] && _.isEmpty(val.children)) // if item not from current group and hasn't children - remove it
                return 'del';
            } else
              console.error('ResAPI GETTRES error: groupTwiceTreeTag data hasn\'t `fieldSecond` property');
          }
        };
        out[prj][type] = _.cloneDeep(tree);
        filter(out[prj][type]);
      });
    });

    return out;
  },
  group: (resource, field) => act.groupBy(resource, field),
  sum: (resource, field) => act.sum(resource, field),
  sumUniq: (resource, unicfield, sumfield) => act.sum(act.uniq(resource, unicfield), sumfield),
}


