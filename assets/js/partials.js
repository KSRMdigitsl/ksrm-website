(function attachPartials(){
  document.querySelectorAll('[data-partial]').forEach(async el => {
    const src = el.getAttribute('data-src');
    try{
      const html = await fetch(src, {cache:'no-store'}).then(r=>r.text());
      el.innerHTML = html;
    }catch(e){
      console.warn('Partial failed', src, e);
    }
  });
})();
