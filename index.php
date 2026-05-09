<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
startSession();
requireLogin();   // redirects to login.php if not logged in
$user      = currentUser();
$csrf      = getCsrfToken();
$today     = date('Y-m-d');
$dayName   = date('l');
$dateStr   = date('F j, Y');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Habbito — <?= htmlspecialchars($user['username']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>
<link rel="stylesheet" href="style.css"/>
</head>
<body>
<canvas id="particle-canvas" aria-hidden="true"></canvas>

<!-- Loading screen -->
<div id="loading-screen">
  <div class="loading-inner">
    <div class="loading-logo">
      <span class="logo-icon">H</span>
      <div class="loading-rings">
        <div class="ring ring-1"></div><div class="ring ring-2"></div><div class="ring ring-3"></div>
      </div>
    </div>
    <p class="loading-text">Loading your world…</p>
    <div class="loading-bar-wrap"><div class="loading-bar" id="loading-bar"></div></div>
  </div>
</div>

<!-- Level-up overlay -->
<div id="levelup-overlay" class="levelup-overlay hidden">
  <div class="levelup-inner">
    <div class="levelup-rays"></div>
    <div class="levelup-badge">
      <span class="levelup-label">LEVEL UP!</span>
      <span class="levelup-number" id="levelup-number">2</span>
      <span class="levelup-sub">You're unstoppable</span>
    </div>
  </div>
</div>

<!-- Badge toast -->
<div id="badge-toast" class="badge-toast hidden">
  <span id="badge-toast-emoji" class="badge-toast-emoji">🏅</span>
  <div class="badge-toast-text">
    <strong id="badge-toast-name">Badge Unlocked!</strong>
    <span id="badge-toast-desc"></span>
  </div>
</div>

<!-- SIDEBAR -->
<nav id="sidebar" class="sidebar">
  <div class="sidebar-logo">
    <span class="logo-h">H</span><span class="logo-text">abbito</span>
  </div>

  <ul class="sidebar-nav">
    <li><button class="nav-btn active" data-view="dashboard"><span class="nav-icon">⚡</span><span class="nav-label">Dashboard</span></button></li>
    <li><button class="nav-btn" data-view="analytics"><span class="nav-icon">📊</span><span class="nav-label">Analytics</span></button></li>
    <li><button class="nav-btn" data-view="heatmap"><span class="nav-icon">🔥</span><span class="nav-label">Heatmap</span></button></li>
    <li><button class="nav-btn" data-view="quests"><span class="nav-icon">🎯</span><span class="nav-label">Quests</span></button></li>
    <li><button class="nav-btn" data-view="achievements"><span class="nav-icon">🏆</span><span class="nav-label">Badges</span></button></li>
    <li><button class="nav-btn" data-view="profile"><span class="nav-icon">👤</span><span class="nav-label">Profile</span></button></li>
  </ul>

  <!-- XP bar -->
  <div class="sidebar-xp" id="sidebar-xp">
    <div class="xp-avatar" id="xp-level-display">1</div>
    <div class="xp-info">
      <div class="xp-label-row">
        <span class="xp-label">Level <span id="xp-level-text">1</span></span>
        <span class="xp-value" id="xp-value-text">0 XP</span>
      </div>
      <div class="xp-bar-track"><div class="xp-bar-fill" id="xp-bar-fill" style="width:0%"></div></div>
      <div class="xp-next-label" id="xp-next-label">0 XP to next level</div>
    </div>
  </div>

  <!-- User row + logout -->
  <div class="sidebar-user-row">
    <div class="sidebar-user-info">
      <span class="sidebar-avatar"><?= htmlspecialchars($user['avatar']) ?></span>
      <span class="sidebar-username"><?= htmlspecialchars($user['username']) ?></span>
    </div>
    <a href="logout.php" class="logout-btn" title="Sign out">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </a>
  </div>

  <button class="add-habit-fab" id="open-add-modal">
    <span class="fab-icon">+</span><span class="fab-label">New Habit</span>
  </button>
</nav>

<!-- Mobile header -->
<header class="mobile-header">
  <button class="hamburger" id="hamburger-btn" aria-expanded="false"><span></span><span></span><span></span></button>
  <div class="mobile-logo"><span class="logo-h">H</span><span class="logo-text">abbito</span></div>
  <button class="mobile-add-btn" id="mobile-add-btn">+</button>
</header>

<!-- MAIN CONTENT -->
<main id="main-content" class="main-content">

  <!-- DASHBOARD -->
  <section id="view-dashboard" class="view active">
    <header class="page-header">
      <div class="header-left">
        <p class="header-day"><?= htmlspecialchars($dayName) ?></p>
        <h1 class="header-date"><?= htmlspecialchars($dateStr) ?></h1>
      </div>
      <div class="header-right">
        <div class="today-summary">
          <span class="summary-done" id="summary-done">0</span>
          <span class="summary-sep">/</span>
          <span class="summary-total" id="summary-total">0</span>
          <span class="summary-label">done</span>
        </div>
        <div class="daily-streak-badge">
          <span class="streak-fire">🔥</span>
          <span class="streak-num" id="daily-streak-num">0</span>
        </div>
      </div>
    </header>

    <div class="progress-arc-wrap">
      <svg class="progress-arc" viewBox="0 0 200 120">
        <path class="arc-bg"   d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke-width="14"/>
        <path class="arc-fill" id="arc-fill" d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke-width="14" stroke-dasharray="251" stroke-dashoffset="251"/>
      </svg>
      <div class="arc-label">
        <span class="arc-pct" id="arc-pct">0%</span>
        <span class="arc-sub">today</span>
      </div>
    </div>

    <div class="habits-grid" id="habits-grid" role="list">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>

    <div class="empty-state hidden" id="empty-state">
      <div class="empty-icon">🌱</div>
      <h2>Start your journey</h2>
      <p>Add your first habit and begin levelling up today.</p>
      <button class="btn-primary" id="empty-add-btn">Add Habit</button>
    </div>
  </section>

  <!-- ANALYTICS -->
  <section id="view-analytics" class="view">
    <header class="page-header">
      <h1 class="page-title">Analytics Hub</h1>
      <p class="page-subtitle">Deep insights into your progress</p>
    </header>
    <div class="stats-row">
      <div class="stat-card"><span class="stat-icon">⚡</span><span class="stat-val" id="stat-total-xp">—</span><span class="stat-lbl">Total XP</span></div>
      <div class="stat-card"><span class="stat-icon">🎖️</span><span class="stat-val" id="stat-level">—</span><span class="stat-lbl">Level</span></div>
      <div class="stat-card"><span class="stat-icon">🔥</span><span class="stat-val" id="stat-streak">—</span><span class="stat-lbl">Best Streak</span></div>
      <div class="stat-card"><span class="stat-icon">✅</span><span class="stat-val" id="stat-rate">—</span><span class="stat-lbl">30-day Rate</span></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card chart-card--sm"><h3 class="chart-title">Today's Progress</h3><div class="chart-wrap"><canvas id="chart-pie"></canvas></div></div>
      <div class="chart-card chart-card--lg"><h3 class="chart-title">30-Day Trend</h3><div class="chart-wrap"><canvas id="chart-line"></canvas></div></div>
      <div class="chart-card chart-card--full"><h3 class="chart-title">Habit Champions</h3><div class="chart-wrap chart-wrap--tall"><canvas id="chart-bar"></canvas></div></div>
      <div class="chart-card chart-card--full"><h3 class="chart-title">Weekly Completion Rate</h3><div class="chart-wrap"><canvas id="chart-weekly"></canvas></div></div>
    </div>
  </section>

  <!-- HEATMAP -->
  <section id="view-heatmap" class="view">
    <header class="page-header">
      <h1 class="page-title">Activity Heatmap</h1>
      <p class="page-subtitle">Your last 6 months at a glance</p>
    </header>
    <div class="heatmap-controls">
      <label class="hm-filter-label" for="hm-habit-filter">Filter by habit:</label>
      <select class="hm-select" id="hm-habit-filter"><option value="0">All Habits</option></select>
    </div>
    <div class="heatmap-legend">
      <span class="legend-label">Less</span>
      <div class="legend-squares">
        <div class="hm-cell intensity-0"></div><div class="hm-cell intensity-1"></div>
        <div class="hm-cell intensity-2"></div><div class="hm-cell intensity-3"></div><div class="hm-cell intensity-4"></div>
      </div>
      <span class="legend-label">More</span>
    </div>
    <div class="heatmap-months" id="heatmap-months"></div>
    <div class="heatmap-outer">
      <div class="heatmap-days-label"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
      <div class="heatmap-grid" id="heatmap-grid"></div>
    </div>
    <div class="hm-tooltip hidden" id="hm-tooltip"></div>
  </section>

  <!-- QUESTS -->
  <section id="view-quests" class="view">
    <header class="page-header">
      <h1 class="page-title">Daily Quests</h1>
      <p class="page-subtitle">Complete quests to earn bonus XP</p>
    </header>
    <div class="quests-grid" id="quests-grid"></div>
    <div class="quests-tip"><span class="tip-icon">💡</span>Quests reset every midnight. New challenges await tomorrow!</div>
  </section>

  <!-- ACHIEVEMENTS -->
  <section id="view-achievements" class="view">
    <header class="page-header">
      <h1 class="page-title">Badge Collection</h1>
      <p class="page-subtitle">Your hall of achievements</p>
    </header>
    <div class="badges-grid" id="badges-grid"></div>
    <div class="badges-locked-section">
      <h3 class="locked-title">Locked Badges</h3>
      <div class="badges-grid locked" id="locked-badges-grid"></div>
    </div>
  </section>

  <!-- PROFILE -->
  <section id="view-profile" class="view">
    <header class="page-header">
      <h1 class="page-title">Profile</h1>
      <p class="page-subtitle">Your journey at a glance</p>
    </header>

    <!-- Hero card -->
    <div class="profile-hero-card">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar-circle" id="profile-avatar-circle">🧑</div>
        <div class="profile-lvl-badge" id="profile-lvl-badge">1</div>
      </div>
      <div class="profile-hero-info">
        <h2 class="profile-hero-name" id="profile-hero-name">—</h2>
        <p class="profile-hero-since" id="profile-hero-since">Member since …</p>
        <div class="profile-title-badge" id="profile-title-badge">
          <span id="profile-title-text">Newcomer</span>
        </div>
      </div>
    </div>

    <!-- XP + Level progression -->
    <div class="profile-xp-card">
      <div class="pxp-header">
        <div class="pxp-level-info">
          <span class="pxp-level-label">LEVEL</span>
          <span class="pxp-level-num" id="pxp-level-num">1</span>
        </div>
        <div class="pxp-numbers">
          <span class="pxp-cur" id="pxp-cur">0</span>
          <span class="pxp-sep"> / </span>
          <span class="pxp-nxt" id="pxp-nxt">17</span>
          <span class="pxp-xp"> XP</span>
        </div>
      </div>
      <div class="pxp-bar-track">
        <div class="pxp-bar-fill" id="pxp-bar-fill" style="width:0%"></div>
        <div class="pxp-bar-shine"></div>
      </div>
      <div class="pxp-footer">
        <span class="pxp-to-next" id="pxp-to-next">— XP to Level 2</span>
        <span class="pxp-total" id="pxp-total">Total: 0 XP</span>
      </div>

      <!-- Level milestones row -->
      <div class="level-road" id="level-road"></div>
    </div>

    <!-- Stats grid -->
    <div class="profile-stats-grid" id="profile-stats-grid">
      <div class="pstat"><span class="pstat-val" id="ps-done">—</span><span class="pstat-lbl">Habits Done</span><span class="pstat-icon">✅</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-active">—</span><span class="pstat-lbl">Active Habits</span><span class="pstat-icon">📋</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-days">—</span><span class="pstat-lbl">Days Active</span><span class="pstat-icon">📅</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-cur-streak">—</span><span class="pstat-lbl">Current Streak</span><span class="pstat-icon">🔥</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-best-streak">—</span><span class="pstat-lbl">Best Streak</span><span class="pstat-icon">🏆</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-badges">—</span><span class="pstat-lbl">Badges Earned</span><span class="pstat-icon">🏅</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-rate">—</span><span class="pstat-lbl">30-day Rate</span><span class="pstat-icon">📊</span></div>
      <div class="pstat"><span class="pstat-val" id="ps-journal">—</span><span class="pstat-lbl">Journal Entries</span><span class="pstat-icon">📓</span></div>
    </div>

    <!-- Weekly XP earned chart -->
    <div class="profile-chart-card">
      <h3 class="profile-chart-title">XP Earned — Last 8 Weeks</h3>
      <div class="profile-chart-wrap"><canvas id="chart-xp-weekly"></canvas></div>
    </div>

    <!-- Recent badges -->
    <div class="profile-badges-card">
      <h3 class="profile-chart-title">Recent Badges</h3>
      <div class="profile-badges-row" id="profile-badges-row">
        <p class="profile-no-badges">No badges yet — complete habits to earn them! 🌱</p>
      </div>
    </div>

  </section>

</main>

<!-- MODAL: Add Habit -->
<div id="modal-add-habit" class="modal-overlay hidden" role="dialog" aria-modal="true">
  <div class="modal-box">
    <button class="modal-close" id="close-add-modal">✕</button>
    <h2 class="modal-title">New Habit</h2>
    <div class="form-group">
      <label class="form-label" for="habit-name-input">Habit Name *</label>
      <input type="text" id="habit-name-input" class="form-input" placeholder="e.g. Morning Run" maxlength="120" autocomplete="off"/>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Emoji</label>
        <div class="emoji-picker" id="emoji-picker"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Accent Color</label>
        <div class="color-picker-row">
          <input type="color" id="habit-color-input" class="color-swatch" value="#FFD700"/>
          <div class="color-presets">
            <button class="color-preset" data-color="#FFD700" style="background:#FFD700"></button>
            <button class="color-preset" data-color="#FF9500" style="background:#FF9500"></button>
            <button class="color-preset" data-color="#4ADE80" style="background:#4ADE80"></button>
            <button class="color-preset" data-color="#38BDF8" style="background:#38BDF8"></button>
            <button class="color-preset" data-color="#F43F5E" style="background:#F43F5E"></button>
            <button class="color-preset" data-color="#8B5CF6" style="background:#8B5CF6"></button>
            <button class="color-preset" data-color="#EC4899" style="background:#EC4899"></button>
          </div>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description <small>(optional)</small></label>
      <input type="text" id="habit-desc-input" class="form-input" placeholder="Why does this habit matter?" maxlength="255"/>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" id="cancel-add-modal">Cancel</button>
      <button class="btn-primary" id="submit-add-habit">
        <span class="btn-text">Add Habit</span>
        <span class="btn-spinner hidden">⏳</span>
      </button>
    </div>
  </div>
</div>

<!-- MODAL: Habit Detail -->
<div id="modal-habit-detail" class="modal-overlay hidden" role="dialog" aria-modal="true">
  <div class="modal-box modal-box--wide">
    <button class="modal-close" id="close-detail-modal">✕</button>
    <div class="detail-header">
      <span class="detail-emoji" id="detail-emoji">⭐</span>
      <div>
        <h2 class="modal-title" id="detail-modal-title">Habit</h2>
        <p class="detail-desc" id="detail-desc"></p>
      </div>
      <div class="detail-streak-badge">
        <span class="detail-streak-num" id="detail-streak-num">0</span>
        <span class="detail-streak-lbl">streak</span>
      </div>
    </div>
    <div class="detail-chart-wrap"><canvas id="chart-habit-history"></canvas></div>
    <div class="journal-section">
      <h3 class="journal-title">📓 Today's Journal</h3>
      <textarea id="journal-textarea" class="journal-input" placeholder="How did this habit go today?" rows="4" maxlength="5000"></textarea>
      <div class="journal-actions">
        <span class="journal-char-count"><span id="journal-char-count">0</span>/5000</span>
        <button class="btn-primary btn--sm" id="save-journal-btn">Save +15 XP</button>
      </div>
    </div>
    <div class="recent-logs">
      <h3 class="recent-title">Recent Activity</h3>
      <div class="logs-list" id="logs-list"></div>
    </div>
    <div class="detail-footer">
      <button class="btn-danger" id="delete-habit-btn">🗑 Delete Habit</button>
    </div>
  </div>
</div>

<script>
window.HABBITO = {
  ajaxUrl  : 'ajax.php',
  today    : '<?= $today ?>',
  username : '<?= htmlspecialchars($user['username']) ?>',
};
</script>
<script src="script.js"></script>
<script src="animations.js"></script>
</body>
</html>
