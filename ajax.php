<?php
// ============================================================
// HABBITO — ajax.php   (all AJAX endpoints, user-scoped)
// ============================================================
declare(strict_types=1);
require_once __DIR__ . '/config.php';

ob_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'POST only'], 405);
}

// Auth guard — returns 401 JSON if not logged in
$uid  = requireLoginAjax();
$body = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$act  = clean($body['action'] ?? '');

try {
    match ($act) {
        'get_dashboard'     => getDashboard($uid),
        'toggle_habit'      => toggleHabit($body, $uid),
        'add_habit'         => addHabit($body, $uid),
        'delete_habit'      => deleteHabit($body, $uid),
        'save_journal'      => saveJournal($body, $uid),
        'get_stats'         => getStats($uid),
        'get_heatmap'       => getHeatmap($body, $uid),
        'get_habit_history' => getHabitHistory($body, $uid),
        'get_quests'        => getQuests($uid),
        'get_achievements'  => getAchievements($uid),
        'check_badges'      => checkBadges($uid),
        'get_profile'       => getProfile($uid),
        default             => jsonResponse(['success' => false, 'error' => "Unknown action: $act"], 400),
    };
} catch (PDOException $e) {
    jsonResponse(['success' => false, 'error' => APP_ENV === 'development' ? $e->getMessage() : 'Database error'], 500);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => APP_ENV === 'development' ? $e->getMessage() : 'Server error'], 500);
}

// ============================================================
// GET DASHBOARD
// ============================================================
function getDashboard(int $uid): never
{
    $db    = getDB();
    $today = date('Y-m-d');

    // Ensure stats row exists
    ensureStats($db, $uid);

    $stmt = $db->prepare('
        SELECT h.id, h.name, h.emoji, h.color, h.description, h.sort_order,
               COALESCE(hl.completed,    0) AS completed,
               COALESCE(hl.journal_note,"") AS journal_note,
               COALESCE(hl.xp_earned,   0) AS xp_earned,
               (SELECT COUNT(*) FROM habit_logs WHERE habit_id=h.id AND completed=1) AS total_completions
        FROM habits h
        LEFT JOIN habit_logs hl ON hl.habit_id=h.id AND hl.log_date=:today
        WHERE h.user_id=:uid AND h.is_active=1
        ORDER BY h.sort_order, h.id
    ');
    $stmt->execute([':today' => $today, ':uid' => $uid]);
    $habits = $stmt->fetchAll();

    // Cast integer/bool fields (PDO emulation returns strings)
    foreach ($habits as &$h) {
        $h['id']               = (int)$h['id'];
        $h['completed']        = (int)$h['completed'];
        $h['xp_earned']        = (int)$h['xp_earned'];
        $h['total_completions']= (int)$h['total_completions'];
        $h['current_streak']   = habitStreak($db, (int)$h['id']);
    }
    unset($h);

    $total = count($habits);
    $done  = (int) array_sum(array_column($habits, 'completed'));

    jsonResponse([
        'success'        => true,
        'habits'         => $habits,
        'stats'          => userStats($db, $uid),
        'today'          => $today,
        'total_habits'   => $total,
        'completed_today'=> $done,
        'perfect_day'    => ($total > 0 && $done === $total),
    ]);
}

// ============================================================
// TOGGLE HABIT
// ============================================================
function toggleHabit(array $b, int $uid): never
{
    $db  = getDB();
    $hid = cleanInt($b['habit_id'] ?? 0);
    $dt  = cleanDate($b['date']    ?? date('Y-m-d'));

    if (!$hid) jsonResponse(['success' => false, 'error' => 'Invalid habit_id']);
    if ($dt !== date('Y-m-d')) jsonResponse(['success' => false, 'error' => 'Can only toggle today']);

    // Ownership check
    $own = $db->prepare('SELECT id FROM habits WHERE id=:hid AND user_id=:uid AND is_active=1');
    $own->execute([':hid' => $hid, ':uid' => $uid]);
    if (!$own->fetch()) jsonResponse(['success' => false, 'error' => 'Habit not found'], 404);

    $cur = $db->prepare('SELECT completed, xp_earned FROM habit_logs WHERE habit_id=:hid AND log_date=:dt');
    $cur->execute([':hid' => $hid, ':dt' => $dt]);
    $row = $cur->fetch();

    $db->beginTransaction();
    try {
        $xpAwarded    = 0;
        $levelUp      = false;
        $newCompleted = 0;

        if ($row && (int)$row['completed'] === 1) {
            // ── Un-complete ──
            $remove = (int)$row['xp_earned'];
            $db->prepare('UPDATE habit_logs SET completed=0, xp_earned=0 WHERE habit_id=:hid AND log_date=:dt')
               ->execute([':hid' => $hid, ':dt' => $dt]);
            adjustXP($db, $uid, -$remove);
            $xpAwarded    = -$remove;
            $newCompleted = 0;

        } else {
            // ── Complete ──
            $streak = habitStreak($db, $hid);
            $xp     = XP_BASE;
            if (($streak + 1) >= 30) $xp += XP_STREAK_30;
            elseif (($streak + 1) >= 7) $xp += XP_STREAK_7;
            elseif (($streak + 1) >= 3) $xp += XP_STREAK_3;

            // First habit of day bonus
            if (todayDoneCount($db, $uid, $dt) === 0) $xp += XP_FIRST_HABIT;

            $xp += rand(0, XP_LUCKY_MAX);

            $db->prepare('
                INSERT INTO habit_logs (habit_id, log_date, completed, xp_earned)
                VALUES (:hid, :dt, 1, :xp_i)
                ON DUPLICATE KEY UPDATE completed=1, xp_earned=:xp_u
            ')->execute([':hid' => $hid, ':dt' => $dt, ':xp_i' => $xp, ':xp_u' => $xp]);

            $levelUp   = adjustXP($db, $uid, $xp);
            $xpAwarded = $xp;

            // Perfect day bonus — check AFTER insert
            $allHabits = totalActiveHabits($db, $uid);
            $doneSoFar = todayDoneCount($db, $uid, $dt);
            if ($allHabits > 0 && $doneSoFar >= $allHabits) {
                adjustXP($db, $uid, XP_PERFECT_DAY);
                $xpAwarded += XP_PERFECT_DAY;
                awardBadge($db, $uid, 'perfect_day', 'Perfect Day', 'Completed ALL habits!', '⚡', 150);
            }

            // Streak badges
            if (($streak + 1) >= 7)  awardBadge($db, $uid, 'streak_7',  'Week Warrior', '7-day streak!',   '🔥', 100);
            if (($streak + 1) >= 30) awardBadge($db, $uid, 'streak_30', 'Month Master', '30-day streak!',  '🏆', 300);

            // First ever badge
            if (allTimeCompletions($db, $uid) === 1) {
                awardBadge($db, $uid, 'first_habit', 'First Step', 'Your very first habit!', '🌱', 25);
            }

            $newCompleted = 1;
        }

        $db->commit();
        jsonResponse([
            'success'    => true,
            'completed'  => (int)$newCompleted,
            'xp_awarded' => $xpAwarded,
            'level_up'   => $levelUp,
            'stats'      => userStats($db, $uid),
            'streak'     => habitStreak($db, $hid),
        ]);
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

// ============================================================
// ADD HABIT
// ============================================================
function addHabit(array $b, int $uid): never
{
    $db    = getDB();
    $name  = clean($b['name']        ?? '', 120);
    $emoji = clean($b['emoji']       ?? '⭐', 8);
    $color = clean($b['color']       ?? '#FFD700', 7);
    $desc  = clean($b['description'] ?? '', 255);

    if (!$name) jsonResponse(['success' => false, 'error' => 'Habit name is required']);
    if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) $color = '#FFD700';

    $mo = $db->prepare('SELECT COALESCE(MAX(sort_order),0) FROM habits WHERE user_id=:uid');
    $mo->execute([':uid' => $uid]);
    $next = (int)$mo->fetchColumn() + 1;

    $db->prepare('INSERT INTO habits (user_id, name, emoji, color, description, sort_order) VALUES (:uid,:name,:emoji,:color,:desc,:sort)')
       ->execute([':uid'=>$uid,':name'=>$name,':emoji'=>$emoji,':color'=>$color,':desc'=>$desc,':sort'=>$next]);

    jsonResponse(['success' => true, 'habit_id' => (int)$db->lastInsertId()]);
}

// ============================================================
// DELETE HABIT
// ============================================================
function deleteHabit(array $b, int $uid): never
{
    $db  = getDB();
    $hid = cleanInt($b['habit_id'] ?? 0);
    if (!$hid) jsonResponse(['success' => false, 'error' => 'Invalid habit_id']);

    $db->prepare('UPDATE habits SET is_active=0 WHERE id=:id AND user_id=:uid')
       ->execute([':id' => $hid, ':uid' => $uid]);

    jsonResponse(['success' => true]);
}

// ============================================================
// SAVE JOURNAL
// ============================================================
function saveJournal(array $b, int $uid): never
{
    $db   = getDB();
    $hid  = cleanInt($b['habit_id'] ?? 0);
    $dt   = cleanDate($b['date']    ?? date('Y-m-d'));
    $note = clean($b['note']        ?? '', 5000);

    if (!$hid) jsonResponse(['success' => false, 'error' => 'Invalid habit_id']);

    // Ownership check
    $own = $db->prepare('SELECT id FROM habits WHERE id=:hid AND user_id=:uid');
    $own->execute([':hid' => $hid, ':uid' => $uid]);
    if (!$own->fetch()) jsonResponse(['success' => false, 'error' => 'Habit not found'], 404);

    $db->prepare('
        INSERT INTO habit_logs (habit_id, log_date, completed, journal_note, xp_earned)
        VALUES (:hid, :dt, 0, :note_i, 0)
        ON DUPLICATE KEY UPDATE journal_note=:note_u
    ')->execute([':hid' => $hid, ':dt' => $dt, ':note_i' => $note, ':note_u' => $note]);

    $xpBonus = 0;
    $levelUp = false;
    if (trim($note) !== '') {
        $xpBonus = XP_JOURNAL;
        $levelUp = adjustXP($db, $uid, XP_JOURNAL);

        $jc = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.journal_note IS NOT NULL AND hl.journal_note!=""');
        $jc->execute([':uid' => $uid]);
        if ((int)$jc->fetchColumn() >= 5) {
            awardBadge($db, $uid, 'journal_5', 'Wordsmith', 'Wrote 5 journal entries', '✍️', 75);
        }
    }

    jsonResponse(['success'=>true,'xp_bonus'=>$xpBonus,'level_up'=>$levelUp,'stats'=>userStats($db,$uid)]);
}

// ============================================================
// GET STATS (analytics hub)
// ============================================================
function getStats(int $uid): never
{
    $db    = getDB();
    $today = date('Y-m-d');

    // 30-day trend
    $t = $db->prepare('
        SELECT hl.log_date, SUM(hl.completed) AS completed_count, COUNT(*) AS total_habits
        FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id
        WHERE h.user_id=:uid AND hl.log_date >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)
        GROUP BY hl.log_date ORDER BY hl.log_date
    ');
    $t->execute([':uid' => $uid]);
    $trend30 = $t->fetchAll();

    // Ranking
    $r = $db->prepare('
        SELECT h.name, h.emoji, h.color,
               COALESCE(SUM(hl.completed),0) AS total_done
        FROM habits h LEFT JOIN habit_logs hl ON hl.habit_id=h.id
        WHERE h.user_id=:uid AND h.is_active=1
        GROUP BY h.id ORDER BY total_done DESC LIMIT 10
    ');
    $r->execute([':uid' => $uid]);
    $ranking = $r->fetchAll();

    // Today pie
    $p = $db->prepare('
        SELECT SUM(IF(hl.completed=1,1,0)) AS done,
               SUM(IF(hl.completed=0,1,0)) AS missed,
               COUNT(h.id) AS total
        FROM habits h
        LEFT JOIN habit_logs hl ON hl.habit_id=h.id AND hl.log_date=:today
        WHERE h.user_id=:uid AND h.is_active=1
    ');
    $p->execute([':today' => $today, ':uid' => $uid]);
    $todayPie = $p->fetch();

    // Streaks per habit
    $s = $db->prepare('SELECT id, name, emoji, color FROM habits WHERE user_id=:uid AND is_active=1');
    $s->execute([':uid' => $uid]);
    $habits = $s->fetchAll();
    $streaks = [];
    foreach ($habits as $h) {
        $h['longest_streak'] = longestStreak($db, (int)$h['id']);
        $streaks[] = $h;
    }

    // Weekly
    $w = $db->prepare('
        SELECT YEARWEEK(hl.log_date,1) AS yw, MIN(hl.log_date) AS week_start,
               SUM(hl.completed) AS done, COUNT(*) AS total,
               ROUND(SUM(hl.completed)/COUNT(*)*100,1) AS rate
        FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id
        WHERE h.user_id=:uid AND hl.log_date >= DATE_SUB(CURDATE(),INTERVAL 28 DAY)
        GROUP BY yw ORDER BY yw
    ');
    $w->execute([':uid' => $uid]);
    $weekly = $w->fetchAll();

    jsonResponse([
        'success'     => true,
        'trend30'     => $trend30,
        'ranking'     => $ranking,
        'today_pie'   => $todayPie,
        'streaks'     => $streaks,
        'weekly_rate' => $weekly,
        'stats'       => userStats($db, $uid),
    ]);
}

// ============================================================
// GET HEATMAP
// ============================================================
function getHeatmap(array $b, int $uid): never
{
    $db  = getDB();
    $hid = cleanInt($b['habit_id'] ?? 0);

    $join   = $hid > 0 ? 'AND hl.habit_id = :hid' : '';
    $params = [':uid' => $uid];
    if ($hid > 0) $params[':hid'] = $hid;

    $stmt = $db->prepare("
        WITH RECURSIVE ds AS (
            SELECT DATE_SUB(CURDATE(), INTERVAL 181 DAY) AS d
            UNION ALL
            SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM ds WHERE d < CURDATE()
        )
        SELECT ds.d AS log_date,
               COALESCE(SUM(hl.completed),0) AS completed_count,
               COALESCE(COUNT(h.id),0) AS total_habits,
               CASE
                 WHEN COALESCE(SUM(hl.completed),0) = 0 THEN 0
                 WHEN COALESCE(SUM(hl.completed),0) < 2  THEN 1
                 WHEN COALESCE(SUM(hl.completed)/NULLIF(COUNT(h.id),0),0) < 0.5 THEN 2
                 WHEN COALESCE(SUM(hl.completed)/NULLIF(COUNT(h.id),0),0) < 1.0 THEN 3
                 ELSE 4
               END AS intensity
        FROM ds
        LEFT JOIN habit_logs hl ON hl.log_date=ds.d $join
        LEFT JOIN habits h ON h.id=hl.habit_id AND h.user_id=:uid AND h.is_active=1
        GROUP BY ds.d ORDER BY ds.d
    ");
    $stmt->execute($params);
    jsonResponse(['success' => true, 'heatmap' => $stmt->fetchAll()]);
}

// ============================================================
// GET HABIT HISTORY (detail modal)
// ============================================================
function getHabitHistory(array $b, int $uid): never
{
    $db  = getDB();
    $hid = cleanInt($b['habit_id'] ?? 0);
    if (!$hid) jsonResponse(['success' => false, 'error' => 'Invalid habit_id']);

    $own = $db->prepare('SELECT id,name,emoji,color,description FROM habits WHERE id=:hid AND user_id=:uid');
    $own->execute([':hid' => $hid, ':uid' => $uid]);
    $habit = $own->fetch();
    if (!$habit) jsonResponse(['success' => false, 'error' => 'Habit not found'], 404);

    $stmt = $db->prepare("
        WITH RECURSIVE ds AS (
            SELECT DATE_SUB(CURDATE(), INTERVAL 29 DAY) AS d
            UNION ALL
            SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM ds WHERE d < CURDATE()
        )
        SELECT ds.d AS log_date,
               COALESCE(hl.completed,0) AS completed,
               COALESCE(hl.journal_note,'') AS journal_note,
               COALESCE(hl.xp_earned,0) AS xp_earned
        FROM ds LEFT JOIN habit_logs hl ON hl.habit_id=:hid AND hl.log_date=ds.d
        ORDER BY ds.d
    ");
    $stmt->execute([':hid' => $hid]);

    $history = array_map(fn($r) => array_merge($r, ['completed'=>(int)$r['completed'],'xp_earned'=>(int)$r['xp_earned']]), $stmt->fetchAll());
    jsonResponse(['success'=>true,'habit'=>$habit,'history'=>$history,'streak'=>habitStreak($db,$hid)]);
}

// ============================================================
// GET QUESTS
// ============================================================
function getQuests(int $uid): never
{
    $db    = getDB();
    $today = date('Y-m-d');
    generateQuests($db, $uid, $today);
    updateQuestProgress($db, $uid, $today);

    $stmt = $db->prepare('SELECT * FROM daily_quests WHERE user_id=:uid AND quest_date=:today ORDER BY id');
    $stmt->execute([':uid' => $uid, ':today' => $today]);
    jsonResponse(['success' => true, 'quests' => $stmt->fetchAll()]);
}

// ============================================================
// GET ACHIEVEMENTS
// ============================================================
function getAchievements(int $uid): never
{
    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM user_achievements WHERE user_id=:uid ORDER BY unlocked_at DESC');
    $stmt->execute([':uid' => $uid]);
    jsonResponse(['success' => true, 'badges' => $stmt->fetchAll()]);
}

// ============================================================
// CHECK BADGES (level milestones)
// ============================================================
function checkBadges(int $uid): never
{
    $db    = getDB();
    $stats = userStats($db, $uid);
    $level = (int)$stats['level'];
    if ($level >= 5)  awardBadge($db, $uid, 'level_5',  'Apprentice', 'Reached Level 5',  '⭐', 50);
    if ($level >= 10) awardBadge($db, $uid, 'level_10', 'Journeyman', 'Reached Level 10', '🌟', 100);
    if ($level >= 25) awardBadge($db, $uid, 'level_25', 'Expert',     'Reached Level 25', '💫', 250);
    if ($level >= 50) awardBadge($db, $uid, 'level_50', 'Master',     'Reached Level 50', '👑', 500);
    jsonResponse(['success' => true]);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function ensureStats(PDO $db, int $uid): void
{
    $db->prepare('INSERT IGNORE INTO user_stats (user_id,total_xp,`level`,daily_streak) VALUES (:uid,0,1,0)')
       ->execute([':uid' => $uid]);
}

function userStats(PDO $db, int $uid): array
{
    ensureStats($db, $uid);
    $stmt = $db->prepare('SELECT total_xp, daily_streak FROM user_stats WHERE user_id=:uid');
    $stmt->execute([':uid' => $uid]);
    $row  = $stmt->fetch() ?: ['total_xp' => 0, 'daily_streak' => 0];
    $xp   = (int)$row['total_xp'];
    $lvl  = xpToLevel($xp);
    return [
        'total_xp'       => $xp,
        'level'          => $lvl,
        'level_xp_start' => levelStartXP($lvl),
        'level_xp_next'  => levelStartXP($lvl + 1),
        'level_xp_pct'   => xpProgressPercent($xp),
        'daily_streak'   => (int)$row['daily_streak'],
    ];
}

function adjustXP(PDO $db, int $uid, int $delta): bool
{
    ensureStats($db, $uid);
    $q = $db->prepare('SELECT total_xp FROM user_stats WHERE user_id=:uid');
    $q->execute([':uid' => $uid]);
    $before = (int)$q->fetchColumn();
    $after  = max(0, $before + $delta);
    $db->prepare('UPDATE user_stats SET total_xp=:xp, `level`=:lvl WHERE user_id=:uid')
       ->execute([':xp' => $after, ':lvl' => xpToLevel($after), ':uid' => $uid]);
    return xpToLevel($after) > xpToLevel($before);
}

function habitStreak(PDO $db, int $hid): int
{
    $stmt = $db->prepare('SELECT log_date FROM habit_logs WHERE habit_id=:hid AND completed=1 ORDER BY log_date DESC LIMIT 365');
    $stmt->execute([':hid' => $hid]);
    $dates = array_column($stmt->fetchAll(), 'log_date');
    if (!$dates) return 0;

    $today = new DateTime(date('Y-m-d'));
    $last  = new DateTime($dates[0]);
    if ($today->diff($last)->days > 1) return 0;

    $streak  = 1;
    $current = $last;
    foreach (array_slice($dates, 1) as $d) {
        $prev = new DateTime($d);
        if ($prev->format('Y-m-d') !== (clone $current)->modify('-1 day')->format('Y-m-d')) break;
        $streak++;
        $current = $prev;
    }
    return $streak;
}

function longestStreak(PDO $db, int $hid): int
{
    $stmt = $db->prepare('SELECT log_date FROM habit_logs WHERE habit_id=:hid AND completed=1 ORDER BY log_date');
    $stmt->execute([':hid' => $hid]);
    $dates = array_column($stmt->fetchAll(), 'log_date');
    if (!$dates) return 0;
    $best = 1; $cur = 1;
    for ($i = 1; $i < count($dates); $i++) {
        $prev = new DateTime($dates[$i-1]);
        $this_ = new DateTime($dates[$i]);
        if ($this_->diff($prev)->days === 1) { $cur++; $best = max($best, $cur); }
        else $cur = 1;
    }
    return $best;
}

function todayDoneCount(PDO $db, int $uid, string $dt): int
{
    $s = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.log_date=:dt AND hl.completed=1');
    $s->execute([':uid' => $uid, ':dt' => $dt]);
    return (int)$s->fetchColumn();
}

function totalActiveHabits(PDO $db, int $uid): int
{
    $s = $db->prepare('SELECT COUNT(*) FROM habits WHERE user_id=:uid AND is_active=1');
    $s->execute([':uid' => $uid]);
    return (int)$s->fetchColumn();
}

function allTimeCompletions(PDO $db, int $uid): int
{
    $s = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.completed=1');
    $s->execute([':uid' => $uid]);
    return (int)$s->fetchColumn();
}

function awardBadge(PDO $db, int $uid, string $key, string $name, string $desc, string $emoji, int $xp): void
{
    $stmt = $db->prepare('INSERT IGNORE INTO user_achievements (user_id,badge_key,badge_name,badge_desc,badge_emoji,xp_reward) VALUES (:uid,:key,:name,:desc,:emoji,:xp)');
    $stmt->execute([':uid'=>$uid,':key'=>$key,':name'=>$name,':desc'=>$desc,':emoji'=>$emoji,':xp'=>$xp]);
    if ($stmt->rowCount() > 0) adjustXP($db, $uid, $xp);
}

function generateQuests(PDO $db, int $uid, string $today): void
{
    $c = $db->prepare('SELECT COUNT(*) FROM daily_quests WHERE user_id=:uid AND quest_date=:d');
    $c->execute([':uid' => $uid, ':d' => $today]);
    if ((int)$c->fetchColumn() > 0) return;

    $total = totalActiveHabits($db, $uid);
    $quests = [
        ['complete_3',      'Triple Threat',     'Complete at least 3 habits today',    '🎯', 3,      50],
        ['all_habits',      'Perfect Alignment', "Complete all {$total} habits today",  '⚡', $total, 150],
        ['journal_entry',   'Inner Voice',       'Write a journal entry for any habit', '📝', 1,      40],
        ['morning_starter', 'Early Bird',        'Complete a habit before noon',        '🌅', 1,      30],
    ];
    $stmt = $db->prepare('INSERT IGNORE INTO daily_quests (user_id,quest_date,quest_key,quest_name,quest_desc,quest_emoji,target_value,xp_reward) VALUES (:uid,:dt,:k,:n,:d,:e,:t,:x)');
    foreach ($quests as [$k,$n,$d,$e,$t,$x]) {
        $stmt->execute([':uid'=>$uid,':dt'=>$today,':k'=>$k,':n'=>$n,':d'=>$d,':e'=>$e,':t'=>max(1,(int)$t),':x'=>$x]);
    }
}

function updateQuestProgress(PDO $db, int $uid, string $today): void
{
    $done = todayDoneCount($db, $uid, $today);

    // complete_3 and all_habits use completion count
    foreach (['complete_3','all_habits'] as $k) {
        $db->prepare('UPDATE daily_quests SET current_value=:v, completed=IF(:v2>=target_value,1,0) WHERE user_id=:uid AND quest_date=:d AND quest_key=:k')
           ->execute([':v'=>$done,':uid'=>$uid,':d'=>$today,':k'=>$k]);
    }

    // journal_entry
    $jq = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.log_date=:d AND hl.journal_note IS NOT NULL AND hl.journal_note!=""');
    $jq->execute([':uid'=>$uid,':d'=>$today]);
    $jc = min((int)$jq->fetchColumn(), 1);
    $db->prepare('UPDATE daily_quests SET current_value=:v, completed=IF(:v2>=target_value,1,0) WHERE user_id=:uid AND quest_date=:d AND quest_key="journal_entry"')
       ->execute([':v'=>$jc,':v2'=>$jc,':uid'=>$uid,':d'=>$today]);

    // morning_starter
    $ms = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.log_date=:d AND hl.completed=1 AND TIME(hl.logged_at)<"12:00:00"');
    $ms->execute([':uid'=>$uid,':d'=>$today]);
    $mc = min((int)$ms->fetchColumn(), 1);
    $db->prepare('UPDATE daily_quests SET current_value=:v, completed=IF(:v2>=target_value,1,0) WHERE user_id=:uid AND quest_date=:d AND quest_key="morning_starter"')
       ->execute([':v'=>$mc,':v2'=>$mc,':uid'=>$uid,':d'=>$today]);
}

// ============================================================
// GET PROFILE — full character sheet data
// ============================================================
function getProfile(int $uid): never
{
    $db  = getDB();
    ensureStats($db, $uid);

    // User info
    $uq = $db->prepare('SELECT username, email, avatar_emoji, created_at FROM users WHERE id=:uid');
    $uq->execute([':uid' => $uid]);
    $user = $uq->fetch() ?: [];

    // Level data
    $sq = $db->prepare('SELECT total_xp, daily_streak FROM user_stats WHERE user_id=:uid');
    $sq->execute([':uid' => $uid]);
    $statsRow = $sq->fetch() ?: ['total_xp'=>0,'daily_streak'=>0];
    $xp       = (int)$statsRow['total_xp'];
    $level    = xpToLevel($xp);
    $lvlStart = levelStartXP($level);
    $lvlNext  = levelStartXP($level + 1);
    $xpInLvl  = $xp - $lvlStart;
    $xpNeeded = $lvlNext - $lvlStart;
    $pct      = $xpNeeded > 0 ? round($xpInLvl / $xpNeeded * 100, 2) : 100;

    // Total habits done (all time)
    $done = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.completed=1');
    $done->execute([':uid'=>$uid]);
    $totalDone = (int)$done->fetchColumn();

    // Active habits count
    $ah = $db->prepare('SELECT COUNT(*) FROM habits WHERE user_id=:uid AND is_active=1');
    $ah->execute([':uid'=>$uid]);
    $activeHabits = (int)$ah->fetchColumn();

    // Days active (days with at least 1 completion)
    $da = $db->prepare('SELECT COUNT(DISTINCT hl.log_date) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.completed=1');
    $da->execute([':uid'=>$uid]);
    $daysActive = (int)$da->fetchColumn();

    // Best streak across all habits
    $habits = $db->prepare('SELECT id FROM habits WHERE user_id=:uid AND is_active=1');
    $habits->execute([':uid'=>$uid]);
    $bestStreak = 0;
    foreach ($habits->fetchAll() as $h) {
        $s = longestStreak($db, (int)$h['id']);
        if ($s > $bestStreak) $bestStreak = $s;
    }

    // Badges earned
    $bq = $db->prepare('SELECT COUNT(*) FROM user_achievements WHERE user_id=:uid');
    $bq->execute([':uid'=>$uid]);
    $badgesCount = (int)$bq->fetchColumn();

    // 30-day completion rate
    $rq = $db->prepare('SELECT SUM(hl.completed) AS done, COUNT(*) AS total FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.log_date >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)');
    $rq->execute([':uid'=>$uid]);
    $rr = $rq->fetch();
    $rate30 = ($rr && $rr['total']>0) ? round((int)$rr['done']/(int)$rr['total']*100,1) : 0;

    // Journal entries count
    $jq = $db->prepare('SELECT COUNT(*) FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=:uid AND hl.journal_note IS NOT NULL AND hl.journal_note!=""');
    $jq->execute([':uid'=>$uid]);
    $journalCount = (int)$jq->fetchColumn();

    // Weekly XP earned — last 8 weeks (sum xp_earned per week)
    $wq = $db->prepare('
        SELECT YEARWEEK(hl.log_date,1) AS yw,
               MIN(hl.log_date) AS week_start,
               SUM(hl.xp_earned) AS xp_earned
        FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id
        WHERE h.user_id=:uid AND hl.log_date >= DATE_SUB(CURDATE(),INTERVAL 56 DAY)
        GROUP BY yw ORDER BY yw
    ');
    $wq->execute([':uid'=>$uid]);
    $weeklyXP = $wq->fetchAll();

    // Recent badges (last 5)
    $bsq = $db->prepare('SELECT badge_name, badge_desc, badge_emoji, xp_reward, unlocked_at FROM user_achievements WHERE user_id=:uid ORDER BY unlocked_at DESC LIMIT 5');
    $bsq->execute([':uid'=>$uid]);
    $recentBadges = $bsq->fetchAll();

    // Current streak across all habits (max)
    $habitsAll = $db->prepare('SELECT id FROM habits WHERE user_id=:uid AND is_active=1');
    $habitsAll->execute([':uid'=>$uid]);
    $curStreak = 0;
    foreach ($habitsAll->fetchAll() as $h) {
        $s = habitStreak($db, (int)$h['id']);
        if ($s > $curStreak) $curStreak = $s;
    }

    // Level milestones: previous 2 + current + next 4
    $milestones = [];
    $startLvl = max(1, $level - 2);
    for ($l = $startLvl; $l <= $level + 4; $l++) {
        $milestones[] = [
            'level'     => $l,
            'xp_needed' => levelStartXP($l),
            'done'      => ($l < $level),
            'current'   => ($l === $level),
        ];
    }

    jsonResponse([
        'success'        => true,
        'user'           => $user,
        'level'          => $level,
        'total_xp'       => $xp,
        'xp_in_level'    => $xpInLvl,
        'xp_for_level'   => $xpNeeded,
        'xp_to_next'     => $lvlNext - $xp,
        'level_xp_next'  => $lvlNext,
        'level_xp_pct'   => $pct,
        'daily_streak'   => (int)$statsRow['daily_streak'],
        'cur_streak'     => $curStreak,
        'total_done'     => $totalDone,
        'active_habits'  => $activeHabits,
        'days_active'    => $daysActive,
        'best_streak'    => $bestStreak,
        'badges_count'   => $badgesCount,
        'rate_30d'       => $rate30,
        'journal_count'  => $journalCount,
        'weekly_xp'      => $weeklyXP,
        'recent_badges'  => $recentBadges,
        'milestones'     => $milestones,
    ]);
}
