/* ============================================================
   HABBITO — animations.js
   Premium animation layer — loads after script.js
   Adds: aurora bg, 3D card tilt, ripples, magnetic FAB,
   particle bursts, sparkle trail, slot-machine numbers,
   smooth view transitions, enhanced level-up, glow pulses
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────
// WAIT FOR APP TO BOOT, THEN ENHANCE
// ─────────────────────────────────────────────
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    initAurora();
    initRippleSystem();
    initMagneticFAB();
    initScrollObserver();
    initGlobalHoverPolish();
    interceptViewSwitch();
    interceptCompletionTimeline();
    interceptLevelUp();
    interceptFloatingXP();
    initSidebarSpring();
    initModalSpring();
    startBreathingEffects();
  });
});

// ─────────────────────────────────────────────
// 1. AURORA BACKGROUND
//    Replaces simple dots with dynamic color blobs
// ─────────────────────────────────────────────
function initAurora() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Floating color blobs
  const blobs = [
    { x: 0.15, y: 0.2,  r: 0.35, hue: 47,  spd: 0.00008 },  // gold
    { x: 0.8,  y: 0.7,  r: 0.30, hue: 27,  spd: 0.00006 },  // orange
    { x: 0.5,  y: 0.9,  r: 0.25, hue: 142, spd: 0.00010 },  // green
    { x: 0.3,  y: 0.6,  r: 0.20, hue: 200, spd: 0.00007 },  // blue
    { x: 0.7,  y: 0.2,  r: 0.22, hue: 270, spd: 0.00009 },  // purple
  ];
  const blobAngles = blobs.map(() => Math.random() * Math.PI * 2);

  // Foreground tiny stars
  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.2 + 0.2,
    a: Math.random() * 0.6 + 0.1,
    pa: Math.random() * Math.PI * 2,
    spd: 0.003 + Math.random() * 0.004,
  }));

  let t = 0;
  let mouseX = W / 2, mouseY = H / 2;
  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t++;

    // ── Draw aurora blobs ────────────────────
    blobs.forEach((b, i) => {
      blobAngles[i] += b.spd;
      // Orbit around base position, slightly attracted to mouse
      const mx = (mouseX / W - 0.5) * 0.04;
      const my = (mouseY / H - 0.5) * 0.04;
      const bx = (b.x + Math.cos(blobAngles[i]) * 0.12 + mx) * W;
      const by = (b.y + Math.sin(blobAngles[i] * 1.3) * 0.10 + my) * H;
      const br = b.r * Math.min(W, H);

      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0,   `hsla(${b.hue},90%,60%,0.10)`);
      grad.addColorStop(0.5, `hsla(${b.hue},80%,50%,0.05)`);
      grad.addColorStop(1,   `hsla(${b.hue},70%,40%,0.00)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Draw twinkling stars ─────────────────
    stars.forEach(s => {
      s.pa += s.spd;
      const alpha = s.a * (0.5 + 0.5 * Math.sin(s.pa));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }
  draw();
}

// ─────────────────────────────────────────────
// 2. RIPPLE SYSTEM
//    Adds ripple on click to buttons, cards, nav
// ─────────────────────────────────────────────
function initRippleSystem() {
  // Ensure ripple target has position:relative
  function addRipple(el) {
    if (el._rippleReady) return;
    el._rippleReady = true;
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';

    el.addEventListener('pointerdown', e => {
      const rect  = el.getBoundingClientRect();
      const size  = Math.max(rect.width, rect.height) * 2.2;
      const x     = e.clientX - rect.left - size / 2;
      const y     = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'anim-ripple';
      ripple.style.cssText = `
        position:absolute;border-radius:50%;pointer-events:none;
        width:${size}px;height:${size}px;left:${x}px;top:${y}px;
        background:rgba(255,255,255,0.18);transform:scale(0);
      `;
      el.appendChild(ripple);

      anime({
        targets:  ripple,
        scale:    [0, 1],
        opacity:  [0.4, 0],
        duration: 700,
        easing:   'easeOutCubic',
        complete: () => ripple.remove(),
      });
    });
  }

  // Apply to existing + future elements
  function applyRipples() {
    document.querySelectorAll(
      '.btn-primary,.btn-ghost,.btn-danger,.nav-btn,.add-habit-fab,' +
      '.mobile-add-btn,.logout-btn,.tab,.card-detail-btn,.quest-card,' +
      '.badge-card,.stat-card,.pstat,.auth-tab'
    ).forEach(addRipple);
  }
  applyRipples();

  // Re-apply after dashboard renders (new cards added)
  const mo = new MutationObserver(applyRipples);
  mo.observe(document.body, { childList: true, subtree: true });
}

// ─────────────────────────────────────────────
// 3. MAGNETIC FAB
//    The "New Habit" button follows cursor slightly
// ─────────────────────────────────────────────
function initMagneticFAB() {
  const fab = document.getElementById('open-add-modal');
  if (!fab) return;
  let isInside = false;

  fab.addEventListener('mouseenter', () => { isInside = true; });
  fab.addEventListener('mouseleave', () => {
    isInside = false;
    anime({ targets: fab, translateX: 0, translateY: 0, duration: 500, easing: 'easeOutElastic(1,0.4)' });
  });
  fab.addEventListener('mousemove', e => {
    if (!isInside) return;
    const rect = fab.getBoundingClientRect();
    const dx   = (e.clientX - (rect.left + rect.width  / 2)) * 0.28;
    const dy   = (e.clientY - (rect.top  + rect.height / 2)) * 0.28;
    anime({ targets: fab, translateX: dx, translateY: dy, duration: 180, easing: 'easeOutCubic' });
  });
}

// ─────────────────────────────────────────────
// 4. SCROLL OBSERVER
//    Elements fade+slide up as they enter view
// ─────────────────────────────────────────────
function initScrollObserver() {
  const selectors = [
    '.stat-card','.chart-card','.quest-card','.badge-card',
    '.pstat','.profile-hero-card','.profile-xp-card',
    '.profile-chart-card','.profile-badges-card',
    '.quests-tip','.badges-locked-section',
  ];

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el._scrollSeen) return;
      el._scrollSeen = true;
      anime({
        targets:    el,
        opacity:    [0, 1],
        translateY: [28, 0],
        scale:      [0.96, 1],
        duration:   480,
        easing:     'easeOutBack',
        delay:      (el._scrollDelay || 0),
      });
      observer.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  function observeAll() {
    document.querySelectorAll(selectors.join(',')).forEach((el, i) => {
      if (!el._observed) {
        el._observed    = true;
        el._scrollDelay = (i % 6) * 55;
        el.style.opacity = '0';
        observer.observe(el);
      }
    });
  }
  observeAll();
  new MutationObserver(observeAll).observe(document.body, { childList: true, subtree: true });
}

// ─────────────────────────────────────────────
// 5. GLOBAL HOVER POLISH
//    3D tilt on habit cards, spring on interactive els
// ─────────────────────────────────────────────
function initGlobalHoverPolish() {
  // 3D tilt on habit cards
  function addTilt(card) {
    if (card._tiltReady) return;
    card._tiltReady = true;
    card.style.transformStyle = 'preserve-3d';

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x    = (e.clientX - rect.left) / rect.width  - 0.5;
      const y    = (e.clientY - rect.top)  / rect.height - 0.5;
      anime({
        targets:  card,
        rotateY:   x * 14,
        rotateX:  -y * 14,
        scale:     1.03,
        duration:  220,
        easing:    'easeOutCubic',
      });
      // Move the top gradient bar to feel "lit"
      const bar = card.querySelector(':before') || card;
      card.style.setProperty('--tilt-x', x.toFixed(2));
      card.style.setProperty('--tilt-y', y.toFixed(2));
    });

    card.addEventListener('mouseleave', () => {
      anime({
        targets:  card,
        rotateY:  0, rotateX: 0, scale: 1,
        duration: 550,
        easing:   'easeOutElastic(1,0.4)',
      });
    });
  }

  function applyTilts() {
    document.querySelectorAll('.habit-card').forEach(addTilt);
  }
  applyTilts();
  new MutationObserver(applyTilts).observe(
    document.getElementById('habits-grid') || document.body,
    { childList: true, subtree: true }
  );

  // Spring scale on nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () =>
      anime({ targets: btn, scaleX: 1.04, scaleY: 1.04, duration: 200, easing: 'easeOutElastic(1,0.6)' })
    );
    btn.addEventListener('mouseleave', () =>
      anime({ targets: btn, scaleX: 1, scaleY: 1, duration: 300, easing: 'easeOutElastic(1,0.5)' })
    );
  });
}

// ─────────────────────────────────────────────
// 6. INTERCEPT VIEW SWITCH — slide transition
// ─────────────────────────────────────────────
function interceptViewSwitch() {
  // Patch the global switchView to add transitions
  const _orig = window.switchView || (() => {});

  // We use a custom event + patched function
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);

    clone.addEventListener('click', () => {
      const viewName = clone.dataset.view;
      const current  = document.querySelector('.view.active');

      if (current && current.id !== `view-${viewName}`) {
        // Slide out current
        anime({
          targets:  current,
          opacity:  [1, 0],
          translateX: [0, -30],
          duration: 200,
          easing:   'easeInCubic',
          complete: () => {
            current.classList.remove('active');
            current.style.opacity   = '';
            current.style.transform = '';
            // Let original handler run
            if (typeof switchView === 'function') {
              switchView(viewName);
            }
            // Slide in new view
            const next = document.getElementById(`view-${viewName}`);
            if (next) {
              next.style.opacity   = '0';
              next.style.transform = 'translateX(30px)';
              requestAnimationFrame(() => {
                anime({
                  targets:  next,
                  opacity:  [0, 1],
                  translateX: [30, 0],
                  duration: 350,
                  easing:   'easeOutCubic',
                });
              });
            }
          },
        });
      } else if (typeof switchView === 'function') {
        switchView(viewName);
      }

      // Ripple on active nav item
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      clone.classList.add('active');

      // Icon bounce
      const icon = clone.querySelector('.nav-icon');
      if (icon) {
        anime({
          targets:  icon,
          scale:    [1, 1.4, 1],
          rotate:   [0, -12, 0],
          duration: 400,
          easing:   'easeOutElastic(1,0.5)',
        });
      }
    });
  });
}

// ─────────────────────────────────────────────
// 7. PARTICLE BURST SYSTEM
//    Called on habit completion — starburst
// ─────────────────────────────────────────────
window.particleBurst = function(x, y, color = '#FFD700', count = 18) {
  for (let i = 0; i < count; i++) {
    const p    = document.createElement('div');
    const size = Math.random() * 8 + 4;
    const angle= (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = 50 + Math.random() * 90;
    const shapes = ['50%', '0%', '3px'];
    const shape  = shapes[Math.floor(Math.random() * shapes.length)];

    p.style.cssText = `
      position:fixed;pointer-events:none;z-index:9999;
      width:${size}px;height:${size}px;
      left:${x - size/2}px;top:${y - size/2}px;
      background:${color};border-radius:${shape};
    `;
    document.body.appendChild(p);

    anime({
      targets:    p,
      translateX: Math.cos(angle) * dist,
      translateY: Math.sin(angle) * dist - 30,
      scale:      [1, 0],
      opacity:    [1, 0],
      rotate:     Math.random() * 360,
      duration:   600 + Math.random() * 400,
      easing:     'easeOutCubic',
      complete:   () => p.remove(),
    });
  }
};

// ─────────────────────────────────────────────
// 8. INTERCEPT COMPLETION TIMELINE
//    Adds particle burst + card flash + ring
// ─────────────────────────────────────────────
function interceptCompletionTimeline() {
  const _orig = window.runCompletionTimeline;
  if (typeof _orig !== 'function') return;

  window.runCompletionTimeline = function(cardEl, habitId, data) {
    // Call original
    _orig(cardEl, habitId, data);

    // Extra: particle burst from card center
    const rect  = cardEl.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const color = getComputedStyle(cardEl).getPropertyValue('--card-color').trim() || '#FFD700';

    setTimeout(() => {
      particleBurst(cx, cy, color, 20);
      particleBurst(cx, cy, '#fff', 8);
    }, 150);

    // Ring expansion
    const ring = document.createElement('div');
    ring.style.cssText = `
      position:fixed;pointer-events:none;z-index:999;border-radius:50%;
      border:3px solid ${color};
      left:${cx - 20}px;top:${cy - 20}px;
      width:40px;height:40px;opacity:0.9;
    `;
    document.body.appendChild(ring);
    anime({
      targets:  ring,
      scale:    [1, 5],
      opacity:  [0.8, 0],
      duration: 700,
      easing:   'easeOutCubic',
      complete: () => ring.remove(),
    });

    // Card color flash
    anime({
      targets:  cardEl,
      backgroundColor: [color + '33', ''],
      duration: 800,
      easing:   'easeOutCubic',
    });
  };
}

// ─────────────────────────────────────────────
// 9. INTERCEPT FLOATING XP
//    Adds sparkle trail to XP float
// ─────────────────────────────────────────────
function interceptFloatingXP() {
  const _orig = window.spawnFloatingXP;
  if (typeof _orig !== 'function') return;

  window.spawnFloatingXP = function(anchorEl, xp) {
    _orig(anchorEl, xp);

    // Add sparkles alongside
    const rect = anchorEl.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + 10;

    for (let i = 0; i < 6; i++) {
      const s = document.createElement('div');
      s.innerHTML = '✦';
      s.style.cssText = `
        position:fixed;pointer-events:none;z-index:9998;
        font-size:${8 + Math.random() * 8}px;
        color:#FFD700;
        left:${baseX + (Math.random() - 0.5) * 60}px;
        top:${baseY + Math.random() * 20}px;
      `;
      document.body.appendChild(s);
      anime({
        targets:    s,
        translateY: [0, -(60 + Math.random() * 40)],
        translateX: [(Math.random() - 0.5) * 40],
        opacity:    [1, 0],
        scale:      [0.5, 1.2, 0],
        rotate:     Math.random() * 360,
        duration:   900 + Math.random() * 300,
        delay:      Math.random() * 200,
        easing:     'easeOutCubic',
        complete:   () => s.remove(),
      });
    }
  };
}

// ─────────────────────────────────────────────
// 10. INTERCEPT LEVEL UP — extra drama
// ─────────────────────────────────────────────
function interceptLevelUp() {
  const _orig = window.runLevelUpCinematic;
  if (typeof _orig !== 'function') return;

  window.runLevelUpCinematic = function(newLevel) {
    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed;inset:0;z-index:9998;
      background:rgba(255,215,0,0.15);pointer-events:none;
    `;
    document.body.appendChild(flash);
    anime({
      targets:  flash,
      opacity:  [1, 0],
      duration: 400,
      easing:   'easeOutCubic',
      complete: () => flash.remove(),
    });

    // Screen shake via body
    anime({
      targets:   document.getElementById('main-content'),
      translateX: [-6, 6, -4, 4, -2, 2, 0],
      duration:  400,
      easing:    'easeInOutSine',
    });

    // Call original
    _orig(newLevel);

    // Extra multi-burst confetti
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          confetti({
            particleCount: 60,
            spread:        100,
            startVelocity: 45,
            origin:        { x: Math.random(), y: Math.random() * 0.5 },
            colors:        ['#FFD700','#FF9500','#4ADE80','#38BDF8','#8B5CF6','#fff'],
            shapes:        ['star','circle'],
            scalar:        1.2,
          });
        }, i * 250);
      }
    }, 400);

    // Glitch effect on the level number
    const numEl = document.getElementById('levelup-number');
    if (numEl) {
      const glitchChars = ['!','?','#','@','*','&',newLevel];
      let gc = 0;
      const glitchInterval = setInterval(() => {
        numEl.textContent = glitchChars[gc % glitchChars.length];
        gc++;
        if (gc > 10) {
          clearInterval(glitchInterval);
          numEl.textContent = newLevel;
        }
      }, 80);
    }
  };
}

// ─────────────────────────────────────────────
// 11. SIDEBAR SPRING
//    Nav icons bounce on hover
// ─────────────────────────────────────────────
function initSidebarSpring() {
  // XP avatar wiggle on stat gain
  const xpAvatar = document.getElementById('xp-level-display');
  if (xpAvatar) {
    const observer = new MutationObserver(() => {
      anime({
        targets:  xpAvatar,
        scale:    [1, 1.3, 1],
        rotate:   [0, -10, 10, 0],
        duration: 500,
        easing:   'easeOutElastic(1,0.4)',
      });
    });
    observer.observe(xpAvatar, { characterData: true, subtree: true, childList: true });
  }

  // XP bar fill pulse when it updates
  const xpFill = document.getElementById('xp-bar-fill');
  if (xpFill) {
    const observer = new MutationObserver(() => {
      anime({
        targets:  xpFill,
        boxShadow: ['0 0 8px #FFD700','0 0 20px #FFD700','0 0 8px #FFD700'],
        duration:  800,
        easing:    'easeOutCubic',
      });
    });
    observer.observe(xpFill, { attributes: true, attributeFilter: ['style'] });
  }
}

// ─────────────────────────────────────────────
// 12. MODAL SPRING ENHANCEMENT
//    Modals bounce in from below with spring
// ─────────────────────────────────────────────
function initModalSpring() {
  // Override modal open to add spring entrance
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(overlay => {
    const box = overlay.querySelector('.modal-box');
    if (!box) return;

    const origOpen  = overlay.classList.remove.bind(overlay.classList);
    // Watch for hidden class removal (= modal opens)
    new MutationObserver(mutations => {
      mutations.forEach(m => {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const isOpen = !overlay.classList.contains('hidden');
          if (isOpen) {
            anime({
              targets:  box,
              translateY: [60, 0],
              scale:    [0.88, 1],
              opacity:  [0, 1],
              duration: 500,
              easing:   'easeOutBack',
            });
          }
        }
      });
    }).observe(overlay, { attributes: true });
  });
}

// ─────────────────────────────────────────────
// 13. BREATHING EFFECTS
//    Streak badge, avatar glow, arc pulse
// ─────────────────────────────────────────────
function startBreathingEffects() {
  // Streak badge breathing glow
  const streakBadge = document.querySelector('.daily-streak-badge');
  if (streakBadge) {
    anime({
      targets:   streakBadge,
      boxShadow: [
        '0 0  0px rgba(255,149,0,0)',
        '0 0 16px rgba(255,149,0,0.5)',
        '0 0  0px rgba(255,149,0,0)',
      ],
      duration:  2200,
      loop:      true,
      easing:    'easeInOutSine',
    });
  }

  // Arc fill gentle pulse
  const arc = document.getElementById('arc-fill');
  if (arc) {
    anime({
      targets:  arc,
      filter:   ['drop-shadow(0 0 4px #FFD700)', 'drop-shadow(0 0 12px #FFD700)', 'drop-shadow(0 0 4px #FFD700)'],
      duration: 2600,
      loop:     true,
      easing:   'easeInOutSine',
    });
  }

  // Percent label subtle scale
  const pct = document.getElementById('arc-pct');
  if (pct) {
    anime({
      targets:   pct,
      scale:     [1, 1.04, 1],
      duration:  2600,
      loop:      true,
      easing:    'easeInOutSine',
    });
  }

  // Sidebar logo shimmer
  const logoH = document.querySelector('.logo-h');
  if (logoH) {
    anime({
      targets:   logoH,
      textShadow:[
        '0 0  8px rgba(255,215,0,0.4)',
        '0 0 24px rgba(255,215,0,0.9)',
        '0 0  8px rgba(255,215,0,0.4)',
      ],
      duration:  3000,
      loop:      true,
      easing:    'easeInOutSine',
    });
  }

  // Quest cards: color pulse on incomplete
  setInterval(() => {
    document.querySelectorAll('.quest-card:not(.quest-done)').forEach((card, i) => {
      setTimeout(() => {
        anime({
          targets:  card,
          boxShadow:['0 0 0 1px rgba(255,149,0,0)','0 0 0 1px rgba(255,149,0,0.3)','0 0 0 1px rgba(255,149,0,0)'],
          duration:  1000,
          easing:   'easeInOutSine',
        });
      }, i * 120);
    });
  }, 4000);
}

// ─────────────────────────────────────────────
// 14. SMOOTH COUNTER UPGRADE
//    Override countUp to add slot-machine feel
// ─────────────────────────────────────────────
const _origCountUp = window.countUp;
window.countUp = function(elId, from, to, duration) {
  const el = document.getElementById(elId);
  if (!el) return;

  // If number is big, do a slot-machine rapid-scroll then settle
  if (to > 10) {
    let frame = 0;
    const totalFrames = Math.floor(duration / 30);
    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
      const current = Math.round(from + (to - from) * ease);

      // Slot-machine: show random numbers near target during first 60%
      if (progress < 0.6 && to > 20) {
        el.textContent = Math.round(current + (Math.random() - 0.5) * (to * 0.1))
                           .toLocaleString();
      } else {
        el.textContent = current.toLocaleString();
      }

      if (frame >= totalFrames) {
        clearInterval(interval);
        el.textContent = to.toLocaleString();
      }
    }, 30);
  } else {
    // Small numbers: plain countUp
    if (_origCountUp) _origCountUp(elId, from, to, duration);
  }
};

// ─────────────────────────────────────────────
// 15. HOVER SOUND SIMULATION
//    Subtle visual "click" feedback on all buttons
// ─────────────────────────────────────────────
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('button, .nav-btn, .habit-card, a.logout-btn');
  if (!btn) return;
  anime({
    targets:  btn,
    scale:    0.96,
    duration: 80,
    easing:   'easeOutCubic',
  });
});
document.addEventListener('pointerup', e => {
  const btn = e.target.closest('button, .nav-btn, .habit-card, a.logout-btn');
  if (!btn) return;
  anime({
    targets:  btn,
    scale:    1,
    duration: 250,
    easing:   'easeOutElastic(1,0.5)',
  });
});

// ─────────────────────────────────────────────
// 16. HEATMAP CELL HOVER RIPPLE
// ─────────────────────────────────────────────
document.addEventListener('mouseover', e => {
  const cell = e.target.closest('.hm-cell');
  if (!cell || cell._hoverAnimating) return;
  cell._hoverAnimating = true;
  anime({
    targets:  cell,
    scale:    [1, 1.5, 1.3],
    duration: 200,
    easing:   'easeOutElastic(1,0.5)',
    complete: () => { cell._hoverAnimating = false; },
  });
});

// ─────────────────────────────────────────────
// 17. AUTO-ANIMATE NEW ELEMENTS
//    Anything newly added to the DOM gets a
//    subtle entrance animation
// ─────────────────────────────────────────────
const entranceMO = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;

      // Quest cards
      if (node.classList?.contains('quest-card')) {
        anime({ targets: node, opacity: [0,1], translateY: [20,0], scale: [0.95,1], duration: 400, easing: 'easeOutBack' });
      }
      // Badge chips
      if (node.classList?.contains('profile-badge-chip')) {
        anime({ targets: node, opacity: [0,1], scale: [0.8,1], duration: 350, easing: 'easeOutBack' });
      }
      // Log items
      if (node.classList?.contains('log-item')) {
        anime({ targets: node, opacity: [0,1], translateX: [-16,0], duration: 300, easing: 'easeOutCubic' });
      }
    });
  });
});
entranceMO.observe(document.body, { childList: true, subtree: true });

// ─────────────────────────────────────────────
// 18. HABIT CARD COMPLETION FLASH
//    Cards flash green when completed
// ─────────────────────────────────────────────
document.addEventListener('animationend', () => {}, { passive: true });

// Watch for cards getting the is-completed class
const completionMO = new MutationObserver(mutations => {
  mutations.forEach(m => {
    if (m.type === 'attributes' && m.attributeName === 'class') {
      const card = m.target;
      if (!card.classList.contains('habit-card')) return;
      if (card.classList.contains('is-completed')) {
        // Green flash overlay
        const flash = document.createElement('div');
        flash.style.cssText = `
          position:absolute;inset:0;border-radius:inherit;
          background:rgba(74,222,128,0.15);pointer-events:none;z-index:5;
        `;
        card.style.position = 'relative';
        card.appendChild(flash);
        anime({
          targets:  flash,
          opacity:  [1, 0],
          duration: 800,
          easing:   'easeOutCubic',
          complete: () => flash.remove(),
        });

        // Check mark pop
        const check = card.querySelector('.card-check');
        if (check) {
          anime({
            targets:  check,
            scale:    [0.5, 1.3, 1],
            rotate:   [0, 15, 0],
            duration: 500,
            easing:   'easeOutElastic(1,0.4)',
          });
        }
      }
    }
  });
});
completionMO.observe(document.body, {
  attributes: true, subtree: true, attributeFilter: ['class'],
});

// ─────────────────────────────────────────────
// 19. SUMMARY COUNTER BOUNCE
//    "X / Y done" bounces when number changes
// ─────────────────────────────────────────────
const summaryDone = document.getElementById('summary-done');
if (summaryDone) {
  new MutationObserver(() => {
    anime({
      targets:  summaryDone,
      scale:    [1, 1.4, 1],
      color:    ['#4ADE80', '#F0F0F5'],
      duration: 500,
      easing:   'easeOutElastic(1,0.5)',
    });
  }).observe(summaryDone, { characterData: true, childList: true, subtree: true });
}

// ─────────────────────────────────────────────
// 20. LOADING BAR SHIMMER
//    Adds shimmer sweep to the loading bar
// ─────────────────────────────────────────────
const loadBar = document.getElementById('loading-bar');
if (loadBar) {
  loadBar.style.position = 'relative';
  loadBar.style.overflow = 'hidden';
  const shimmer = document.createElement('div');
  shimmer.style.cssText = `
    position:absolute;top:0;left:-60%;width:40%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent);
    transform:skewX(-20deg);
  `;
  loadBar.appendChild(shimmer);
  anime({
    targets:  shimmer,
    left:     ['-60%', '150%'],
    duration: 1000,
    loop:     true,
    easing:   'linear',
  });
}

console.log('%c✨ Habbito Animations loaded', 'color:#FFD700;font-weight:bold;font-size:14px;');
