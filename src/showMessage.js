// import Toasted from 'vue-toasted'
import {Toast} from 'quasar'
import Vue from 'vue'

// const toastOptions = {
//   theme: 'none',
//   duration: 2500,
//   className: 'vuestic-toast',
//   iconPack: 'fontawesome',
//   icon: 'fa-info',
//   position: 'bottom-left',
//   fullWidth: false
// }

// Vue.use(Toasted, toastOptions)

Vue.mixin({
  methods: {
    showMess (msg, options) {
      // this.$toasted.show(msg, options)
      Toast.create.info({
        html: msg,
        timeout: 1500,
        position: 'right',
      });
    }
  }
});
