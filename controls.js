(function(root){
 'use strict';
 class DragPad{
  constructor(target,isPlaying,onChange=()=>{}){
   this.target=target;this.isPlaying=isPlaying;this.onChange=onChange;this.pointerId=null;this.origin=null;this.vector={x:0,y:0};this.offset={x:0,y:0};
   target.addEventListener('pointerdown',e=>{if(!isPlaying()||this.pointerId!==null||e.button!==0)return;this.pointerId=e.pointerId;this.origin={x:e.clientX,y:e.clientY};this.vector={x:0,y:0};this.offset={x:0,y:0};try{target.setPointerCapture?.(e.pointerId);}catch{}e.preventDefault();this.onChange(this);},{passive:false});
   target.addEventListener('pointermove',e=>{if(this.pointerId!==e.pointerId)return;if(!isPlaying()){this.reset();return;}const dx=e.clientX-this.origin.x,dy=e.clientY-this.origin.y,d=Math.hypot(dx,dy);this.vector=d<10?{x:0,y:0}:{x:dx/d,y:dy/d};const factor=d?Math.min(d,42)/d:0;this.offset={x:dx*factor,y:dy*factor};e.preventDefault();this.onChange(this);},{passive:false});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])target.addEventListener(type,e=>{if(this.pointerId===e.pointerId)this.reset();});
  }
  reset(){const id=this.pointerId;this.pointerId=null;this.origin=null;this.vector={x:0,y:0};this.offset={x:0,y:0};try{if(id!==null&&this.target.hasPointerCapture?.(id))this.target.releasePointerCapture(id);}catch{}this.onChange(this);}
 }
 const api={DragPad};if(typeof module==='object'&&module.exports)module.exports=api;else root.NightfallInput=api;
})(globalThis);
