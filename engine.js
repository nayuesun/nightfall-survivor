/* Shared deterministic simulation: browser global Survivor / Node CommonJS. */
(function (root) {
  'use strict';
  const WIDTH = 2200, HEIGHT = 1500;
  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({id:'easy',name:'하',health:2,population:2}),
    normal: Object.freeze({id:'normal',name:'중',health:4,population:4}),
    hard: Object.freeze({id:'hard',name:'상',health:6,population:6})
  });
  const WEAPONS = [
    {id:'dagger',name:'은빛 단검',icon:'🗡',color:'#e8dcb8',description:'가까운 적에게 빠르게 날아가는 단검',upgrade:'피해량과 발사 수 증가'},
    {id:'magic',name:'추적 마법탄',icon:'✦',color:'#bd9bfa',description:'적을 끝까지 쫓는 보랏빛 마법탄',upgrade:'피해량과 마법탄 수 증가'},
    {id:'bible',name:'회전 성서',icon:'📖',color:'#e5c778',description:'주위를 공전하며 적을 막는 성서',upgrade:'피해량과 성서 수 증가'},
    {id:'lightning',name:'심판의 번개',icon:'ϟ',color:'#ffe796',description:'주변 적에게 즉시 떨어지는 번개',upgrade:'피해량과 타격 수 증가'},
    {id:'fireball',name:'폭발 화염구',icon:'🔥',color:'#fa9970',description:'적이 있는 곳을 태우는 범위 폭발',upgrade:'피해량과 폭발 범위 증가'},
    {id:'frost',name:'서리 결계',icon:'❄',color:'#9ee8ee',description:'주변 적에게 지속 피해와 둔화',upgrade:'피해량과 결계 범위 증가'},
    {id:'axe',name:'초승달 도끼',icon:'🪓',color:'#a7c9d6',description:'곡선을 그리며 적을 관통하는 도끼',upgrade:'피해량과 투척 수 증가'},
    {id:'water',name:'축복의 성수',icon:'⚗',color:'#8cb9ff',description:'적 근처에 남는 푸른 정화의 불꽃',upgrade:'피해량과 지속시간 증가'}
  ];
  const DEFENSES = [
    {id:'armor',name:'흑철 갑옷',color:'#c4b396',description:'받는 피해 8% 감소',upgrade:'단계마다 피해 감소 +8% · 최대 40%'},
    {id:'shield',name:'수호의 문장',color:'#8fcbd1',description:'피해 1회를 막는 보호막 · 12초 재충전',upgrade:'재충전 2초 단축 · 최대 단계 4초'},
    {id:'recovery',name:'생명의 부적',color:'#a4c99d',description:'초당 생명력 0.25 회복',upgrade:'단계마다 초당 회복 +0.25 · 최대 1.25'}
  ];
  const ITEMS = [...WEAPONS,...DEFENSES];
  const dist2 = (a,b) => (a.x-b.x)**2+(a.y-b.y)**2;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  class Game {
    constructor(random=Math.random) { this.random=random; this.difficulty=DIFFICULTIES.easy; this.reset(); this.mode='ready'; }
    reset() {
      this.player={x:WIDTH/2,y:HEIGHT/2,r:14,hp:100,maxHp:100,speed:205,invuln:0,facing:1,shieldReady:false,shieldCooldown:0};
      this.time=0;this.level=1;this.xp=0;this.kills=0;this.pendingLevels=0;
      this.weapons={dagger:1};this.defenses={};this.previousMode=null;this.cooldowns={};this.enemies=[];this.projectiles=[];
      this.gems=[];this.chests=[];this.zones=[];this.effects=[];this.choices=[];
      this.reward=null;this.spawnClock=.4/this.difficulty.population;this.nextMini=60;this.finalSpawned=false;
      this.nextId=1;this.notice='';this.noticeUntil=0;
    }
    start(difficulty=this.difficulty.id) {
      if(!Object.hasOwn(DIFFICULTIES,difficulty))throw new RangeError('Unknown difficulty');
      this.difficulty=DIFFICULTIES[difficulty];this.reset();this.mode='playing';
    }
    requestRestart() {
      if(!['playing','paused','levelup','chest'].includes(this.mode))return false;
      this.previousMode=this.mode;this.mode='restart';return true;
    }
    cancelRestart() { if(this.mode==='restart'){this.mode=this.previousMode;this.previousMode=null;} }
    get xpNeeded() { const n=this.level-1;return 40+12*n+6*n*n; }
    get remaining() { return Math.max(0,600-this.time); }
    pause() { if(this.mode==='playing')this.mode='paused'; }
    resume() { if(this.mode==='paused')this.mode='playing'; }
    heal() { this.player.hp=Math.min(this.player.maxHp,this.player.hp+this.player.maxHp*.25); }
    grantWeapon(id) {
      if(!WEAPONS.some(w=>w.id===id))return false;
      const previous=this.weapons[id]||0;
      if(previous>=5){this.heal();return {id,level:5,healed:true};}
      this.weapons[id]=previous+1;this.cooldowns[id]=0;
      return {id,level:previous+1,healed:false,isNew:previous===0};
    }
    grantDefense(id) {
      if(!DEFENSES.some(item=>item.id===id))return false;
      const previous=this.defenses[id]||0;
      if(previous>=5){this.heal();return {id,level:5,healed:true};}
      this.defenses[id]=previous+1;
      if(id==='shield'){
        if(previous===0)this.player.shieldReady=true;
        else this.player.shieldCooldown=Math.min(this.player.shieldCooldown,14-2*this.defenses.shield);
      }
      return {id,level:previous+1,healed:false,isNew:previous===0};
    }
    gainXP(amount) {
      this.xp+=amount;
      while(this.xp>=this.xpNeeded){this.xp-=this.xpNeeded;this.level++;this.pendingLevels++;}
      if(this.pendingLevels&&this.mode==='playing')this.openLevel();
    }
    openLevel() {
      const pool=ITEMS.filter(w=>((this.weapons[w.id]||this.defenses[w.id])||0)<5).map(w=>w.id);
      this.choices=[];
      while(pool.length&&this.choices.length<3){const index=Math.floor(this.random()*pool.length);this.choices.push(pool.splice(index,1)[0]);}
      if(!this.choices.length)this.choices=['heal'];
      this.mode='levelup';
    }
    choose(id) {
      if(this.mode!=='levelup'||!this.choices.includes(id))return false;
      if(id==='heal')this.heal();else if(DEFENSES.some(item=>item.id===id))this.grantDefense(id);else this.grantWeapon(id);
      this.pendingLevels--;this.choices=[];
      if(this.pendingLevels>0)this.openLevel();else this.mode='playing';
      return true;
    }
    openChest() {
      if(this.mode!=='playing')return;
      const weapon=WEAPONS[Math.floor(this.random()*WEAPONS.length)];
      this.reward=this.grantWeapon(weapon.id);this.mode='chest';
    }
    confirmChest() {
      if(this.mode!=='chest')return;
      this.reward=null;if(this.pendingLevels)this.openLevel();else this.mode='playing';
    }
    spawnEnemy(kind) {
      const angle=this.random()*Math.PI*2;
      let x=clamp(this.player.x+Math.cos(angle)*610,24,WIDTH-24);
      let y=clamp(this.player.y+Math.sin(angle)*610,24,HEIGHT-24);
      // Clamping at a map edge must not put a fresh enemy on the player.
      if(dist2({x,y},this.player)<480**2){
        const inward=Math.atan2(HEIGHT/2-this.player.y,WIDTH/2-this.player.x);
        x=clamp(this.player.x+Math.cos(inward)*610,24,WIDTH-24);
        y=clamp(this.player.y+Math.sin(inward)*610,24,HEIGHT-24);
      }
      const scale=1+this.time/160;
      const stats={vampire:[24*scale,52+this.time*.035,13,8,6],bat:[12*scale,95+this.time*.03,10,6,4],armor:[65*scale,34+this.time*.02,18,14,12],mini:[180+Math.floor(this.time/60)*160,70,27,20,70],final:[6500,78,42,30,0]}[kind];
      const e={id:this.nextId++,kind,x,y,hp:stats[0]*this.difficulty.health,maxHp:stats[0]*this.difficulty.health,speed:stats[1],r:stats[2],damage:stats[3],xp:stats[4],dead:false,slowUntil:0,hitUntil:0,ticks:{}};
      this.enemies.push(e);return e;
    }
    nearest(origin=this.player,range=700) {
      let best=null,bestDistance=range*range;
      for(const e of this.enemies){if(e.dead)continue;const d=dist2(e,origin);if(d<bestDistance){best=e;bestDistance=d;}}
      return best;
    }
    damageEnemy(e,amount) {
      if(e.dead||this.mode!=='playing')return;
      e.hp-=amount;e.hitUntil=this.time+.09;
      if(e.hp>0)return;
      e.dead=true;this.kills++;
      this.effects.push({kind:'burst',x:e.x,y:e.y,r:e.r+8,color:'#c5a4ed',life:.3,maxLife:.3});
      if(e.kind==='final'){this.mode='won';return;}
      this.gems.push({x:e.x,y:e.y,value:e.xp});
      if(e.kind==='mini')this.chests.push({x:e.x,y:e.y});
    }
    area(x,y,r,damage,color) {
      this.effects.push({kind:'ring',x,y,r,color,life:.35,maxLife:.35});
      for(const e of this.enemies){if(dist2(e,{x,y})<(r+e.r)**2)this.damageEnemy(e,damage);}
    }
    fire(id,level) {
      const target=this.nearest();if(!target)return false;
      const p=this.player;
      if(id==='lightning'){
        const candidates=this.enemies.filter(e=>!e.dead&&dist2(e,p)<550**2);
        for(let i=0;i<level&&candidates.length;i++){
          const e=candidates.splice(Math.floor(this.random()*candidates.length),1)[0];
          this.effects.push({kind:'bolt',x:e.x,y:e.y,r:25,color:'#ffe796',life:.28,maxLife:.28});this.damageEnemy(e,24+level*13);
        }
      }else if(id==='fireball'){
        this.area(target.x,target.y,65+level*14,22+level*14,'#f89560');
      }else if(id==='water'){
        this.zones.push({x:target.x,y:target.y,r:65,life:2+level*.65,damage:7+level*6,nextTick:0});
      }else{
        const count=id==='dagger'?Math.ceil(level/2):id==='magic'?1+Math.floor(level/2):1+Math.floor(level/2);
        const base=Math.atan2(target.y-p.y,target.x-p.x);
        for(let i=0;i<count;i++){
          const angle=base+(i-(count-1)/2)*.17;
          const speed=id==='magic'?270:id==='axe'?310:490;
          this.projectiles.push({id:this.nextId++,kind:id,x:p.x,y:p.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,speed,age:0,life:id==='axe'?1.6:2.5,r:id==='axe'?12:6,damage:id==='dagger'?15+level*8:id==='magic'?20+level*11:26+level*12,hit:new Set(),targetId:target.id,spin:0});
        }
      }
      return true;
    }
    attack(dt) {
      for(const [id,level] of Object.entries(this.weapons)){
        if(id==='frost'||id==='bible')continue;
        this.cooldowns[id]=(this.cooldowns[id]||0)-dt;
        if(this.cooldowns[id]<=0&&this.fire(id,level))this.cooldowns[id]={dagger:.65,magic:1.15,lightning:1.65,fireball:1.75,axe:1.35,water:2.8}[id];
      }
      const frost=this.weapons.frost;
      if(frost){
        const radius=65+frost*15;
        for(const e of this.enemies){if(e.dead||dist2(e,this.player)>(radius+e.r)**2)continue;e.slowUntil=this.time+.15;
          if((e.ticks.frost||0)<=this.time){e.ticks.frost=this.time+.5;this.damageEnemy(e,5+frost*5);}}
      }
      const bible=this.weapons.bible;
      if(bible){for(let i=0;i<bible;i++){
        const angle=this.time*2.7+i*Math.PI*2/bible;
        const book={x:this.player.x+Math.cos(angle)*76,y:this.player.y+Math.sin(angle)*76};
        for(const e of this.enemies){if(!e.dead&&dist2(e,book)<(e.r+16)**2&&(e.ticks.bible||0)<=this.time){e.ticks.bible=this.time+.4;this.damageEnemy(e,9+bible*8);}}
      }}
    }
    updateProjectiles(dt) {
      for(const shot of this.projectiles){
        shot.age+=dt;shot.life-=dt;
        if(shot.kind==='magic'){
          const target=this.enemies.find(e=>e.id===shot.targetId&&!e.dead)||this.nearest(shot,550);
          if(target){const angle=Math.atan2(target.y-shot.y,target.x-shot.x);shot.vx=Math.cos(angle)*shot.speed;shot.vy=Math.sin(angle)*shot.speed;}
        }
        if(shot.kind==='axe'){shot.vy+=210*dt;shot.spin+=dt*12;}
        // Small substeps avoid fast projectiles tunneling through enemies.
        const steps=Math.max(1,Math.ceil(Math.hypot(shot.vx,shot.vy)*dt/12));
        for(let s=0;s<steps&&shot.life>0;s++){
          shot.x+=shot.vx*dt/steps;shot.y+=shot.vy*dt/steps;
          for(const e of this.enemies){if(e.dead||shot.hit.has(e.id)||dist2(e,shot)>(e.r+shot.r)**2)continue;
            shot.hit.add(e.id);this.damageEnemy(e,shot.damage);
            if(shot.kind!=='axe'){shot.life=0;break;}
          }
        }
      }
      this.projectiles=this.projectiles.filter(s=>s.life>0&&s.x>-100&&s.x<WIDTH+100&&s.y>-100&&s.y<HEIGHT+100);
    }
    update(dt,input={x:0,y:0}) {
      if(this.mode!=='playing'||dt<=0)return;
      // Public update accepts long intervals; integrate them at <= 50ms.
      let left=Math.min(dt,5);
      while(left>1e-8&&this.mode==='playing'){const step=Math.min(left,.05);this.step(step,input);left-=step;}
    }
    step(dt,input) {
      this.time+=dt;
      const p=this.player;p.invuln=Math.max(0,p.invuln-dt);
      if(this.defenses.recovery)p.hp=Math.min(p.maxHp,p.hp+this.defenses.recovery*.25*dt);
      if(this.defenses.shield&&!p.shieldReady){p.shieldCooldown=Math.max(0,p.shieldCooldown-dt);if(p.shieldCooldown<=1e-8){p.shieldReady=true;p.shieldCooldown=0;}}
      const length=Math.hypot(input.x||0,input.y||0);p.moving=length>0;
      if(length){p.x=clamp(p.x+(input.x/length)*p.speed*dt,p.r,WIDTH-p.r);p.y=clamp(p.y+(input.y/length)*p.speed*dt,p.r,HEIGHT-p.r);if(input.x)p.facing=Math.sign(input.x);}
      while(this.nextMini<600&&this.time>=this.nextMini){this.spawnEnemy('mini');this.nextMini+=60;this.notice='미니 보스 출현 · 처치하면 선물상자!';this.noticeUntil=this.time+4;}
      if(this.time>=600&&!this.finalSpawned){this.finalSpawned=true;this.spawnEnemy('final');this.notice='밤의 군주 출현 · 마지막 전투';this.noticeUntil=this.time+6;}
      if(!this.finalSpawned){
        this.spawnClock-=dt;
        while(this.spawnClock<=0){
          if(this.enemies.length<Math.round(260*this.difficulty.population)){const roll=this.random();this.spawnEnemy(this.time>90&&roll<.22?'armor':roll<.48?'bat':'vampire');}
          this.spawnClock+=1/((1.6+this.time*.014)*this.difficulty.population);
        }
      }
      for(const e of this.enemies){
        if(e.dead)continue;const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;
        const speed=e.speed*(e.slowUntil>this.time?.45:1);
        e.x+=dx/d*speed*dt;e.y+=dy/d*speed*dt;
      }
      this.attack(dt);this.updateProjectiles(dt);
      for(const z of this.zones){z.life-=dt;z.nextTick-=dt;if(z.nextTick<=0){z.nextTick=.45;for(const e of this.enemies)if(!e.dead&&dist2(e,z)<(z.r+e.r)**2)this.damageEnemy(e,z.damage);}}
      this.zones=this.zones.filter(z=>z.life>0);
      if(this.mode!=='playing')return;
      for(const e of this.enemies){if(!e.dead&&p.invuln<=0&&dist2(e,p)<(e.r+p.r)**2){if(p.shieldReady){
          p.shieldReady=false;p.shieldCooldown=14-2*this.defenses.shield;
          this.effects.push({kind:'ring',x:p.x,y:p.y,r:42,color:'#9ce0ef',life:.35,maxLife:.35});
        }else p.hp=Math.max(0,p.hp-e.damage*(1-(this.defenses.armor||0)*.08));
        p.invuln=.7;if(p.hp<=0){this.mode='lost';return;}}}
      this.enemies=this.enemies.filter(e=>!e.dead);
      // Collect before opening level UI so gems acquired together retain all XP.
      let earned=0;
      this.gems=this.gems.filter(g=>{
        const d=Math.sqrt(dist2(g,p));if(d<27){earned+=g.value;return false;}
        if(d<115){const travel=Math.min(d,390*dt);g.x+=(p.x-g.x)/d*travel;g.y+=(p.y-g.y)/d*travel;}return true;
      });
      if(earned)this.gainXP(earned);
      if(this.mode==='playing'){
        const index=this.chests.findIndex(c=>dist2(c,p)<40**2);
        if(index!==-1){this.chests.splice(index,1);this.openChest();}
      }
      for(const e of this.effects)e.life-=dt;
      this.effects=this.effects.filter(e=>e.life>0);
      // Merge close gems when needed; XP is preserved in every merge.
      if(this.gems.length>450){const buckets=new Map();for(const g of this.gems){const key=Math.floor(g.x/55)+','+Math.floor(g.y/55);const old=buckets.get(key);if(old)old.value+=g.value;else buckets.set(key,g);}this.gems=[...buckets.values()];}
    }
  }
  const api={Game,WEAPONS,WIDTH,HEIGHT,DIFFICULTIES,DEFENSES,ITEMS};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.Survivor=api;
})(globalThis);




