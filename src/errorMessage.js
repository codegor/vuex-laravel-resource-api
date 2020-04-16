export default {
  500() {
    alert('Sorry, some error at the server, please try again later...');
  },
  401() {
    if (confirm('You are no longer authorized. Would you like to log in?'))
      window.location.reload();
  },
  404() {
    alert('Seems this feature is still on the developing mode, please try again later...');
  },
  422(axResp){
    let d = axResp.response.data || {};
    let m = d.message || 'Sorry, some of data sent to the server was invalid.';
    let e = '\n\nErrors:';
    for(let i in d.errors)
      e += '\n'+(Array.isArray(d.errors[i]) && d.errors[i].join(' ') || d.errors[i]);
    alert(m+e);
  },
  def() {
    alert('Sorry, some unexpected error at the server, please try again later...');
  }
};
