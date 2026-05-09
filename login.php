<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
startSession();
if (isLoggedIn()) { header('Location: index.php'); exit; }
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Habbito — Sign In</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0E0E10;--card:#1A1A1F;--up:#24242C;--inp:#1E1E26;
  --y:#FFD700;--o:#FF9500;--g:#4ADE80;--r:#F43F5E;
  --t1:#F0F0F5;--t2:#8888A0;--tm:#555566;
  --bd:rgba(255,255,255,.07);
  --ff:'Syne',sans-serif;--fm:'DM Mono',monospace;
}
html{-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--t1);font-family:var(--ff);min-height:100dvh;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
body::before{content:'';position:fixed;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.03)1px,transparent 1px);background-size:28px 28px;z-index:0}
.orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none;opacity:0}
.o1{width:500px;height:500px;background:rgba(255,215,0,.07);top:-180px;left:-180px}
.o2{width:400px;height:400px;background:rgba(255,149,0,.06);bottom:-120px;right:-120px}
.o3{width:280px;height:280px;background:rgba(74,222,128,.05);top:50%;left:50%;transform:translate(-50%,-50%)}
.wrap{position:relative;z-index:1;width:100%;max-width:460px;padding:24px 16px}
/* Logo */
.logo{text-align:center;margin-bottom:32px;opacity:0}
.lm{display:inline-flex;align-items:center;gap:6px}
.lh{font-size:2.8rem;font-weight:800;color:var(--y);line-height:1;filter:drop-shadow(0 0 18px rgba(255,215,0,.45))}
.lt{font-size:2.2rem;font-weight:700;letter-spacing:-.03em}
.tag{display:block;font-family:var(--fm);font-size:.72rem;color:var(--tm);letter-spacing:.14em;text-transform:uppercase;margin-top:6px}
/* Card */
.card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:36px 32px;opacity:0;transform:translateY(30px);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--y),var(--o))}
/* Tabs */
.tabs{display:flex;gap:4px;background:var(--up);border-radius:10px;padding:4px;margin-bottom:28px}
.tab{flex:1;padding:10px;border:none;border-radius:7px;background:transparent;color:var(--t2);font-family:var(--ff);font-size:.9rem;font-weight:600;cursor:pointer;transition:all .2s}
.tab.on{background:var(--card);color:var(--t1);box-shadow:0 2px 8px rgba(0,0,0,.3)}
.tab:hover:not(.on){color:var(--t1)}
/* Panels */
.panel{display:none}.panel.on{display:block}
/* Form */
.fg{margin-bottom:18px}
.lb{display:block;font-size:.7rem;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px}
.iw{position:relative}
.ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:1rem;pointer-events:none;line-height:1}
input{width:100%;background:var(--inp);border:1px solid var(--bd);border-radius:10px;padding:13px 14px 13px 42px;color:var(--t1);font-family:var(--ff);font-size:.95rem;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none}
input::placeholder{color:var(--tm)}
input:focus{border-color:var(--y);box-shadow:0 0 0 3px rgba(255,215,0,.12)}
input.err{border-color:var(--r)!important;box-shadow:0 0 0 3px rgba(244,63,94,.12)!important}
.ptog{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--tm);cursor:pointer;font-size:1rem;padding:4px;line-height:1;transition:color .18s}
.ptog:hover{color:var(--t1)}
/* Strength */
.pws{display:none;margin-top:7px}.pws.v{display:block}
.pwt{height:4px;background:var(--up);border-radius:99px;overflow:hidden;margin-bottom:5px}
.pwf{height:100%;border-radius:inherit;transition:width .3s,background .3s;width:0}
.pwl{font-family:var(--fm);font-size:.67rem;color:var(--tm)}
/* Row inline */
.ri{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.cbl{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem;color:var(--t2);user-select:none}
.cbl input[type=checkbox]{width:16px;height:16px;accent-color:var(--y);cursor:pointer;padding:0}
.fl{font-size:.82rem;color:var(--tm);text-decoration:none;transition:color .18s}
.fl:hover{color:var(--y)}
/* Button */
.btn{width:100%;padding:15px;background:linear-gradient(135deg,var(--y),var(--o));border:none;border-radius:10px;color:#000;font-family:var(--ff);font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.02em;transition:transform .2s,box-shadow .2s,opacity .2s;position:relative;overflow:hidden}
.btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,149,0,.3)}
.btn:active:not(:disabled){transform:scale(.97)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.spin{display:inline-block;width:18px;height:18px;border:2px solid rgba(0,0,0,.25);border-top-color:#000;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* Alert */
.al{border-radius:10px;padding:12px 14px;font-size:.85rem;margin-bottom:18px;display:none}
.al.show{display:block;animation:ain .3s ease}
.aerr{background:rgba(244,63,94,.12);border:1px solid rgba(244,63,94,.3);color:#FDA4B1}
.aok {background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.3);color:#86EFAC}
.al ul{padding-left:16px}.al li{margin-bottom:3px}
@keyframes ain{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
/* Divider */
.dv{display:flex;align-items:center;gap:12px;margin:22px 0;color:var(--tm);font-size:.75rem}
.dv::before,.dv::after{content:'';flex:1;height:1px;background:var(--bd)}
/* Footer */
.ft{text-align:center;margin-top:20px;font-size:.82rem;color:var(--tm)}
.ft a{color:var(--y);text-decoration:none}
/* Particles */
.pt{position:fixed;border-radius:50%;pointer-events:none;opacity:0}
@media(max-width:480px){.card{padding:28px 18px}.lh{font-size:2.2rem}.lt{font-size:1.8rem}}
:focus-visible{outline:2px solid var(--y);outline-offset:2px;border-radius:4px}
::selection{background:rgba(255,215,0,.25)}
</style>
</head>
<body>
<div class="orb o1"></div>
<div class="orb o2"></div>
<div class="orb o3"></div>
<div class="wrap">
  <div class="logo" id="logo">
    <div class="lm"><span class="lh">H</span><span class="lt">abbito</span></div>
    <span class="tag">Level up your daily life</span>
  </div>
  <div class="card" id="card">
    <!-- Tabs -->
    <div class="tabs">
      <button class="tab on" data-p="login">Sign In</button>
      <button class="tab" data-p="register">Create Account</button>
    </div>

    <!-- LOGIN -->
    <div class="panel on" id="panel-login">
      <div class="al aerr" id="login-err"></div>
      <div class="fg">
        <label class="lb" for="li">Username or Email</label>
        <div class="iw">
          <span class="ic">👤</span>
          <input type="text" id="li" placeholder="Enter username or email" autocomplete="username" autocapitalize="none" maxlength="120"/>
        </div>
      </div>
      <div class="fg">
        <label class="lb" for="lp">Password</label>
        <div class="iw">
          <span class="ic">🔒</span>
          <input type="password" id="lp" placeholder="Your password" autocomplete="current-password" maxlength="200"/>
          <button class="ptog" data-t="lp" type="button">👁</button>
        </div>
      </div>
      <div class="ri">
        <label class="cbl"><input type="checkbox" id="lrem"/> Remember me 30 days</label>
        <a href="#" class="fl" id="forgot">Forgot password?</a>
      </div>
      <button class="btn" id="btn-login" type="button">Sign In</button>
      <div class="dv">or</div>
      <div class="ft">No account? <a href="#" data-sw="register">Create one free →</a></div>
    </div>

    <!-- REGISTER -->
    <div class="panel" id="panel-register">
      <div class="al aerr" id="reg-err"></div>
      <div class="fg">
        <label class="lb" for="ru">Username</label>
        <div class="iw">
          <span class="ic">🧑</span>
          <input type="text" id="ru" placeholder="Choose a username" autocomplete="username" autocapitalize="none" maxlength="50"/>
        </div>
      </div>
      <div class="fg">
        <label class="lb" for="re">Email Address</label>
        <div class="iw">
          <span class="ic">✉️</span>
          <input type="email" id="re" placeholder="you@example.com" autocomplete="email" maxlength="120"/>
        </div>
      </div>
      <div class="fg">
        <label class="lb" for="rp">Password</label>
        <div class="iw">
          <span class="ic">🔒</span>
          <input type="password" id="rp" placeholder="At least 8 characters" autocomplete="new-password" maxlength="200"/>
          <button class="ptog" data-t="rp" type="button">👁</button>
        </div>
        <div class="pws" id="pws">
          <div class="pwt"><div class="pwf" id="pwf"></div></div>
          <span class="pwl" id="pwl">Enter a password</span>
        </div>
      </div>
      <div class="fg">
        <label class="lb" for="rc">Confirm Password</label>
        <div class="iw">
          <span class="ic">🔐</span>
          <input type="password" id="rc" placeholder="Repeat your password" autocomplete="new-password" maxlength="200"/>
          <button class="ptog" data-t="rc" type="button">👁</button>
        </div>
      </div>
      <button class="btn" id="btn-reg" type="button">Create Account</button>
      <div class="dv">or</div>
      <div class="ft">Have an account? <a href="#" data-sw="login">Sign in →</a></div>
    </div>
  </div>
</div>

<script>
'use strict';

// ── Entrance animations ────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  anime({targets:'.orb', opacity:1, duration:1400, delay:anime.stagger(200), easing:'easeOutCubic'});
  anime({targets:'#logo', opacity:[0,1], translateY:[-30,0], duration:700, easing:'easeOutBack', delay:100});
  anime({targets:'#card', opacity:[0,1], translateY:[40,0], scale:[.96,1], duration:650, easing:'easeOutBack', delay:250});
  staggerPanel('login', 400);
  particles();
  setTimeout(()=>anime({targets:'.lh',scale:[1,1.06,1],duration:1400,easing:'easeInOutSine',loop:true,direction:'alternate'}),1200);
});

function staggerPanel(name, delay) {
  anime({targets:`#panel-${name} .fg, #panel-${name} .ri, #panel-${name} .btn, #panel-${name} .dv, #panel-${name} .ft`, opacity:[0,1], translateY:[14,0], duration:380, delay:anime.stagger(45,{start:delay||0}), easing:'easeOutCubic'});
}

// ── Tab switching ──────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('on',t.dataset.p===name)});
  document.querySelectorAll('.panel').forEach(p=>{p.classList.toggle('on',p.id==='panel-'+name)});
  clearErr();
  staggerPanel(name);
  setTimeout(()=>{const f=document.querySelector('#panel-'+name+' input');if(f)f.focus();},80);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.p)));
document.querySelectorAll('[data-sw]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();switchTab(a.dataset.sw)}));

// ── Password toggles ───────────────────────────────────────
document.querySelectorAll('.ptog').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const inp=document.getElementById(btn.dataset.t);
    inp.type=inp.type==='text'?'password':'text';
    btn.textContent=inp.type==='text'?'🙈':'👁';
    anime({targets:btn,scale:[.6,1],duration:250,easing:'easeOutBack'});
  });
});

// ── Password strength ──────────────────────────────────────
document.getElementById('rp').addEventListener('input',e=>{
  const v=e.target.value,w=document.getElementById('pws');
  if(!v){w.classList.remove('v');return;}w.classList.add('v');
  let s=0;
  if(v.length>=8)s++;if(v.length>=12)s++;
  if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^a-zA-Z0-9]/.test(v))s++;
  const L=[{p:20,c:'#F43F5E',l:'Very weak'},{p:40,c:'#FF9500',l:'Weak'},{p:60,c:'#FFD700',l:'Fair'},{p:80,c:'#4ADE80',l:'Strong'},{p:100,c:'#4ADE80',l:'Very strong'}];
  const lv=L[Math.min(s,4)];
  anime({targets:'#pwf',width:lv.p+'%',background:lv.c,duration:280,easing:'easeOutCubic'});
  const pl=document.getElementById('pwl');pl.textContent=lv.l;pl.style.color=lv.c;
});

// ── Alerts ────────────────────────────────────────────────
function showErr(id,msgs){
  const el=document.getElementById(id);
  el.innerHTML=Array.isArray(msgs)&&msgs.length>1?'<ul>'+msgs.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul>':esc(Array.isArray(msgs)?msgs[0]:msgs);
  el.classList.add('show');
  anime({targets:'#card',translateX:[-8,8,-5,5,-2,2,0],duration:380,easing:'easeInOutSine'});
}
function clearErr(){document.querySelectorAll('.al').forEach(e=>e.classList.remove('show'))}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function shake(ids){ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;el.classList.add('err');anime({targets:el,translateX:[-6,6,-4,4,0],duration:340,easing:'easeInOutSine'});el.addEventListener('input',()=>el.classList.remove('err'),{once:true})})}

// ── Fetch helper ──────────────────────────────────────────
async function post(data){
  const r=await fetch('auth.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!r.ok&&r.status!==200&&r.status!==400){throw new Error('Server error '+r.status)}
  return r.json();
}

// ── Button state ──────────────────────────────────────────
function setLoad(btn,on,label){
  if(on){btn._l=btn.textContent;btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
  else{btn.disabled=false;btn.textContent=btn._l||label;}
}

// ── LOGIN ──────────────────────────────────────────────────
async function doLogin(){
  clearErr();
  const id=document.getElementById('li').value.trim();
  const pw=document.getElementById('lp').value;
  const rem=document.getElementById('lrem').checked;
  if(!id||!pw){showErr('login-err',['Please fill in all fields.']);shake(['li','lp']);return;}
  const btn=document.getElementById('btn-login');
  setLoad(btn,true);
  try{
    const d=await post({action:'login',identifier:id,password:pw,remember:rem});
    if(d.success){
      anime({targets:'#card',opacity:[1,0],scale:[1,.95],duration:400,easing:'easeInCubic',complete:()=>{window.location.href=d.redirect;}});
    }else{
      setLoad(btn,false,'Sign In');
      showErr('login-err',d.errors||[d.error||'Login failed.']);
      shake(['li','lp']);
    }
  }catch(e){setLoad(btn,false,'Sign In');showErr('login-err',['Network error. Check your connection and try again.']);}
}
document.getElementById('btn-login').addEventListener('click',doLogin);
['li','lp'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()}));
document.getElementById('forgot').addEventListener('click',e=>{e.preventDefault();showErr('login-err',['Password reset is not configured. Contact your administrator.'])});

// ── REGISTER ──────────────────────────────────────────────
async function doRegister(){
  clearErr();
  const u=document.getElementById('ru').value.trim();
  const em=document.getElementById('re').value.trim();
  const pw=document.getElementById('rp').value;
  const co=document.getElementById('rc').value;
  const errs=[];
  if(u.length<3)errs.push('Username must be at least 3 characters.');
  if(!/^[a-zA-Z0-9_\-]+$/.test(u))errs.push('Username: letters, numbers, _ and - only.');
  if(!em.includes('@'))errs.push('Enter a valid email address.');
  if(pw.length<8)errs.push('Password must be at least 8 characters.');
  if(pw!==co)errs.push('Passwords do not match.');
  if(errs.length){showErr('reg-err',errs);return;}
  const btn=document.getElementById('btn-reg');
  setLoad(btn,true);
  try{
    const d=await post({action:'register',username:u,email:em,password:pw,confirm:co});
    if(d.success){
      anime({targets:'#card',opacity:[1,0],scale:[1,.95],duration:400,easing:'easeInCubic',complete:()=>{window.location.href=d.redirect;}});
    }else{
      setLoad(btn,false,'Create Account');
      showErr('reg-err',d.errors||[d.error||'Registration failed.']);
    }
  }catch(e){setLoad(btn,false,'Create Account');showErr('reg-err',['Network error. Check your connection and try again.']);}
}
document.getElementById('btn-reg').addEventListener('click',doRegister);
document.getElementById('rc').addEventListener('keydown',e=>{if(e.key==='Enter')doRegister()});

// ── Particles ──────────────────────────────────────────────
function particles(){
  const cols=['rgba(255,215,0,','rgba(255,149,0,','rgba(74,222,128,'];
  for(let i=0;i<22;i++){
    const p=document.createElement('div'),sz=Math.random()*4+2,c=cols[i%3];
    p.className='pt';
    p.style.cssText=`width:${sz}px;height:${sz}px;background:${c}${Math.random()*.4+.1});left:${Math.random()*100}vw;top:${Math.random()*100}vh`;
    document.body.appendChild(p);
    anime({targets:p,opacity:[0,Math.random()*.5+.1,0],translateY:[0,-(Math.random()*120+40)],translateX:[(Math.random()-.5)*60],duration:Math.random()*4000+3000,delay:Math.random()*2000,easing:'easeOutCubic',loop:true});
  }
}
</script>
</body>
</html>
