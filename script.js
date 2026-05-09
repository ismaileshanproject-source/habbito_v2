/* ============================================================
   HABBITO — script.js
   Full application JS:
   • State management
   • AJAX helpers
   • Anime.js timelines (loading, cards, celebrations, level-up)
   • Chart.js charts (pie, line, bar, weekly)
   • GitHub-style Heatmap
   • Particle background
   • Modal management
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────
// 1. APP STATE
// ─────────────────────────────────────────────
const State = {
  habits:          [],   // all active habits + today's status
  stats:           {},   // user XP / level
  currentView:     'dashboard',
  currentHabitId:  null, // for detail modal
  charts:          {},   // Chart.js instances keyed by canvas id
  today:           window.HABBITO.today,
  isAnimating:     false,
};

// ─────────────────────────────────────────────
// 2. AJAX HELPER
// ─────────────────────────────────────────────
async function ajax(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });
  try {
    const res = await fetch(window.HABBITO.ajaxUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    // Session expired or not logged in — go back to login
    if (res.status === 401) { window.location.href = 'login.php'; return null; }
    const data = await res.json();
    // Server asked us to redirect (e.g. session expired)
    if (data && data.redirect && !data.success) { window.location.href = data.redirect; return null; }
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return data;
  } catch (err) {
    console.error(`[Habbito] ajax(${action}) failed:`, err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// 3. LOADING SCREEN ANIMATION
// ─────────────────────────────────────────────
function runLoadingScreen() {
  const bar  = document.getElementById('loading-bar');
  const screen = document.getElementById('loading-screen');

  // Animate bar from 0 → 90 quickly, then wait for data, snap to 100
  return new Promise(resolve => {
    anime({
      targets:  bar,
      width:    ['0%', '90%'],
      duration: 900,
      easing:   'easeOutCubic',
      complete: resolve,
    });
  }).then(() => {
    // Data will call completeLoading()
  });
}

function completeLoading() {
  const bar    = document.getElementById('loading-bar');
  const screen = document.getElementById('loading-screen');

  anime({
    targets:  bar,
    width:    '100%',
    duration: 300,
    easing:   'easeOutCubic',
    complete: () => {
      screen.classList.add('fade-out');
      setTimeout(() => { screen.style.display = 'none'; }, 650);
    },
  });
}

// ─────────────────────────────────────────────
// 4. PARTICLE BACKGROUND
// ─────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx    = canvas.getContext('2d');

  let W = window.innerWidth, H = window.innerHeight;
  canvas.width  = W;
  canvas.height = H;

  const COLORS = ['rgba(255,215,0,', 'rgba(255,149,0,', 'rgba(74,222,128,', 'rgba(56,189,248,'];

  const particles = Array.from({ length: 70 }, () => ({
    x:     Math.random() * W,
    y:     Math.random() * H,
    r:     Math.random() * 1.5 + 0.4,
    vx:    (Math.random() - 0.5) * 0.3,
    vy:    (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.1,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
}

// ─────────────────────────────────────────────
// 5. XP BAR UPDATE (animated)
// ─────────────────────────────────────────────
function updateXPDisplay(stats, animate = true) {
  const { total_xp, level, level_xp_pct, level_xp_next } = stats;
  State.stats = stats;

  document.getElementById('xp-level-display').textContent = level;
  document.getElementById('xp-level-text').textContent    = level;
  document.getElementById('xp-value-text').textContent    = `${total_xp.toLocaleString()} XP`;

  // Show how much XP is needed to reach the next level
  const toNext = document.getElementById('xp-next-label');
  if (toNext && level_xp_next !== undefined) {
    const remaining = Math.max(0, level_xp_next - total_xp);
    toNext.textContent = remaining > 0
      ? `${remaining.toLocaleString()} XP to Level ${level + 1}`
      : `Level ${level} — Max reached!`;
  }

  const fill = document.getElementById('xp-bar-fill');
  if (animate) {
    anime({ targets: fill, width: `${level_xp_pct}%`, duration: 800, easing: 'easeOutCubic' });
  } else {
    fill.style.width = `${level_xp_pct}%`;
  }
}

// ─────────────────────────────────────────────
// 6. DASHBOARD — render habits
// ─────────────────────────────────────────────
function renderDashboard(data) {
  State.habits = data.habits;
  updateXPDisplay(data.stats);
  updateDailyProgress(data);

  const grid  = document.getElementById('habits-grid');
  const empty = document.getElementById('empty-state');

  // Clear skeletons
  grid.innerHTML = '';

  if (!data.habits.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  // Build cards
  data.habits.forEach(h => {
    grid.appendChild(buildHabitCard(h));
  });

  // ── Anime.js: Staggered entrance ──────────────────────────
  anime({
    targets:    '.habit-card',
    opacity:    [0, 1],
    translateY: [30, 0],
    scale:      [0.9, 1],
    duration:   500,
    delay:      anime.stagger(80, { start: 100 }),
    easing:     'easeOutBack',
  });
}

function buildHabitCard(h) {
  const card = document.createElement('article');
  card.className  = `habit-card${parseInt(h.completed) ? ' is-completed' : ''}`;
  card.dataset.id = h.id;
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', `${h.name}, ${parseInt(h.completed) ? 'completed' : 'not completed'}`);
  card.style.setProperty('--card-color', h.color);
  card.style.setProperty('--card-color-soft', h.color + '1A');
  card.style.setProperty('--card-glow', h.color + '40');

  // Progress: streak / 30 cap
  const streakPct = Math.min(100, (h.current_streak / 30) * 100);

  card.innerHTML = `
    <div class="card-top">
      <div class="card-emoji-wrap">${h.emoji}</div>
      <div class="card-check" role="checkbox" aria-checked="${parseInt(h.completed) ? 'true' : 'false'}">
        <span class="check-icon">✓</span>
      </div>
    </div>
    <p class="card-name">${escapeHTML(h.name)}</p>
    <p class="card-desc">${escapeHTML(h.description || 'No description')}</p>

    <div class="card-streak-row">
      <span class="card-streak-label">🔥 Streak</span>
      <span class="card-streak-val" data-streak="${h.current_streak}">${h.current_streak} days</span>
    </div>
    <div class="card-progress-track">
      <div class="card-progress-fill" style="width:${streakPct}%"></div>
    </div>

    <div class="card-footer">
      <span class="card-completions">✓ ${h.total_completions} total</span>
      <div style="display:flex;align-items:center;gap:8px">
        ${h.journal_note ? '<div class="card-journal-dot" title="Has journal entry"></div>' : ''}
        <button class="card-detail-btn" aria-label="View details for ${escapeHTML(h.name)}">Details →</button>
      </div>
    </div>
  `;

  // Toggle on card click (not detail btn)
  card.addEventListener('click', e => {
    if (e.target.classList.contains('card-detail-btn') || e.target.closest('.card-detail-btn')) {
      openHabitDetail(h.id);
      return;
    }
    toggleHabit(h.id, card);
  });

  // ── Anime.js: hover elastic effect ────────────────────────
  card.addEventListener('mouseenter', () => {
    if (!card.classList.contains('is-animating')) {
      anime({ targets: card, scale: 1.03, duration: 220, easing: 'easeOutElastic(1,0.7)' });
    }
  });
  card.addEventListener('mouseleave', () => {
    anime({ targets: card, scale: 1, duration: 280, easing: 'easeOutElastic(1,0.5)' });
  });

  return card;
}

// ─────────────────────────────────────────────
// 7. DAILY PROGRESS (arc + summary)
// ─────────────────────────────────────────────
function updateDailyProgress(data) {
  const done  = data.completed_today;
  const total = data.total_habits;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  // Count-up animation for summary
  anime({
    targets: { val: 0 },
    val: done,
    round: 1,
    easing: 'easeOutCubic',
    duration: 600,
    update(anim) {
      document.getElementById('summary-done').textContent = Math.round(anim.animations[0].currentValue);
    },
  });
  document.getElementById('summary-total').textContent = total;

  // Arc animation
  const arc     = document.getElementById('arc-fill');
  const arcLen  = 251; // approximate path length
  const offset  = arcLen * (1 - pct / 100);
  anime({
    targets:         { val: arcLen },
    val:             offset,
    easing:          'easeOutCubic',
    duration:        900,
    delay:           200,
    update(anim) {
      arc.style.strokeDashoffset = anim.animations[0].currentValue;
    },
  });

  // Percent label count-up
  anime({
    targets:  { val: 0 },
    val:      pct,
    round:    1,
    easing:   'easeOutCubic',
    duration: 900,
    delay:    200,
    update(anim) {
      document.getElementById('arc-pct').textContent = Math.round(anim.animations[0].currentValue) + '%';
    },
  });

  // Streak badge
  document.getElementById('daily-streak-num').textContent = data.stats?.daily_streak || 0;
}

// ─────────────────────────────────────────────
// 8. TOGGLE HABIT — Main celebration sequence
// ─────────────────────────────────────────────
async function toggleHabit(habitId, cardEl) {
  if (State.isAnimating) return;
  State.isAnimating = true;

  // Optimistic UI: card press
  anime({
    targets:  cardEl,
    scale:    [1, 0.92, 1.05, 1],
    duration: 400,
    easing:   'easeOutElastic(1, 0.5)',
  });

  try {
    const data = await ajax('toggle_habit', { habit_id: habitId, date: State.today });
    if (!data) { State.isAnimating = false; return; } // session expired, already redirecting

    // Update local habit state
    const habit = State.habits.find(h => h.id == habitId);
    if (habit) {
      habit.completed   = data.completed;
      habit.streak      = data.streak;
      if (data.completed) habit.xp_earned = data.xp_awarded;
    }

    if (data.completed) {
      // ── COMPLETION CELEBRATION TIMELINE ─────────────────────
      runCompletionTimeline(cardEl, habitId, data);
    } else {
      // Un-complete: simple update
      updateCardUI(cardEl, { completed: 0, streak: data.streak });
      updateXPDisplay(data.stats);
      refreshDashboardSummary();
    }

    // Level up check
    if (data.level_up) {
      setTimeout(() => runLevelUpCinematic(data.stats.level), 1200);
    }

  } catch (err) {
    // Revert optimistic
    anime({ targets: cardEl, scale: 1, duration: 200 });
    showError('Could not save progress. Please try again.');
  } finally {
    State.isAnimating = false;
  }
}

/**
 * ANIME.JS COMPLETION CELEBRATION TIMELINE
 * Phase 1: Card scale-up + check bounce
 * Phase 2: Floating XP label rises
 * Phase 3: Streak count-up
 * Phase 4: Confetti burst
 */
function runCompletionTimeline(cardEl, habitId, data) {
  const tl = anime.timeline({ easing: 'easeOutElastic(1, 0.6)' });

  const checkEl  = cardEl.querySelector('.card-check');
  const streakEl = cardEl.querySelector('.card-streak-val');
  const emojiEl  = cardEl.querySelector('.card-emoji-wrap');

  // Mark as completed
  updateCardUI(cardEl, { completed: 1, streak: data.streak });

  // Phase 1: Card & check entrance
  tl.add({
    targets:  cardEl,
    scale:    [1, 1.06, 1],
    duration: 500,
    easing:   'easeOutElastic(1, 0.4)',
  })
  .add({
    targets:  checkEl,
    scale:    [0, 1.4, 1],
    rotate:   [0, 12, 0],
    duration: 400,
    easing:   'easeOutElastic(1, 0.5)',
  }, '-=300')
  // Phase 2: Emoji bounce
  .add({
    targets:  emojiEl,
    scale:    [1, 1.3, 1],
    rotate:   [0, -8, 4, 0],
    duration: 500,
    easing:   'easeOutElastic(1, 0.4)',
  }, '-=200');

  // Phase 2: Floating XP
  spawnFloatingXP(cardEl, data.xp_awarded);

  // Phase 3: Streak count-up
  if (streakEl && data.streak > 0) {
    const prevStreak = data.streak - 1;
    tl.add({
      targets:  { val: prevStreak },
      val:      data.streak,
      round:    1,
      duration: 600,
      easing:   'easeOutCubic',
      update(anim) {
        streakEl.textContent = Math.round(anim.animations[0].currentValue) + ' days';
      },
    }, '+=50');
  }

  // Phase 4: Confetti burst (small, from card position)
  tl.add({
    targets:  cardEl,
    duration: 1,
    complete: () => {
      const rect = cardEl.getBoundingClientRect();
      confetti({
        particleCount: 45,
        spread:        60,
        startVelocity: 25,
        origin: {
          x: (rect.left + rect.width  / 2) / window.innerWidth,
          y: (rect.top  + rect.height / 2) / window.innerHeight,
        },
        colors: ['#FFD700', '#FF9500', '#4ADE80', '#fff'],
        scalar: 0.8,
      });
    },
  }, '+=100');

  // Update XP + summary after animation
  setTimeout(() => {
    updateXPDisplay(data.stats);
    refreshDashboardSummary();
  }, 400);
}

/**
 * Spawns a floating "+XP" label that floats upward and fades
 */
function spawnFloatingXP(anchorEl, xp) {
  const label = document.createElement('div');
  label.className   = 'floating-xp';
  label.textContent = `+${xp} XP`;

  const rect = anchorEl.getBoundingClientRect();
  label.style.left = `${rect.left + rect.width / 2 - 30}px`;
  label.style.top  = `${rect.top + 10}px`;
  document.body.appendChild(label);

  anime({
    targets:   label,
    translateY: [0, -80],
    opacity:   [1, 0],
    scale:     [0.8, 1.2, 1],
    duration:  1100,
    easing:    'easeOutCubic',
    complete:  () => label.remove(),
  });
}

function updateCardUI(cardEl, { completed, streak }) {
  if (parseInt(completed)) {
    cardEl.classList.add('is-completed');
  } else {
    cardEl.classList.remove('is-completed');
  }
  const check = cardEl.querySelector('.card-check');
  if (check) check.setAttribute('aria-checked', completed ? 'true' : 'false');
}

function refreshDashboardSummary() {
  // Re-tally from State
  const total = State.habits.length;
  const done  = State.habits.filter(h => h.completed).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('summary-done').textContent  = done;
  document.getElementById('summary-total').textContent = total;
  document.getElementById('arc-pct').textContent       = pct + '%';

  const arcLen = 251;
  const arc    = document.getElementById('arc-fill');
  arc.style.strokeDashoffset = arcLen * (1 - pct / 100);
}

// ─────────────────────────────────────────────
// 9. LEVEL UP CINEMATIC
// ─────────────────────────────────────────────
function runLevelUpCinematic(newLevel) {
  const overlay = document.getElementById('levelup-overlay');
  const numEl   = document.getElementById('levelup-number');

  numEl.textContent = newLevel;
  overlay.classList.remove('hidden');

  // ── Anime.js Level-Up Timeline ─────────────────────────────
  const tl = anime.timeline({ easing: 'easeOutExpo' });

  // Number pop-in
  tl.add({
    targets:    numEl,
    scale:      [0, 1.2, 1],
    opacity:    [0, 1],
    duration:   700,
    easing:     'easeOutElastic(1, 0.4)',
  })
  // Rays spin + fade in
  .add({
    targets:  '.levelup-rays',
    opacity:  [0, 1],
    duration: 400,
  }, '-=600')
  // Shake the number
  .add({
    targets:   numEl,
    translateX: [-8, 8, -6, 6, 0],
    duration:  300,
    easing:    'easeInOutSine',
  }, '+=200')
  // Hold…
  .add({ targets: overlay, duration: 1800 })
  // Fade out
  .add({
    targets:  overlay,
    opacity:  [1, 0],
    duration: 600,
    easing:   'easeInCubic',
    complete: () => {
      overlay.classList.add('hidden');
      overlay.style.opacity = '';
    },
  });

  // Big confetti burst
  setTimeout(() => {
    confetti({ particleCount: 120, spread: 80, startVelocity: 40, origin: { y: 0.5 }, colors: ['#FFD700','#FF9500','#fff','#4ADE80'] });
    confetti({ particleCount: 80, spread: 120, startVelocity: 30, origin: { x: 0, y: 0.6 }, angle: 60 });
    confetti({ particleCount: 80, spread: 120, startVelocity: 30, origin: { x: 1, y: 0.6 }, angle: 120 });
  }, 400);
}

// ─────────────────────────────────────────────
// 10. BADGE TOAST
// ─────────────────────────────────────────────
function showBadgeToast(badge) {
  const toast = document.getElementById('badge-toast');
  document.getElementById('badge-toast-emoji').textContent = badge.emoji;
  document.getElementById('badge-toast-name').textContent  = badge.name;
  document.getElementById('badge-toast-desc').textContent  = `+${badge.xp} XP — Badge Unlocked!`;

  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('show'), 50);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 500);
  }, 3500);
}

// ─────────────────────────────────────────────
// 11. ANALYTICS VIEW
// ─────────────────────────────────────────────
async function loadAnalytics() {
  const data = await ajax('get_stats');
  renderAnalyticsStats(data);
  renderPieChart(data.today_pie);
  renderLineChart(data.trend30);
  renderBarChart(data.ranking);
  renderWeeklyChart(data.weekly_rate);

  // Animate stat cards
  anime({
    targets:    '.stat-card',
    opacity:    [0, 1],
    translateY: [20, 0],
    duration:   400,
    delay:      anime.stagger(60),
    easing:     'easeOutCubic',
  });
}

function renderAnalyticsStats(data) {
  const s = data.stats;
  countUp('stat-total-xp', 0, s.total_xp, 800);
  countUp('stat-level',    0, s.level,    600);

  // Best streak across habits
  const best = data.streaks.reduce((m, h) => Math.max(m, h.longest_streak), 0);
  countUp('stat-streak', 0, best, 700);

  // 30-day completion rate
  const totalLogs = data.trend30.reduce((s, r) => s + parseInt(r.total_habits), 0);
  const doneLogs  = data.trend30.reduce((s, r) => s + parseInt(r.completed_count), 0);
  const rate      = totalLogs > 0 ? Math.round(doneLogs / totalLogs * 100) : 0;
  document.getElementById('stat-rate').textContent = rate + '%';
}

/** Chart defaults */
const CHART_DEFAULTS = {
  plugins: {
    legend:  { display: false },
    tooltip: {
      backgroundColor: '#1A1A1F',
      borderColor:     'rgba(255,255,255,0.1)',
      borderWidth:     1,
      titleColor:      '#F0F0F5',
      bodyColor:       '#8888A0',
      padding:         10,
      cornerRadius:    8,
    },
  },
  animation: { duration: 900, easing: 'easeOutCubic' },
};

function destroyChart(key) {
  if (State.charts[key]) {
    State.charts[key].destroy();
    delete State.charts[key];
  }
}

function renderPieChart(pie) {
  destroyChart('pie');
  const done   = parseInt(pie?.done   || 0);
  const missed = parseInt(pie?.missed || 0);

  State.charts['pie'] = new Chart(document.getElementById('chart-pie'), {
    type: 'doughnut',
    data: {
      labels:   ['Done', 'Remaining'],
      datasets: [{
        data:            [done, missed],
        backgroundColor: ['#4ADE80', '#24242C'],
        borderColor:     ['#4ADE80', '#1A1A1F'],
        borderWidth:     3,
        hoverOffset:     8,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      cutout:      '72%',
      responsive:  true,
      maintainAspectRatio: false,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: true, position: 'bottom', labels: { color: '#8888A0', font: { family: 'DM Mono', size: 11 } } },
      },
    },
  });
}

function renderLineChart(trend) {
  destroyChart('line');
  const labels   = trend.map(r => {
    const d = new Date(r.log_date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values   = trend.map(r => parseInt(r.completed_count));
  const totals   = trend.map(r => parseInt(r.total_habits));

  State.charts['line'] = new Chart(document.getElementById('chart-line'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label:           'Completed',
          data:            values,
          borderColor:     '#FFD700',
          backgroundColor: 'rgba(255,215,0,0.08)',
          borderWidth:     2.5,
          pointBackgroundColor: '#FFD700',
          pointRadius:     3,
          pointHoverRadius: 6,
          tension:         0.4,
          fill:            true,
        },
        {
          label:           'Total',
          data:            totals,
          borderColor:     '#333344',
          backgroundColor: 'transparent',
          borderWidth:     1.5,
          borderDash:      [4, 4],
          pointRadius:     0,
          tension:         0.4,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555566', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555566', font: { family: 'DM Mono', size: 10 } }, beginAtZero: true },
      },
    },
  });
}

function renderBarChart(ranking) {
  destroyChart('bar');
  const labels = ranking.map(r => `${r.emoji} ${r.name}`);
  const values = ranking.map(r => parseInt(r.total_done));
  const colors = ranking.map(r => r.color || '#FFD700');

  State.charts['bar'] = new Chart(document.getElementById('chart-bar'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           'Total Completions',
        data:            values,
        backgroundColor: colors.map(c => c + 'BB'),
        borderColor:     colors,
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false,
        hoverBackgroundColor: colors,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      responsive:          true,
      maintainAspectRatio: false,
      indexAxis:           'y',
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555566', font: { family: 'DM Mono', size: 10 } }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: '#8888A0', font: { family: 'Syne', size: 11 } } },
      },
    },
  });
}

function renderWeeklyChart(weekly) {
  destroyChart('weekly');
  const labels = weekly.map(r => {
    const d = new Date(r.week_start);
    return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  });
  const rates = weekly.map(r => parseFloat(r.rate));

  State.charts['weekly'] = new Chart(document.getElementById('chart-weekly'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           'Completion Rate %',
        data:            rates,
        backgroundColor: rates.map(r =>
          r >= 80 ? 'rgba(74,222,128,0.7)' :
          r >= 50 ? 'rgba(255,215,0,0.7)' :
                    'rgba(244,63,94,0.5)'
        ),
        borderColor:     rates.map(r =>
          r >= 80 ? '#4ADE80' :
          r >= 50 ? '#FFD700' :
                    '#F43F5E'
        ),
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555566', font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#555566', font: { family: 'DM Mono', size: 10 }, callback: v => v + '%' },
          max: 100,
          beginAtZero: true,
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// 12. HEATMAP (GitHub-style)
// ─────────────────────────────────────────────
async function loadHeatmap(habitId = 0) {
  const data = await ajax('get_heatmap', { habit_id: habitId });
  renderHeatmap(data.heatmap);
}

function renderHeatmap(cells) {
  const grid       = document.getElementById('heatmap-grid');
  const monthsBar  = document.getElementById('heatmap-months');
  const tooltip    = document.getElementById('hm-tooltip');
  grid.innerHTML      = '';
  monthsBar.innerHTML = '';

  // Group cells by ISO week (Sun-start for simplicity, but we do Mon-start)
  // Each column = 1 week
  const weeks     = [];
  let   currentWeek = [];
  const firstCell  = cells[0];
  const firstDate  = new Date(firstCell.log_date);

  // Pad first week with blanks if it doesn't start on Monday
  const firstDow = (firstDate.getDay() + 6) % 7; // Mon=0
  for (let i = 0; i < firstDow; i++) currentWeek.push(null);

  cells.forEach(cell => {
    const d   = new Date(cell.log_date);
    const dow = (d.getDay() + 6) % 7; // Mon=0

    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(cell);
  });
  if (currentWeek.length) weeks.push(currentWeek);

  // Month labels
  let lastMonth = -1;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthSpans = [];

  weeks.forEach((week, wi) => {
    const firstReal = week.find(c => c !== null);
    if (firstReal) {
      const month = new Date(firstReal.log_date).getMonth();
      if (month !== lastMonth) {
        monthSpans.push({ wi, month });
        lastMonth = month;
      }
    }
  });

  // Render month bar
  let prevWi = 0;
  monthSpans.forEach((ms, i) => {
    const span = document.createElement('span');
    span.textContent = monthNames[ms.month];
    const gapPx = (ms.wi - prevWi) * 16; // approx cell+gap
    span.style.marginLeft = i === 0 ? '0' : `${gapPx}px`;
    monthsBar.appendChild(span);
    prevWi = ms.wi;
  });

  // Render grid columns
  weeks.forEach(week => {
    const col = document.createElement('div');
    col.className = 'hm-week';

    for (let i = 0; i < 7; i++) {
      const cell = week[i];
      const div  = document.createElement('div');

      if (!cell) {
        div.className = 'hm-cell intensity-0';
        div.style.visibility = 'hidden';
      } else {
        const intensity = parseInt(cell.intensity) || 0;
        div.className   = `hm-cell intensity-${intensity}`;
        div.setAttribute('role', 'gridcell');
        div.setAttribute('tabindex', '0');
        div.setAttribute('aria-label',
          `${cell.log_date}: ${cell.completed_count} of ${cell.total_habits} completed`);

        // Tooltip
        div.addEventListener('mouseenter', e => {
          const d   = new Date(cell.log_date);
          const lbl = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          tooltip.textContent = `${lbl} — ${cell.completed_count}/${cell.total_habits} done`;
          tooltip.classList.remove('hidden');
        });
        div.addEventListener('mousemove', e => {
          tooltip.style.left = `${e.clientX + 12}px`;
          tooltip.style.top  = `${e.clientY - 30}px`;
        });
        div.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
      }

      col.appendChild(div);
    }

    grid.appendChild(col);
  });

  // ── Anime.js: Staggered heatmap reveal ───────────────────
  // Stagger all cells from left-to-right, top-to-bottom
  const allCells = grid.querySelectorAll('.hm-cell:not([style*="hidden"])');
  anime({
    targets:  allCells,
    opacity:  [0, 1],
    scale:    [0.3, 1],
    duration: 300,
    delay:    anime.stagger(8, { grid: [weeks.length, 7], from: 'first', axis: 'x' }),
    easing:   'easeOutBack',
    begin: () => {
      allCells.forEach(c => c.classList.add('revealed'));
    },
  });
}

// ─────────────────────────────────────────────
// 13. QUESTS VIEW
// ─────────────────────────────────────────────
async function loadQuests() {
  const data = await ajax('get_quests');
  const grid = document.getElementById('quests-grid');
  grid.innerHTML = '';

  data.quests.forEach(q => {
    const pct = q.target_value > 0
      ? Math.min(100, Math.round(q.current_value / q.target_value * 100))
      : 0;

    const card = document.createElement('div');
    card.className    = `quest-card${q.completed ? ' quest-done' : ''}`;
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <span class="quest-emoji">${q.quest_emoji}</span>
      <p class="quest-name">${escapeHTML(q.quest_name)}</p>
      <p class="quest-desc">${escapeHTML(q.quest_desc)}</p>
      <div class="quest-progress-track">
        <div class="quest-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="quest-progress-text">
        <span>${q.current_value} / ${q.target_value}</span>
        <span>${pct}%</span>
      </div>
      <span class="quest-xp">+${q.xp_reward} XP</span>
    `;
    grid.appendChild(card);
  });

  // Animate quest cards in
  anime({
    targets:    '.quest-card',
    opacity:    [0, 1],
    translateX: [-30, 0],
    duration:   400,
    delay:      anime.stagger(80),
    easing:     'easeOutCubic',
  });
}

// ─────────────────────────────────────────────
// 14. ACHIEVEMENTS VIEW
// ─────────────────────────────────────────────
const ALL_POSSIBLE_BADGES = [
  { key: 'first_habit', name: 'First Step',    desc: 'Complete your first habit', emoji: '🌱', xp: 25 },
  { key: 'streak_7',    name: 'Week Warrior',  desc: 'Achieve a 7-day streak',    emoji: '🔥', xp: 100 },
  { key: 'streak_30',   name: 'Month Master',  desc: 'Achieve a 30-day streak',   emoji: '🏆', xp: 300 },
  { key: 'perfect_day', name: 'Perfect Day',   desc: 'Complete ALL habits in 1 day', emoji: '⚡', xp: 150 },
  { key: 'journal_5',   name: 'Wordsmith',     desc: 'Write 5 journal entries',   emoji: '✍️', xp: 75 },
  { key: 'level_5',     name: 'Apprentice',    desc: 'Reach Level 5',             emoji: '⭐', xp: 50 },
  { key: 'level_10',    name: 'Journeyman',    desc: 'Reach Level 10',            emoji: '🌟', xp: 100 },
  { key: 'level_25',    name: 'Expert',        desc: 'Reach Level 25',            emoji: '💫', xp: 250 },
  { key: 'level_50',    name: 'Master',        desc: 'Reach Level 50',            emoji: '👑', xp: 500 },
];

async function loadAchievements() {
  const data    = await ajax('get_achievements');
  const unlockedKeys = new Set(data.badges.map(b => b.badge_key));

  // Unlocked
  const grid = document.getElementById('badges-grid');
  grid.innerHTML = '';

  if (!data.badges.length) {
    grid.innerHTML = '<p class="badges-empty">No badges yet — complete habits to earn them! 🌱</p>';
  } else {
    data.badges.forEach(b => {
      const card = document.createElement('div');
      card.className = 'badge-card';
      card.setAttribute('role', 'listitem');
      const date = new Date(b.unlocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      card.innerHTML = `
        <span class="badge-emoji-big">${b.badge_emoji}</span>
        <p class="badge-name">${escapeHTML(b.badge_name)}</p>
        <p class="badge-desc">${escapeHTML(b.badge_desc)}</p>
        <span class="badge-xp">+${b.xp_reward} XP</span>
        <p class="badge-date">${date}</p>
      `;
      grid.appendChild(card);
    });
  }

  // Locked (not yet earned)
  const lockedGrid = document.getElementById('locked-badges-grid');
  lockedGrid.innerHTML = '';
  ALL_POSSIBLE_BADGES
    .filter(b => !unlockedKeys.has(b.key))
    .forEach(b => {
      const card = document.createElement('div');
      card.className = 'badge-card';
      card.setAttribute('aria-label', `Locked: ${b.name}`);
      card.innerHTML = `
        <span class="badge-emoji-big">🔒</span>
        <p class="badge-name">${escapeHTML(b.name)}</p>
        <p class="badge-desc">${escapeHTML(b.desc)}</p>
        <span class="badge-xp">+${b.xp} XP</span>
      `;
      lockedGrid.appendChild(card);
    });

  // Animate
  anime({
    targets:    '.badge-card',
    opacity:    [0, 1],
    scale:      [0.8, 1],
    duration:   500,
    delay:      anime.stagger(70, { start: 100 }),
    easing:     'easeOutBack',
  });
}

// ─────────────────────────────────────────────
// 15. HABIT DETAIL MODAL
// ─────────────────────────────────────────────
async function openHabitDetail(habitId) {
  State.currentHabitId = habitId;
  const modal = document.getElementById('modal-habit-detail');
  modal.classList.remove('hidden');

  const data = await ajax('get_habit_history', { habit_id: habitId });
  const { habit, history, streak } = data;

  document.getElementById('detail-emoji').textContent    = habit.emoji;
  document.getElementById('detail-modal-title').textContent = habit.name;
  document.getElementById('detail-desc').textContent    = habit.description || '';
  document.getElementById('detail-streak-num').textContent  = streak;

  // Load today's journal if exists
  const todayLog = history.find(h => h.log_date === State.today);
  const journalTA = document.getElementById('journal-textarea');
  journalTA.value = todayLog?.journal_note || '';
  document.getElementById('journal-char-count').textContent = journalTA.value.length;

  // History mini chart
  renderHabitHistoryChart(history, habit.color);

  // Recent logs list
  renderRecentLogs(history);
}

function renderHabitHistoryChart(history, color) {
  destroyChart('habit-history');
  const last14 = history.slice(-14);
  const labels = last14.map(h => {
    const d = new Date(h.log_date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values = last14.map(h => parseInt(h.completed));

  State.charts['habit-history'] = new Chart(
    document.getElementById('chart-habit-history'),
    {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label:           'Completed',
          data:            values,
          backgroundColor: values.map(v => v ? (color + 'BB') : 'rgba(255,255,255,0.06)'),
          borderColor:     values.map(v => v ? color : 'rgba(255,255,255,0.1)'),
          borderWidth:     1.5,
          borderRadius:    4,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#555566', font: { size: 9 } } },
          y: { display: false, max: 1, beginAtZero: true },
        },
      },
    }
  );
}

function renderRecentLogs(history) {
  const list = document.getElementById('logs-list');
  list.innerHTML = '';

  const recent = [...history].reverse().slice(0, 12);
  recent.forEach(h => {
    const item = document.createElement('div');
    item.className = 'log-item';
    const d = new Date(h.log_date);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    item.innerHTML = `
      <div class="log-dot ${h.completed ? 'done' : 'missed'}"></div>
      <span class="log-date">${dateStr}</span>
      ${h.journal_note ? `<span class="log-note">${escapeHTML(h.journal_note.substring(0, 50))}${h.journal_note.length > 50 ? '…' : ''}</span>` : ''}
    `;
    list.appendChild(item);
  });
}

function closeHabitDetail() {
  document.getElementById('modal-habit-detail').classList.add('hidden');
  destroyChart('habit-history');
  State.currentHabitId = null;
}

// Save journal
async function saveJournal() {
  const note = document.getElementById('journal-textarea').value;
  if (!State.currentHabitId) return;

  const btn = document.getElementById('save-journal-btn');
  btn.disabled = true;

  try {
    const data = await ajax('save_journal', {
      habit_id: State.currentHabitId,
      date:     State.today,
      note,
    });
    if (!data) return;
    updateXPDisplay(data.stats);

    // Animate the save button
    anime({
      targets:   btn,
      scale:     [1, 1.15, 1],
      duration:  400,
      easing:    'easeOutElastic(1,0.5)',
      complete:  () => { btn.textContent = '✓ Saved!'; },
    });
    setTimeout(() => { btn.textContent = 'Save +15 XP'; btn.disabled = false; }, 1800);

    if (data.level_up) {
      setTimeout(() => runLevelUpCinematic(data.stats.level), 600);
    }
  } catch (err) {
    showError('Could not save journal entry.');
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// 16. ADD HABIT MODAL
// ─────────────────────────────────────────────
const EMOJI_OPTIONS = ['⭐','🧘','💪','📚','💧','📓','🚫','🌅','🏃','🎯','🍎','😴','🧠','🎨','🎵','💊','🌿','✍️','💻','🏋️'];

function initAddHabitModal() {
  const picker = document.getElementById('emoji-picker');
  EMOJI_OPTIONS.forEach((e, i) => {
    const btn = document.createElement('button');
    btn.className     = `emoji-option${i === 0 ? ' selected' : ''}`;
    btn.textContent   = e;
    btn.dataset.emoji = e;
    btn.setAttribute('aria-label', `Select emoji ${e}`);
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      anime({ targets: btn, scale: [1, 1.4, 1], duration: 300, easing: 'easeOutElastic(1,0.5)' });
    });
    picker.appendChild(btn);
  });

  // Color presets
  document.querySelectorAll('.color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('habit-color-input').value = btn.dataset.color;
    });
  });

  // Open modal
  document.getElementById('open-add-modal').addEventListener('click',   () => openAddModal());
  document.getElementById('mobile-add-btn').addEventListener('click',  () => openAddModal());
  document.getElementById('empty-add-btn')?.addEventListener('click',  () => openAddModal());

  // Close modal
  document.getElementById('close-add-modal').addEventListener('click',  closeAddModal);
  document.getElementById('cancel-add-modal').addEventListener('click', closeAddModal);
  document.getElementById('modal-add-habit').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddModal();
  });

  // Submit
  document.getElementById('submit-add-habit').addEventListener('click', submitAddHabit);
  document.getElementById('habit-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAddHabit();
  });
}

function openAddModal() {
  const modal = document.getElementById('modal-add-habit');
  modal.classList.remove('hidden');
  document.getElementById('habit-name-input').focus();
  // Reset form
  document.getElementById('habit-name-input').value = '';
  document.getElementById('habit-desc-input').value = '';
}

function closeAddModal() {
  document.getElementById('modal-add-habit').classList.add('hidden');
}

async function submitAddHabit() {
  const name  = document.getElementById('habit-name-input').value.trim();
  if (!name) {
    anime({
      targets:    '#habit-name-input',
      translateX: [-6, 6, -4, 4, 0],
      duration:   300,
      easing:     'easeInOutSine',
    });
    return;
  }

  const emoji = document.querySelector('.emoji-option.selected')?.dataset.emoji || '⭐';
  const color = document.getElementById('habit-color-input').value;
  const desc  = document.getElementById('habit-desc-input').value.trim();

  const btn = document.getElementById('submit-add-habit');
  btn.disabled = true;
  btn.querySelector('.btn-spinner').classList.remove('hidden');

  try {
    const addRes = await ajax('add_habit', { name, emoji, color, description: desc });
    if (!addRes) return;
    closeAddModal();
    const data = await ajax('get_dashboard');
    if (!data) return;
    renderDashboard(data);
  } catch (err) {
    showError('Could not add habit. Try again.');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-spinner').classList.add('hidden');
  }
}

// ─────────────────────────────────────────────
// 17. DELETE HABIT
// ─────────────────────────────────────────────
document.getElementById('delete-habit-btn').addEventListener('click', async () => {
  if (!State.currentHabitId) return;
  if (!confirm('Delete this habit? Your logs will be kept but the habit will be hidden.')) return;

  try {
    await ajax('delete_habit', { habit_id: State.currentHabitId });
    closeHabitDetail();
    const data = await ajax('get_dashboard');
    renderDashboard(data);
  } catch (err) {
    showError('Could not delete habit.');
  }
});

// ─────────────────────────────────────────────
// 18. NAVIGATION
// ─────────────────────────────────────────────
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewName);
    b.setAttribute('aria-current', b.dataset.view === viewName ? 'page' : 'false');
  });

  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add('active');
  State.currentView = viewName;

  // Load view data
  switch (viewName) {
    case 'analytics':     loadAnalytics(); break;
    case 'heatmap':       loadHeatmap(0);  break;
    case 'quests':        loadQuests();    break;
    case 'achievements':  loadAchievements(); break;
    case 'profile':       loadProfile(); break;
  }

  // Close mobile sidebar
  closeMobileSidebar();
}

// Mobile sidebar
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('hamburger-btn').classList.add('open');
  document.getElementById('hamburger-btn').setAttribute('aria-expanded', 'true');
  getOrCreateSidebarOverlay().classList.add('active');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hamburger-btn').classList.remove('open');
  document.getElementById('hamburger-btn').setAttribute('aria-expanded', 'false');
  getOrCreateSidebarOverlay().classList.remove('active');
}
function getOrCreateSidebarOverlay() {
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeMobileSidebar);
    document.body.appendChild(overlay);
  }
  return overlay;
}

// ─────────────────────────────────────────────
// 19. HEATMAP FILTER
// ─────────────────────────────────────────────
async function populateHeatmapFilter() {
  const sel = document.getElementById('hm-habit-filter');
  // Populate from State.habits (loaded on dashboard)
  State.habits.forEach(h => {
    const opt = document.createElement('option');
    opt.value       = h.id;
    opt.textContent = `${h.emoji} ${h.name}`;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => loadHeatmap(parseInt(sel.value)));
}

// ─────────────────────────────────────────────
// 20. UTILITY FUNCTIONS
// ─────────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countUp(elId, from, to, duration) {
  anime({
    targets:  { val: from },
    val:      to,
    round:    1,
    easing:   'easeOutCubic',
    duration,
    update(anim) {
      const el = document.getElementById(elId);
      if (el) el.textContent = Math.round(anim.animations[0].currentValue).toLocaleString();
    },
  });
}

function showError(msg) {
  // Simple error toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:20px; left:50%; transform:translateX(-50%) translateY(60px);
    background:#F43F5E; color:#fff; padding:12px 24px; border-radius:8px;
    font-family:Syne,sans-serif; font-size:0.875rem; z-index:9999;
    transition:transform 0.3s ease; box-shadow:0 4px 20px rgba(0,0,0,0.4);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; }, 50);
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(60px)';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─────────────────────────────────────────────
// 21. KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // ESC closes modals
  if (e.key === 'Escape') {
    closeAddModal();
    closeHabitDetail();
  }
  // Shortcut keys (when no input focused)
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  if (e.key === 'n' || e.key === 'N') openAddModal();
  if (e.key === '1') switchView('dashboard');
  if (e.key === '2') switchView('analytics');
  if (e.key === '3') switchView('heatmap');
  if (e.key === '4') switchView('quests');
  if (e.key === '5') switchView('achievements');
});

// ─────────────────────────────────────────────
// 22. EVENT LISTENERS SETUP
// ─────────────────────────────────────────────
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Mobile hamburger
  document.getElementById('hamburger-btn').addEventListener('click', () => {
    const isOpen = document.getElementById('sidebar').classList.contains('open');
    isOpen ? closeMobileSidebar() : openMobileSidebar();
  });

  // Detail modal close
  document.getElementById('close-detail-modal').addEventListener('click', closeHabitDetail);
  document.getElementById('modal-habit-detail').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHabitDetail();
  });

  // Journal textarea char count
  document.getElementById('journal-textarea').addEventListener('input', e => {
    document.getElementById('journal-char-count').textContent = e.target.value.length;
  });

  // Save journal
  document.getElementById('save-journal-btn').addEventListener('click', saveJournal);

  // Emoji bounce on load (subtle ambient)
  setInterval(() => {
    const emojis = document.querySelectorAll('.card-emoji-wrap');
    if (!emojis.length) return;
    const random = emojis[Math.floor(Math.random() * emojis.length)];
    anime({
      targets:   random,
      translateY: [0, -5, 0],
      rotate:    [0, 5, -3, 0],
      duration:  500,
      easing:    'easeOutElastic(1, 0.5)',
    });
  }, 2500);
}

// ─────────────────────────────────────────────
// 23. BOOT SEQUENCE
// ─────────────────────────────────────────────
async function boot() {
  // Start loading animation
  runLoadingScreen();
  initParticles();

  // Setup all UI interactions
  setupEventListeners();
  initAddHabitModal();

  // Fetch dashboard data
  try {
    const data = await ajax('get_dashboard');
    renderDashboard(data);
    populateHeatmapFilter();

    // Trigger periodic badge check
    ajax('check_badges').catch(() => {});
  } catch (err) {
    showError('Failed to load dashboard. Check your server configuration.');
  } finally {
    completeLoading();
  }

  // ── Welcome animation: floating particles burst on first load ──
  setTimeout(() => {
    anime({
      targets:    '.sidebar-logo',
      translateX: [-20, 0],
      opacity:    [0, 1],
      duration:   600,
      easing:     'easeOutBack',
    });
    anime({
      targets:    '.nav-btn',
      translateX: [-16, 0],
      opacity:    [0, 1],
      duration:   400,
      delay:      anime.stagger(60, { start: 200 }),
      easing:     'easeOutCubic',
    });
    anime({
      targets:    '.sidebar-xp',
      translateY: [10, 0],
      opacity:    [0, 1],
      duration:   400,
      delay:      600,
      easing:     'easeOutCubic',
    });
  }, 700);
}


// ─────────────────────────────────────────────
// PROFILE VIEW
// ─────────────────────────────────────────────
const LEVEL_TITLES = [
  { min:  1, max:  4,  label: '🌱 Newcomer',   cls: 'title-newcomer'   },
  { min:  5, max:  9,  label: '⚡ Beginner',    cls: 'title-beginner'   },
  { min: 10, max: 14,  label: '🔥 Apprentice',  cls: 'title-apprentice' },
  { min: 15, max: 24,  label: '⚔️ Journeyman',  cls: 'title-journeyman' },
  { min: 25, max: 49,  label: '💎 Expert',      cls: 'title-expert'     },
  { min: 50, max: 99,  label: '👑 Master',      cls: 'title-master'     },
  { min: 100, max: Infinity, label: '🌟 Legend', cls: 'title-legend'   },
];

function getLevelTitle(level) {
  return LEVEL_TITLES.find(t => level >= t.min && level <= t.max) || LEVEL_TITLES[0];
}

async function loadProfile() {
  const data = await ajax('get_profile');
  if (!data) return;
  renderProfile(data);
}

function renderProfile(data) {
  const { user, level, total_xp, xp_in_level, xp_for_level, xp_to_next,
          level_xp_next, level_xp_pct, total_done, active_habits, days_active,
          best_streak, cur_streak, badges_count, rate_30d, journal_count,
          weekly_xp, recent_badges, milestones } = data;

  // ── Hero ──────────────────────────────────────────────────
  const avatar = document.getElementById('profile-avatar-circle');
  if (avatar) avatar.textContent = user.avatar_emoji || '🧑';

  const lvlBadge = document.getElementById('profile-lvl-badge');
  if (lvlBadge) lvlBadge.textContent = level;

  const nameEl = document.getElementById('profile-hero-name');
  if (nameEl) nameEl.textContent = user.username || '';

  const sinceEl = document.getElementById('profile-hero-since');
  if (sinceEl && user.created_at) {
    const d = new Date(user.created_at);
    sinceEl.textContent = 'Member since ' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const titleEl  = document.getElementById('profile-title-text');
  const titleBadge = document.getElementById('profile-title-badge');
  if (titleEl) {
    const t = getLevelTitle(level);
    titleEl.textContent = t.label;
    if (titleBadge) {
      titleBadge.className = 'profile-title-badge ' + t.cls;
    }
  }

  // ── XP Section ─────────────────────────────────────────────
  const lvlNum = document.getElementById('pxp-level-num');
  if (lvlNum) lvlNum.textContent = level;

  const xpCur = document.getElementById('pxp-cur');
  const xpNxt = document.getElementById('pxp-nxt');
  if (xpCur) countUpEl(xpCur, 0, xp_in_level, 900);
  if (xpNxt) xpNxt.textContent = xp_for_level.toLocaleString();

  const xpFill = document.getElementById('pxp-bar-fill');
  if (xpFill) {
    setTimeout(() => {
      anime({ targets: xpFill, width: level_xp_pct + '%', duration: 1000, easing: 'easeOutCubic' });
    }, 200);
  }

  const toNextEl = document.getElementById('pxp-to-next');
  if (toNextEl) toNextEl.textContent = `${xp_to_next.toLocaleString()} XP to Level ${level + 1}`;

  const totalEl = document.getElementById('pxp-total');
  if (totalEl) totalEl.textContent = `Total: ${total_xp.toLocaleString()} XP`;

  // ── Level Road ─────────────────────────────────────────────
  const road = document.getElementById('level-road');
  if (road && milestones) {
    road.innerHTML = '';
    milestones.forEach((m, i) => {
      if (i > 0) {
        const line = document.createElement('div');
        line.className = 'lm-line' + (m.done || m.current ? ' done' : '');
        road.appendChild(line);
      }
      const node = document.createElement('div');
      node.className = 'lm-node';
      const dot = document.createElement('div');
      dot.className = 'lm-dot' + (m.done ? ' done' : '') + (m.current ? ' current' : '');
      dot.textContent = m.level;
      const xpLabel = document.createElement('div');
      xpLabel.className = 'lm-xp';
      xpLabel.textContent = m.xp_needed >= 1000
        ? (m.xp_needed / 1000).toFixed(1) + 'k'
        : m.xp_needed + '';
      node.appendChild(dot);
      node.appendChild(xpLabel);
      road.appendChild(node);
    });
    // Scroll to current level
    const cur = road.querySelector('.lm-dot.current');
    if (cur) cur.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  }

  // ── Stats ──────────────────────────────────────────────────
  const stats = [
    ['ps-done',       total_done,    700],
    ['ps-active',     active_habits, 600],
    ['ps-days',       days_active,   800],
    ['ps-cur-streak', cur_streak,    650],
    ['ps-best-streak',best_streak,   750],
    ['ps-badges',     badges_count,  600],
    ['ps-journal',    journal_count, 700],
  ];
  stats.forEach(([id, val, dur]) => countUp(id, 0, val, dur));
  const rateEl = document.getElementById('ps-rate');
  if (rateEl) rateEl.textContent = rate_30d + '%';

  // Animate stat cards
  anime({
    targets: '.pstat',
    opacity: [0, 1], translateY: [20, 0],
    duration: 400,
    delay: anime.stagger(50),
    easing: 'easeOutCubic',
  });

  // ── Weekly XP chart ────────────────────────────────────────
  destroyChart('xp-weekly');
  if (weekly_xp && weekly_xp.length) {
    const labels = weekly_xp.map(w => {
      const d = new Date(w.week_start);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = weekly_xp.map(w => parseInt(w.xp_earned) || 0);
    const maxVal = Math.max(...values, 1);

    State.charts['xp-weekly'] = new Chart(document.getElementById('chart-xp-weekly'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'XP Earned',
          data: values,
          backgroundColor: values.map(v =>
            `rgba(255,215,0,${0.3 + (v / maxVal) * 0.7})`
          ),
          borderColor: '#FFD700',
          borderWidth: 2,
          borderRadius: 6,
          hoverBackgroundColor: '#FFD700',
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555566', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#555566', font: { family: 'DM Mono', size: 10 } }, beginAtZero: true },
        },
      },
    });
  }

  // ── Recent badges ──────────────────────────────────────────
  const badgeRow = document.getElementById('profile-badges-row');
  if (badgeRow) {
    badgeRow.innerHTML = '';
    if (!recent_badges || !recent_badges.length) {
      badgeRow.innerHTML = '<p class="profile-no-badges">No badges yet — keep going! 🌱</p>';
    } else {
      recent_badges.forEach(b => {
        const chip = document.createElement('div');
        chip.className = 'profile-badge-chip';
        const unlockedDate = new Date(b.unlocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        chip.innerHTML = `
          <span class="pbc-emoji">${b.badge_emoji}</span>
          <div class="pbc-info">
            <strong>${escapeHTML(b.badge_name)}</strong>
            <span>${unlockedDate} · +${b.xp_reward} XP</span>
          </div>`;
        badgeRow.appendChild(chip);
      });
    }
  }

  // Entrance animation
  anime({
    targets: '.profile-hero-card, .profile-xp-card, .profile-chart-card, .profile-badges-card',
    opacity: [0, 1], translateY: [24, 0],
    duration: 450,
    delay: anime.stagger(80),
    easing: 'easeOutCubic',
  });
}

// countUp helper for element (not just by ID)
function countUpEl(el, from, to, duration) {
  anime({
    targets: { val: from }, val: to, round: 1,
    easing: 'easeOutCubic', duration,
    update(anim) {
      el.textContent = Math.round(anim.animations[0].currentValue).toLocaleString();
    },
  });
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
