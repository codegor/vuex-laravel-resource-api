export default {
    500() {
      alert('Sorry, some error at the server, please try again later...');
    },
    401(){
      if(confirm('You are no longer authorized. Would you like to log in?'))
        window.location.reload();
    },
    404(){
      alert('Seems this feature is still on the developing mode, please try again later...');
    },
    def(){
      alert('Sorry, some unexpected error at the server, please try again later...');
    }
}
