"use strict";
(() => {
  const G = SnookerGame;
  const S = G.state;
  const C = document.getElementById("game");
  const X = C.getContext("2d");
  const $ = id => document.getElementById(id);
  const P1 = $("playerOneCard"), P2 = $("playerTwoCard");
  const msg = $("message"), power = $("powerSlider"), shoot = $("shootBtn");
  let last = performance.now(), dragging = false, shown = "", resultShown = false;

  function point(e){
    const r=C.getBoundingClientRect();
    return {x:(e.clientX-r.left)*C.width/r.width,y:(e.clientY-r.top)*C.height/r.height};
  }
  function aim(e){
    if(S.shotActive||S.paused||S.frameOver)return;
    const q=G.cueBall(),p=point(e);
    G.setAim(Math.atan2(p.y-q.y,p.x-q.x));
  }
  C.addEventListener("pointerdown",e=>{dragging=true;C.setPointerCapture(e.pointerId);aim(e)});
  C.addEventListener("pointermove",e=>{if(dragging)aim(e)});
  C.addEventListener("pointerup",()=>dragging=false);
  C.addEventListener("pointercancel",()=>dragging=false);

  power.addEventListener("input",()=>G.setPower(power.value));
  shoot.addEventListener("click",()=>G.shoot());
  $("fineLeftBtn").addEventListener("click",()=>G.nudgeAim(-.02));
  $("fineRightBtn").addEventListener("click",()=>G.nudgeAim(.02));

  $("startBtn").addEventListener("click",()=>{
    G.reset($("playerOneInput").value,$("playerTwoInput").value);
    $("startPanel").classList.add("hidden"); resultShown=false;
  });
  $("menuBtn").addEventListener("click",()=>{if(!S.shotActive&&!S.frameOver){S.paused=true;$("menuPanel").classList.remove("hidden")}});
  $("resumeBtn").addEventListener("click",()=>{$("menuPanel").classList.add("hidden");S.paused=false});
  $("restartBtn").addEventListener("click",()=>{G.reset(S.players[0].name,S.players[1].name);$("menuPanel").classList.add("hidden");resultShown=false});
  $("rulesBtn").addEventListener("click",()=>{$("menuPanel").classList.add("hidden");$("rulesPanel").classList.remove("hidden")});
  $("rulesCloseBtn").addEventListener("click",()=>{$("rulesPanel").classList.add("hidden");$("menuPanel").classList.remove("hidden")});
  $("playAgainBtn").addEventListener("click",()=>{G.reset(S.players[0].name,S.players[1].name);$("resultPanel").classList.add("hidden");resultShown=false});

  function table(){
    const t=G.TABLE;
    X.fillStyle="#101711";X.fillRect(0,0,C.width,C.height);
    X.fillStyle="#694021";X.fillRect(t.x-34,t.y-34,t.w+68,t.h+68);
    X.fillStyle="#17633f";X.fillRect(t.x,t.y,t.w,t.h);
    X.strokeStyle="rgba(255,255,255,.35)";X.lineWidth=2;
    X.beginPath();X.moveTo(250,t.y);X.lineTo(250,t.y+t.h);X.stroke();
    X.beginPath();X.arc(250,280,90,Math.PI/2,Math.PI*1.5);X.stroke();
    for(const p of G.POCKETS){X.fillStyle="#020302";X.beginPath();X.arc(p.x,p.y,G.TABLE.pocketR,0,Math.PI*2);X.fill()}
  }
  function ball(b){
    const r=G.TABLE.ballR;
    X.fillStyle="rgba(0,0,0,.3)";X.beginPath();X.ellipse(b.x+3,b.y+r*.75,r*.85,r*.35,0,0,Math.PI*2);X.fill();
    X.fillStyle=b.colour;X.beginPath();X.arc(b.x,b.y,r,0,Math.PI*2);X.fill();
    X.fillStyle="rgba(255,255,255,.65)";X.beginPath();X.arc(b.x-4,b.y-4,3,0,Math.PI*2);X.fill();
    X.strokeStyle="#111";X.stroke();
  }
  function guide(){
    if(S.shotActive||S.paused||S.frameOver)return;
    const q=G.cueBall(),a=S.aimingAngle;
    X.strokeStyle="rgba(255,255,255,.75)";X.setLineDash([10,8]);X.lineWidth=2;
    X.beginPath();X.moveTo(q.x,q.y);X.lineTo(q.x+Math.cos(a)*220,q.y+Math.sin(a)*220);X.stroke();X.setLineDash([]);
    X.strokeStyle="#d4ad6a";X.lineWidth=7;X.beginPath();
    X.moveTo(q.x-Math.cos(a)*25,q.y-Math.sin(a)*25);
    X.lineTo(q.x-Math.cos(a)*(120+S.power*.5),q.y-Math.sin(a)*(120+S.power*.5));X.stroke();
  }
  function hud(){
    $("playerOneName").textContent=S.players[0].name;$("playerTwoName").textContent=S.players[1].name;
    $("playerOneScore").textContent=S.players[0].score;$("playerTwoScore").textContent=S.players[1].score;
    $("turnLabel").textContent=S.players[S.current].name;$("targetLabel").textContent=`ON: ${G.targetName()}`;
    P1.classList.toggle("active",S.current===0);P2.classList.toggle("active",S.current===1);
    $("powerValue").textContent=`${S.power}%`;power.value=S.power;shoot.disabled=S.shotActive||S.paused||S.frameOver;
    if(S.message!==shown){shown=S.message;msg.textContent=shown;msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),2200)}
    if(S.frameOver&&!resultShown){resultShown=true;$("resultText").textContent=S.result;$("resultPanel").classList.remove("hidden")}
  }
  function loop(now){
    G.update(Math.min(.033,(now-last)/1000));last=now;table();S.balls.filter(b=>!b.potted).forEach(ball);guide();hud();requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
