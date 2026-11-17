/* Canvas drawing and browser controls. Simulation lives in engine.js. */
'use strict';
const {Game,WEAPONS,WIDTH,HEIGHT,DIFFICULTIES,DEFENSES,ITEMS}=Survivor;
const game=new Game();
const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
const held=new Set();
const hunterSprite=new Image();hunterSprite.src='assets/hunter.svg';
let selectedDifficulty='normal';
let lastFrame=0,lastMode='',lastChoice='',lastLoadout='',lastDefense='',viewHeight=650,pixelScale=1;
const formatTime=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const weaponById=id=>ITEMS.find(w=>w.id===id);
const iconPaths={
 dagger:'<path d="m17 3 4 0 0 4-10 10-4-4Z M5 12l7 7 M3 21l5-5"/>',
 magic:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><circle cx="12" cy="12" r="3"/>',
 bible:'<path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v16c-4-1-6 0-9 2-3-2-5-3-9-2Z M12 6v16 M16 8v7 M14 11h4"/>',
 lightning:'<path d="m14 2-10 12h7l-1 8 10-13h-7Z"/>',
 fireball:'<path d="M13 2c1 7-6 7-3 12 0-3 3-4 5-6 1 4 5 5 5 9 0 7-16 7-16-1 0-5 6-8 9-14Z"/>',
 frost:'<path d="M12 2v20 M3 7l18 10 M3 17 21 7 M9 4l3 3 3-3 M9 20l3-3 3 3 M3 10l4-1-1-4 M18 19l-1-4 4-1 M3 14l4 1-1 4 M18 5l-1 4 4 1"/>',
 axe:'<path d="m6 22 9-18 M10 5l3-3c5 0 9 4 9 9l-4 2-4-4-4-1Z M5 18l4 2"/>',
 water:'<path d="M9 2h6 M10 2v7l-6 10c-1 2 1 3 3 3h10c2 0 4-1 3-3L14 9V2 M7 15h10"/><path d="M12 11v7 M10 14h4"/>',
 armor:'<path d="m8 3-5 4 3 5 2-1v10h8V11l2 1 3-5-5-4c-1 4-7 4-8 0Z M9 13h6 M9 17h6"/>',
 shield:'<path d="M12 2 3 6v6c0 5 5 9 9 10 4-1 9-5 9-10V6Z M12 6v12 M7 11h10"/>',
 recovery:'<path d="m12 2 8 10-8 10-8-10Z M12 8v8 M8 12h8"/>'
};
function itemIcon(item){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[item.id]}</svg>`;}
function defenseEffect(id,level){return id==='armor'?`받는 피해 ${level*8}% 감소`:id==='shield'?`피해 1회 방어 · ${14-level*2}초 재충전`:`초당 생명력 ${(level*.25).toFixed(2)} 회복`;}
function resize(){
  const rect=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  pixelScale=canvas.width/1100;viewHeight=canvas.height/pixelScale;
}
window.addEventListener('resize',resize);resize();

// Paint the fixed graveyard once, then only copy the visible portion per frame.
const ground=document.createElement('canvas');ground.width=WIDTH;ground.height=HEIGHT;
const bg=ground.getContext('2d');
let seed=73;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
bg.fillStyle='#1b292b';bg.fillRect(0,0,WIDTH,HEIGHT);
for(let y=0;y<HEIGHT;y+=48)for(let x=0;x<WIDTH;x+=48){bg.fillStyle=random()>.5?'#203033':'#1e2b2e';bg.fillRect(x+1,y+1,46,46);}
bg.fillStyle='#343a37';bg.fillRect(1020,0,160,HEIGHT);bg.fillRect(0,690,WIDTH,120);
for(let i=0;i<5500;i++){
 const x=random()*WIDTH,y=random()*HEIGHT;
 bg.fillStyle=random()>.65?'#75806326':'#101b1929';bg.fillRect(x,y,random()*5+1,2);
}
for(let y=180;y<HEIGHT-90;y+=175)for(let x=150;x<WIDTH-80;x+=170){
 if(Math.abs(x-1100)<170||Math.abs(y-750)<120)continue;
 const gx=x+random()*30,gy=y+random()*25;
 bg.fillStyle='#121f1a66';bg.beginPath();bg.ellipse(gx+5,gy+24,28,10,0,0,Math.PI*2);bg.fill();
 bg.fillStyle='#59625a';bg.beginPath();bg.roundRect(gx-15,gy-13,30,40,[12,12,2,2]);bg.fill();
 bg.fillStyle='#6f776b';bg.fillRect(gx-16,gy+22,33,5);
 bg.strokeStyle='#363e38';bg.lineWidth=3;bg.beginPath();bg.moveTo(gx,gy-4);bg.lineTo(gx,gy+13);bg.moveTo(gx-6,gy+3);bg.lineTo(gx+6,gy+3);bg.stroke();
}
for(let x=0;x<WIDTH;x+=42){bg.fillStyle='#14211f';bg.fillRect(x,0,5,25);bg.fillRect(x,HEIGHT-25,5,25);}for(let y=0;y<HEIGHT;y+=42){bg.fillStyle='#14211f';bg.fillRect(0,y,25,5);bg.fillRect(WIDTH-25,y,25,5);}
// Chipped paving and engraved burial circles, baked into the terrain.
for(let y=0;y<HEIGHT;y+=42)for(let x=0;x<WIDTH;x+=52){if(Math.abs(x-1100)>74&&Math.abs(y-750)>55)continue;bg.strokeStyle='#a9afa00e';bg.strokeRect(x+2+(y%84?12:0),y+2,47,36);}
for(const [x,y] of [[790,480],[1410,480],[790,1020],[1410,1020]]){bg.strokeStyle='#bfb48933';bg.lineWidth=1;bg.beginPath();bg.arc(x,y,64,0,Math.PI*2);bg.arc(x,y,56,0,Math.PI*2);bg.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;bg.beginPath();bg.moveTo(x+Math.cos(a)*46,y+Math.sin(a)*46);bg.lineTo(x+Math.cos(a)*73,y+Math.sin(a)*73);bg.stroke();}}
bg.strokeStyle='#9ca59344';bg.lineWidth=3;bg.strokeRect(24,24,WIDTH-48,HEIGHT-48);
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function shadow(x,y,r){ctx.fillStyle='#07100d66';ctx.beginPath();ctx.ellipse(x,y+9,r,r*.4,0,0,Math.PI*2);ctx.fill();}
function drawPlayer(){
 const p=game.player;ctx.save();ctx.translate(p.x,p.y);
 if(p.invuln>0&&Math.floor(game.time*17)%2)ctx.globalAlpha=.42;
 shadow(0,4,22);
 if(p.shieldReady){const halo=ctx.createRadialGradient(0,-12,10,0,-12,43);halo.addColorStop(0,'#84d7ea00');halo.addColorStop(1,'#84d7ea20');circle(0,-12,43,halo);ctx.strokeStyle='#a7e6ecaa';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,-12,35,44,0,0,Math.PI*2);ctx.stroke();ctx.save();ctx.translate(0,-12);ctx.rotate(game.time*.5);ctx.setLineDash([3,12]);ctx.beginPath();ctx.arc(0,0,47,0,Math.PI*2);ctx.stroke();ctx.restore();}
 if(game.defenses.armor){ctx.strokeStyle='#d8bd8277';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,15,24,9,0,0,Math.PI*2);ctx.stroke();}
 if(game.defenses.recovery){const a=game.time*1.5;circle(Math.cos(a)*30,-18+Math.sin(a)*22,2,'#b8edb0');circle(-Math.cos(a)*30,-18-Math.sin(a)*22,1.5,'#b8edb077');}
 const moving=p.moving&&game.mode==='playing';const phase=game.time*(moving?10:2);const bob=Math.sin(phase)*(moving?1.2:.35);
 ctx.save();ctx.scale(p.facing,1);ctx.translate(0,bob);
 // An animated rear cape extends the static illustration without deforming armor.
 const wind=Math.sin(phase*.7)*3+(moving?3:0);
 const cloth=ctx.createLinearGradient(-17,-38,16,19);cloth.addColorStop(0,'#814355');cloth.addColorStop(1,'#291d2e');ctx.fillStyle=cloth;ctx.strokeStyle='#ac77715c';ctx.lineWidth=.6;
 ctx.beginPath();ctx.moveTo(-9,-39);ctx.bezierCurveTo(-22,-27,-14+wind,-2,-22+wind,14);ctx.lineTo(-6,9);ctx.lineTo(8,17);ctx.bezierCurveTo(12+wind,-1,12,-26,8,-38);ctx.closePath();ctx.fill();ctx.stroke();
 if(hunterSprite.complete&&hunterSprite.naturalWidth)ctx.drawImage(hunterSprite,-32,-66,64,86);
 else {ctx.fillStyle='#637a84';ctx.beginPath();ctx.moveTo(-11,-36);ctx.lineTo(11,-36);ctx.lineTo(15,12);ctx.lineTo(-15,12);ctx.fill();ctx.fillStyle='#223540';ctx.fillRect(-17,-48,34,5);}
 ctx.restore();
 // A small readable marker keeps the hero identifiable inside a crowd.
 ctx.fillStyle='#dbcba1';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText('루시안',0,30);
 ctx.restore();
}
function drawEnemy(e){
 const boss=e.kind==='mini'||e.kind==='final';
 ctx.save();ctx.translate(e.x,e.y);const scale=e.r/13;ctx.scale(scale,scale);shadow(0,0,16);
 if(e.kind==='bat'){
  const flap=Math.sin(game.time*17+e.id)*5;ctx.fillStyle='#867698';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-18,-8-flap);ctx.lineTo(-14,5);ctx.lineTo(-5,8);ctx.lineTo(0,5);ctx.lineTo(5,8);ctx.lineTo(14,5);ctx.lineTo(18,-8-flap);ctx.closePath();ctx.fill();circle(0,0,6,'#473e59');circle(-2,-1,1.3,'#ffd0a9');circle(2,-1,1.3,'#ffd0a9');
 }else{
  ctx.fillStyle=e.kind==='armor'?'#657375':boss?'#4b244d':'#483549';
  ctx.beginPath();ctx.moveTo(-9,-4);ctx.lineTo(9,-4);ctx.lineTo(15,15);ctx.lineTo(0,10);ctx.lineTo(-15,15);ctx.closePath();ctx.fill();
  ctx.fillStyle=e.kind==='armor'?'#a1a6a0':boss?'#9e5875':'#746077';ctx.fillRect(-7,-4,14,14);
  circle(0,-10,8,boss?'#d1afa7':'#acb7a4');
  ctx.fillStyle='#252a30';ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(-8,-20);ctx.lineTo(0,-15);ctx.lineTo(8,-20);ctx.lineTo(9,-8);ctx.lineTo(4,-13);ctx.lineTo(0,-10);ctx.lineTo(-4,-13);ctx.fill();
  circle(-3,-9,1.4,'#ff878f');circle(3,-9,1.4,'#ff878f');
  if(e.kind==='armor'){ctx.strokeStyle='#bdc4b9';ctx.lineWidth=2;ctx.strokeRect(-9,-4,18,14);}
  if(boss){ctx.fillStyle='#d6ba7a';ctx.beginPath();ctx.moveTo(-8,-20);ctx.lineTo(-9,-27);ctx.lineTo(-3,-23);ctx.lineTo(0,-29);ctx.lineTo(4,-23);ctx.lineTo(9,-27);ctx.lineTo(8,-20);ctx.closePath();ctx.fill();}
 }
 if(e.hitUntil>game.time){ctx.globalAlpha=.65;circle(0,0,12,'#ffe3bc');}
 ctx.restore();
 if(boss||e.hp<e.maxHp){const width=boss?64:28;ctx.fillStyle='#101417';ctx.fillRect(e.x-width/2,e.y-e.r-14,width,4);ctx.fillStyle=boss?'#cd819a':'#b3bd90';ctx.fillRect(e.x-width/2,e.y-e.r-14,width*Math.max(0,e.hp/e.maxHp),4);}
}
function drawWorld(){
 const camera={x:Math.max(0,Math.min(WIDTH-1100,game.player.x-550)),y:Math.max(0,Math.min(HEIGHT-viewHeight,game.player.y-viewHeight/2))};
 ctx.setTransform(pixelScale,0,0,pixelScale,0,0);ctx.clearRect(0,0,1100,viewHeight);
 ctx.save();ctx.translate(-camera.x,-camera.y);ctx.drawImage(ground,0,0);
 for(const [x,y] of [[990,520],[1210,520],[990,980],[1210,980],[600,680],[1600,810]]){
  const flicker=1+Math.sin(game.time*7+x)*.06;const glow=ctx.createRadialGradient(x,y,0,x,y,105*flicker);glow.addColorStop(0,'#f4c37425');glow.addColorStop(1,'#f4c37400');circle(x,y,105*flicker,glow);ctx.fillStyle='#171f22';ctx.fillRect(x-4,y-8,8,24);ctx.strokeStyle='#a58b58';ctx.lineWidth=1;ctx.strokeRect(x-5,y-12,10,13);circle(x,y-7,3.5*flicker,'#f2cb84');
 }
 const visible=(x,y,r=70)=>x>camera.x-r&&x<camera.x+1100+r&&y>camera.y-r&&y<camera.y+viewHeight+r;
 for(const z of game.zones){ctx.globalAlpha=Math.min(.35,z.life*.5);circle(z.x,z.y,z.r,'#7c9cf4');ctx.globalAlpha=1;ctx.strokeStyle='#a7c7ff66';ctx.lineWidth=2;ctx.beginPath();ctx.arc(z.x,z.y,z.r*.8,0,Math.PI*2);ctx.stroke();}
 if(game.weapons.frost){const r=65+game.weapons.frost*15;circle(game.player.x,game.player.y,r,'#b2eaf815');ctx.strokeStyle='#b0e2e633';ctx.lineWidth=2;ctx.beginPath();ctx.arc(game.player.x,game.player.y,r,0,Math.PI*2);ctx.stroke();}
 for(const gem of game.gems){if(!visible(gem.x,gem.y))continue;ctx.save();ctx.translate(gem.x,gem.y);ctx.rotate(Math.PI/4);ctx.fillStyle=gem.value>=50?'#d7b07b':gem.value>=12?'#8db7f2':'#85d8b8';ctx.fillRect(-4,-4,8,8);ctx.fillStyle='#f0fff166';ctx.fillRect(-3,-3,3,3);ctx.restore();}
 for(const c of game.chests){if(!visible(c.x,c.y))continue;circle(c.x,c.y,24+Math.sin(game.time*4)*3,'#e4b46018');ctx.fillStyle='#6d4b30';ctx.fillRect(c.x-12,c.y-8,24,19);ctx.strokeStyle='#e0be79';ctx.lineWidth=2;ctx.strokeRect(c.x-12,c.y-8,24,19);ctx.fillStyle='#e4bf6d';ctx.fillRect(c.x-2,c.y-5,4,12);ctx.fillRect(c.x-12,c.y,24,3);}
 // Draw by depth for readable overlap.
 const actors=game.enemies.filter(e=>!e.dead&&visible(e.x,e.y)).map(e=>({y:e.y,enemy:e}));actors.push({y:game.player.y,player:true});actors.sort((a,b)=>a.y-b.y);
 for(const a of actors){if(a.player)drawPlayer();else drawEnemy(a.enemy);}
 const bible=game.weapons.bible||0;for(let i=0;i<bible;i++){const a=game.time*2.7+i*Math.PI*2/bible;ctx.save();ctx.translate(game.player.x+Math.cos(a)*76,game.player.y+Math.sin(a)*76);ctx.rotate(a+.6);ctx.fillStyle='#ad8258';ctx.fillRect(-9,-12,18,24);ctx.strokeStyle='#f0cf83';ctx.lineWidth=2;ctx.strokeRect(-9,-12,18,24);ctx.fillStyle='#edd9ae';ctx.fillRect(-1,-7,2,14);ctx.fillRect(-5,-2,10,2);ctx.restore();}
 for(const s of game.projectiles){ctx.save();ctx.translate(s.x,s.y);
  if(s.kind==='axe'){ctx.rotate(s.spin);ctx.fillStyle='#b4d3d9';ctx.beginPath();ctx.arc(0,0,12,-1.7,1.7);ctx.lineTo(0,0);ctx.fill();ctx.fillStyle='#ab8965';ctx.fillRect(-3,-4,4,23);}
  else if(s.kind==='magic'){circle(0,0,10,'#bba1fc24');circle(0,0,5,'#c7adff');circle(-1,-1,2,'#f0dcff');}
  else{ctx.rotate(Math.atan2(s.vy,s.vx));ctx.fillStyle='#e9d9af';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-5,-3);ctx.lineTo(-5,3);ctx.closePath();ctx.fill();ctx.fillStyle='#a78461';ctx.fillRect(-10,-2,6,4);}ctx.restore();
 }
 for(const e of game.effects){ctx.globalAlpha=Math.max(0,e.life/e.maxLife);
  if(e.kind==='bolt'){ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(e.x+12,e.y-140);ctx.lineTo(e.x-12,e.y-65);ctx.lineTo(e.x+9,e.y-67);ctx.lineTo(e.x,e.y);ctx.stroke();circle(e.x,e.y,18,'#ffe79666');}
  else{ctx.strokeStyle=e.color;ctx.lineWidth=e.kind==='ring'?5:2;ctx.beginPath();ctx.arc(e.x,e.y,e.r*(1-e.life/e.maxLife*.35),0,Math.PI*2);ctx.stroke();if(e.kind==='ring')circle(e.x,e.y,e.r,e.color+'22');}ctx.globalAlpha=1;
 }
 // Point toward distant loot and bosses so nothing is lost off-screen.
 for(const item of [...game.chests.map(c=>({...c,loot:true})),...game.enemies.filter(e=>!e.dead&&(e.kind==='mini'||e.kind==='final'))]){
  if(visible(item.x,item.y,-20))continue;
  const dx=item.x-game.player.x,dy=item.y-game.player.y,angle=Math.atan2(dy,dx);
  const factor=Math.min(490/Math.max(1,Math.abs(dx)),(viewHeight/2-65)/Math.max(1,Math.abs(dy)));
  const x=game.player.x+dx*factor,y=game.player.y+dy*factor;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=item.loot?'#e6c781':'#d48d9b';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.fill();ctx.restore();ctx.fillStyle=item.loot?'#e6c781':'#d48d9b';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(item.loot?'상자':'보스',x,y+20);
 }
 ctx.restore();
 const vignette=ctx.createRadialGradient(550,viewHeight/2,150,550,viewHeight/2,650);vignette.addColorStop(0,'#0b111300');vignette.addColorStop(1,'#07101699');ctx.fillStyle=vignette;ctx.fillRect(0,0,1100,viewHeight);
}
function renderHUD(){
 $('difficultyLabel').textContent='난이도 '+DIFFICULTIES[game.mode==='ready'?selectedDifficulty:game.difficulty.id].name;
 $('healthText').textContent=`${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;$('healthFill').style.width=`${game.player.hp/game.player.maxHp*100}%`;
 $('level').textContent=`LEVEL ${String(game.level).padStart(2,'0')}`;$('xpText').textContent=`${game.xp} / ${game.xpNeeded} EXP`;$('xpFill').style.width=`${game.xp/game.xpNeeded*100}%`;
 $('time').textContent=formatTime(game.time);$('kills').textContent=game.kills;
 $('pause').disabled=!['playing','paused'].includes(game.mode);$('pause').textContent=game.mode==='paused'?'▶ 계속하기':'Ⅱ 일시정지';
 $('restart').disabled=!['playing','paused','levelup','chest'].includes(game.mode);
 const signature=JSON.stringify(game.weapons);if(signature!==lastLoadout){lastLoadout=signature;
  $('weaponCount').textContent=`${Object.keys(game.weapons).length} / 8`;
  $('weapons').innerHTML=WEAPONS.map(w=>{const level=game.weapons[w.id]||0;return `<div class="slot ${level?'':'empty'}" title="${w.name} · ${level?`${level}/5단계`:'미획득'}"><span class="slot-icon" style="color:${level?w.color:'#657277'}">${itemIcon(w)}</span><span class="slot-name">${w.name}</span><span class="pips">${'●'.repeat(level)}${'○'.repeat(5-level)}</span></div>`;}).join('');
 }
 const defenseSignature=JSON.stringify(game.defenses);if(defenseSignature!==lastDefense){lastDefense=defenseSignature;
  $('defenseCount').textContent=`${Object.keys(game.defenses).length} / 3`;
  $('defenses').innerHTML=DEFENSES.map(item=>{const level=game.defenses[item.id]||0;return `<div class="relic-slot ${level?'':'empty'}" title="${item.name} · ${level?defenseEffect(item.id,level):'레벨업으로 획득'}"><span class="relic-icon" style="color:${item.color}">${itemIcon(item)}</span><div><span class="slot-name">${item.name}</span><span class="pips">${'●'.repeat(level)}${'○'.repeat(5-level)}</span></div></div>`;}).join('');
 }
 const shield=game.defenses.shield?(game.player.shieldReady?'보호막 준비':`보호막 ${Math.ceil(game.player.shieldCooldown)}초`):'보호막 없음';
 $('defenseSummary').textContent=`피해 감소 ${(game.defenses.armor||0)*8}% · ${shield} · 회복 ${((game.defenses.recovery||0)*.25).toFixed(2)}/초`;
 $('notice').hidden=game.time>game.noticeUntil||!game.notice;$('notice').textContent=game.notice;
 const bosses=game.enemies.filter(e=>!e.dead&&(e.kind==='mini'||e.kind==='final'));const boss=bosses.find(e=>e.kind==='final')||bosses[0];
 $('bossBar').hidden=!boss;if(boss){$('bossName').textContent=boss.kind==='final'?'밤의 군주 · 최종 보스':'묘지의 수호자 · 미니 보스';$('bossFill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;}
}
function actionButton(label,action,className='primary'){const button=document.createElement('button');button.className=className;button.textContent=label;button.addEventListener('click',action);return button;}
function difficultyPicker(card){
 const picker=document.createElement('div');picker.className='difficulty-picker';picker.setAttribute('role','group');picker.setAttribute('aria-label','난이도 선택');
 for(const difficulty of Object.values(DIFFICULTIES)){
  const button=document.createElement('button');button.type='button';button.className='difficulty-choice';button.dataset.difficulty=difficulty.id;
  button.setAttribute('aria-pressed',String(selectedDifficulty===difficulty.id));
  const subtitle={easy:'THE VIGIL',normal:'THE HUNT',hard:'THE RECKONING'}[difficulty.id];
  button.innerHTML=`<span class="difficulty-rank">${'◆'.repeat(difficulty.health/2)}</span><strong>${difficulty.name}</strong><span class="difficulty-subtitle">${subtitle}</span><span>체력 ×${difficulty.health} · 등장 수 ×${difficulty.population}</span>`;
  button.addEventListener('click',()=>{selectedDifficulty=difficulty.id;for(const other of picker.children)other.setAttribute('aria-pressed',String(other===button));});picker.append(button);
 }
 card.append(picker);
}
const crest='<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="48"/><circle cx="60" cy="60" r="40" stroke-dasharray="1 8"/><path d="m60 12 5 11-5 9-5-9Zm0 76 5 9-5 11-5-11ZM12 60l11-5 9 5-9 5Zm76 0 9-5 11 5-11 5Z"/><path d="m60 31 20 12v26L60 88 40 69V43Z M60 40v35 M49 53h22 M49 64h22"/></svg>';
function renderModal(){
 const signature=`${game.mode}:${game.pendingLevels}:${game.choices.join(',')}`;
 if(signature===lastChoice&&game.mode===lastMode)return;
 const wasMode=lastMode;lastChoice=signature;lastMode=game.mode;held.clear();
 const modal=$('modal'),card=$('modalCard');modal.hidden=game.mode==='playing';if(modal.hidden){if(wasMode!=='playing')$('pause').blur();return;}
 card.dataset.screen=game.mode;card.replaceChildren();
 if(game.mode==='ready'){
  card.innerHTML=`<span class="modal-kicker">TEN MINUTES BETWEEN DARKNESS & DAWN</span><div class="hunter-portrait"><span class="portrait-ring"></span><img src="assets/hunter.svg" alt="은빛 갑옷과 붉은 망토를 입은 사냥꾼 루시안"></div><p class="chapter-label">LUCIAN · 새벽의 파수꾼</p><h2 id="modalTitle">밤이 끝날 때까지.</h2><p class="modal-description">어둠은 짙어지고, 망자들은 깨어납니다.<br>무기와 수호 장비를 조합해 마지막 군주를 쓰러뜨리세요.</p>`;
  difficultyPicker(card);card.append(actionButton('밤 속으로 들어가기 →',()=>game.start(selectedDifficulty)));
  card.insertAdjacentHTML('beforeend','<div class="start-notes"><span><b>Ⅰ · 이동</b>WASD / 방향키</span><span><b>Ⅱ · 성장</b>무기와 수호 장비 선택</span><span><b>Ⅲ · 생존</b>10분 후 최후의 전투</span></div>');
 }else if(game.mode==='levelup'){
  card.innerHTML=`<span class="modal-kicker">ASCENSION · LEVEL ${game.level}</span><h2 id="modalTitle">더 강해질 시간.</h2><p class="modal-description">공격을 강화할까요, 생존을 준비할까요? 하나를 선택하세요.${game.pendingLevels>1?` (선택 ${game.pendingLevels}회 남음)`:''}</p><div class="cards" id="choiceCards"></div>`;
  const choices=card.querySelector('.cards');
  for(const id of game.choices){const item=weaponById(id);const defense=DEFENSES.some(d=>d.id===id);const level=game.weapons[id]||game.defenses[id]||0;const button=document.createElement('button');button.className='choice';button.dataset.item=id;
   button.innerHTML=id==='heal'?'<span class="badge">RESTORATION</span><span class="icon">✚</span><strong>생명력 회복</strong><p>모든 장비가 최대 단계입니다.</p><span class="stage">최대 체력의 25% 회복</span>':`<span class="badge">${defense?'WARD & RELIC':'ARSENAL'} / ${level?'UPGRADE':'NEW'}</span><span class="icon" style="color:${item.color}">${itemIcon(item)}</span><strong>${item.name}</strong><p>${defense?defenseEffect(id,level+1):level?item.upgrade:item.description}</p><span class="stage">${level?`${level} → ${level+1}단계`:'1단계 획득'} <i>/</i> 최대 5단계</span>`;
   button.addEventListener('click',()=>game.choose(id));choices.append(button);
  }
 }else if(game.mode==='chest'){
  const r=game.reward,w=weaponById(r.id);
  card.innerHTML=`<span class="modal-kicker">RELIQUARY · A GIFT FROM THE FALLEN</span><h2 id="modalTitle">밤이 남긴 선물.</h2><div class="reward-icon" style="color:${w.color}">${itemIcon(w)}</div><div class="reward-name">${w.name}</div><div class="reward-stage">${r.healed?'이미 최대 단계 · 생명력 25% 회복':r.isNew?'새 무기 획득 · 1단계':`무기 강화 · ${r.level-1} → ${r.level}단계`}</div><p class="modal-description">전체 8종의 무기 중 무작위로 선택된 보상입니다.</p>`;
  card.append(actionButton('보상 확인 · 계속하기',()=>game.confirmChest()));
 }else if(game.mode==='paused'){
  card.innerHTML=`<span class="modal-kicker">INTERLUDE · TAKE A BREATH</span><div class="hero-crest small">${crest}</div><h2 id="modalTitle">잠시, 고요한 밤.</h2><p class="modal-description">전투와 시간은 멈춰 있습니다.<br>계속 도전하거나 새로운 밤을 시작하세요.</p>`;
  const actions=document.createElement('div');actions.className='modal-actions';actions.append(actionButton('계속하기 →',()=>game.resume()),actionButton('↺ 처음부터 다시 시작',()=>game.requestRestart(),'secondary'));card.append(actions);
 }else if(game.mode==='restart'){
  card.innerHTML='<span class="modal-kicker">A NEW VIGIL</span><h2 id="modalTitle">새로운 밤을 시작할까요?</h2><p class="modal-description">현재 전투의 경험치와 장비는 초기화됩니다.<br>난이도를 고르고 처음부터 다시 시작하세요.</p>';
  difficultyPicker(card);const actions=document.createElement('div');actions.className='modal-actions';actions.append(actionButton('처음부터 시작 →',()=>game.start(selectedDifficulty)),actionButton('현재 게임으로 돌아가기',cancelRestartMenu,'secondary'));card.append(actions);
 }else{
  const won=game.mode==='won';
  card.innerHTML=`<span class="modal-kicker">${won?'THE DAWN IS YOURS':'THE NIGHT REMAINS'}</span><div class="hero-crest small">${crest}</div><h2 id="modalTitle">${won?'마침내, 새벽.':'아직 끝나지 않은 밤.'}</h2><p class="modal-description">${won?'밤의 군주를 쓰러뜨렸습니다. 당신이 묘지에 아침을 가져왔어요.':'쓰러졌지만, 다음 밤에는 더 강해질 수 있습니다.'}</p><div class="result-stats"><span><strong>${formatTime(game.time)}</strong>생존 시간</span><span><strong>${game.kills}</strong>처치 수</span><span><strong>${game.level}</strong>도달 레벨</span></div>`;
  difficultyPicker(card);card.append(actionButton('새로운 밤 시작하기 →',()=>game.start(selectedDifficulty)));
 }
 (card.querySelector('.primary')||card.querySelector('button'))?.focus({preventScroll:true});
}
function cancelRestartMenu(){selectedDifficulty=game.difficulty.id;game.cancelRestart();}
function togglePause(){if(game.mode==='restart'){cancelRestartMenu();return;}if(game.mode==='playing')game.pause();else if(game.mode==='paused')game.resume();}
$('pause').addEventListener('click',togglePause);$('restart').addEventListener('click',()=>game.requestRestart());
const movement=['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'];
document.addEventListener('keydown',event=>{
 const key=event.key.toLowerCase();
 if(key==='tab'&&!$('modal').hidden){const buttons=[...$('modalCard').querySelectorAll('button')];const current=buttons.indexOf(document.activeElement);event.preventDefault();buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;}
 if(movement.includes(key)){event.preventDefault();if(game.mode==='playing')held.add(key);}
 if((event.code==='Space'||key==='escape')&&!event.repeat){if(event.code==='Space'&&document.activeElement?.tagName==='BUTTON'&&!$('modal').hidden)return;event.preventDefault();togglePause();}
});
document.addEventListener('keyup',event=>held.delete(event.key.toLowerCase()));
function suspend(){held.clear();game.pause();}
window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
function frame(timestamp){
 const dt=lastFrame?Math.min((timestamp-lastFrame)/1000,.05):0;lastFrame=timestamp;
 const x=Number(held.has('d')||held.has('arrowright'))-Number(held.has('a')||held.has('arrowleft'));
 const y=Number(held.has('s')||held.has('arrowdown'))-Number(held.has('w')||held.has('arrowup'));
 game.update(dt,{x,y});drawWorld();renderHUD();renderModal();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


