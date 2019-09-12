import Echo from "laravel-echo";
import io from 'socket.io-client';

// window.echo = Echo;
// window.echo = new Echo({
//   broadcaster: 'socket.io',
//   client: io,
//   host: window.location.hostname + ':6001',//'/socket.io',
//   // transports: ['websocket', 'polling', 'flashsocket'],
//   // auth: {
//   //   headers: {
//   //     Authorization: 'Bearer ' + 'token'
//   //   }
//   // }.
//   // namespace: ''
// });
export default {
  init(token) {
    return new Echo({
      broadcaster: 'socket.io',
      client: io,
      host: this.host,
      auth: {
        headers: {
          Authorization: 'Bearer ' + token
        }
      }
    });
  },
  host: window.location.hostname + ':6001'
};
