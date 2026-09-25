const panel=document.querySelector('#heroMedia');
const playTarget=document.querySelector('#heroMediaToggle');
const watch=document.querySelector('#heroWatchBtn');

function openPlatformReel(){
  // Keep the real interactive product reel as the behavior behind the play target
  // while the approved mockup artwork owns the hero's visible pixels.
  watch?.click();
}

playTarget?.addEventListener('click',openPlatformReel);

if(panel){
  panel.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target===panel){
      e.preventDefault();
      openPlatformReel();
    }
  });
}
