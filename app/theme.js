'use strict';
(() => {
    const key='hyperhdr-theme';
    const system=window.matchMedia('(prefers-color-scheme: dark)');
    let preference='system';
    let toggle;
    try {const saved=localStorage.getItem(key);if(['system','light','dark'].includes(saved))preference=saved;}catch{}
    function apply(){
        const dark=preference==='system'?system.matches:preference==='dark';
        document.documentElement.dataset.theme=dark?'dark':'light';
        if(toggle)toggle.checked=dark;
    }
    function save(){apply();try{localStorage.setItem(key,preference);}catch{}}
    apply();
    if(system.addEventListener)system.addEventListener('change',apply);
    else system.addListener(apply);
    document.addEventListener('DOMContentLoaded',()=>{
        toggle=document.getElementById('theme-toggle');
        apply();
        toggle.onchange=()=>{preference=toggle.checked?'dark':'light';save();};
    },{once:true});
})();
