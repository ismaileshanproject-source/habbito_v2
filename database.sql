-- ============================================================
-- HABBITO — database.sql  (COMPLETE — single file, run once)
-- MySQL 8.0+ required (Recursive CTEs)
--
-- Accounts:
--   demo / password  — blank starter
--   sam  / password  — fully loaded showcase (Level ~27, 8 badges, 90 days)
-- ============================================================

CREATE DATABASE IF NOT EXISTS habbito
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE habbito;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS daily_quests;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS habit_logs;
DROP TABLE IF EXISTS habits;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── TABLES ───────────────────────────────────────────────────

CREATE TABLE users (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)   NOT NULL,
  email         VARCHAR(120)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  avatar_emoji  VARCHAR(8)    NOT NULL DEFAULT '🧑',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email    (email),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE habits (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  emoji       VARCHAR(8)   NOT NULL DEFAULT '⭐',
  color       VARCHAR(7)   NOT NULL DEFAULT '#FFD700',
  description VARCHAR(255)     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_habits_user (user_id),
  CONSTRAINT fk_habits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE habit_logs (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  habit_id     INT UNSIGNED NOT NULL,
  log_date     DATE         NOT NULL,
  completed    TINYINT(1)   NOT NULL DEFAULT 0,
  journal_note TEXT             NULL,
  xp_earned    SMALLINT     NOT NULL DEFAULT 0,
  logged_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_habit_date (habit_id, log_date),
  KEY idx_log_date (log_date),
  CONSTRAINT fk_log_habit FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_stats (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  total_xp     INT UNSIGNED NOT NULL DEFAULT 0,
  `level`      SMALLINT     NOT NULL DEFAULT 1,
  daily_streak INT          NOT NULL DEFAULT 0,
  last_active  DATE             NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stats_user (user_id),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_achievements (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  badge_key   VARCHAR(64)  NOT NULL,
  badge_name  VARCHAR(80)  NOT NULL,
  badge_desc  VARCHAR(200) NOT NULL,
  badge_emoji VARCHAR(8)   NOT NULL DEFAULT '🏅',
  xp_reward   SMALLINT     NOT NULL DEFAULT 0,
  unlocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_badge_user (user_id, badge_key),
  CONSTRAINT fk_achieve_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE daily_quests (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  quest_date    DATE         NOT NULL,
  quest_key     VARCHAR(64)  NOT NULL,
  quest_name    VARCHAR(100) NOT NULL,
  quest_desc    VARCHAR(200) NOT NULL,
  quest_emoji   VARCHAR(8)   NOT NULL DEFAULT '🎯',
  target_value  SMALLINT     NOT NULL DEFAULT 1,
  current_value SMALLINT     NOT NULL DEFAULT 0,
  xp_reward     SMALLINT     NOT NULL DEFAULT 50,
  completed     TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quest_user_date (user_id, quest_date, quest_key),
  CONSTRAINT fk_quests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═════════════════════════════════════════════════════════════
-- ACCOUNT 1 — demo   Login: demo / password
-- Clean starter account with 5 basic habits
-- ═════════════════════════════════════════════════════════════
INSERT INTO users (id, username, email, password_hash, avatar_emoji) VALUES
(1, 'demo', 'demo@habbito.local',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '🧑');

INSERT INTO user_stats (user_id, total_xp, `level`, daily_streak) VALUES (1, 0, 1, 0);

INSERT INTO habits (user_id, name, emoji, color, description, sort_order) VALUES
(1, 'Morning Meditation', '🧘', '#8B5CF6', 'Start the day with 10 minutes of mindfulness', 1),
(1, 'Daily Exercise',     '💪', '#FF9500', 'At least 30 minutes of physical activity',      2),
(1, 'Read 30 Minutes',    '📚', '#4ADE80', 'Feed your mind every single day',               3),
(1, 'Drink 8 Glasses',    '💧', '#38BDF8', 'Stay hydrated throughout the day',              4),
(1, 'Gratitude Journal',  '📓', '#FFD700', 'Write 3 things you are grateful for',           5);

-- ═════════════════════════════════════════════════════════════
-- ACCOUNT 2 — sam   Login: sam / password
-- Fully loaded showcase: Level ~27, 14-day streak, 8 badges,
-- 90 days of history, journal entries, quests, analytics data
-- ═════════════════════════════════════════════════════════════
INSERT INTO users (id, username, email, password_hash, avatar_emoji) VALUES
(2, 'sam', 'sam@habbito.local',
 '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '🚀');

INSERT INTO user_stats (user_id, total_xp, `level`, daily_streak) VALUES (2, 0, 1, 14);

-- Sam's 6 habits
INSERT INTO habits (id, user_id, name, emoji, color, description, sort_order) VALUES
(6,  2, 'Morning Run',     '🏃', '#FF9500', 'Run at least 3km every morning — no excuses',   1),
(7,  2, 'Deep Work',       '💻', '#8B5CF6', '2 hours of focused, distraction-free work',      2),
(8,  2, 'Read 30 Minutes', '📚', '#4ADE80', 'Read something that expands your mind daily',    3),
(9,  2, 'Healthy Eating',  '🥗', '#38BDF8', 'No junk food — eat clean, whole foods only',    4),
(10, 2, 'Meditation',      '🧘', '#FFD700', '10 minutes of mindfulness every single day',     5),
(11, 2, 'Cold Shower',     '🚿', '#F43F5E', 'Build mental resilience one shower at a time',  6);

-- ── Sam's 90-day habit logs ───────────────────────────────────
DROP PROCEDURE IF EXISTS seed_sam;
DELIMITER //
CREATE PROCEDURE seed_sam()
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE j INT DEFAULT 6;
  DECLARE d DATE;
  DECLARE c TINYINT;
  DECLARE x SMALLINT;

  WHILE i < 90 DO
    SET d = DATE_SUB(CURDATE(), INTERVAL i DAY);
    SET j = 6;
    WHILE j <= 11 DO

      IF      i < 7  THEN SET c = IF(RAND() < 0.93, 1, 0);
      ELSEIF  i < 30 THEN SET c = IF(RAND() < 0.83, 1, 0);
      ELSEIF  i < 60 THEN SET c = IF(RAND() < 0.72, 1, 0);
      ELSE              SET c = IF(RAND() < 0.58, 1, 0);
      END IF;

      SET x = IF(c = 1, 10 + FLOOR(RAND()*8) + IF(i<14,15,IF(i<30,5,0)), 0);

      -- ~20% of completions include a journal note
      IF c = 1 AND RAND() < 0.20 THEN
        INSERT IGNORE INTO habit_logs (habit_id, log_date, completed, xp_earned, journal_note)
        VALUES (j, d, 1, x + 15,
          ELT(FLOOR(RAND()*10)+1,
            'Felt incredible today — this streak keeps me going!',
            'Tough session but pushed through. No regrets.',
            'Personal best this week. Energy through the roof.',
            'Consistency is the real superpower. Showing up matters.',
            'This habit is becoming second nature now. Love it.',
            'Hard morning, almost skipped — really glad I did not.',
            'Best session in weeks. Momentum is building fast.',
            'One more day on the streak. Nothing can stop this.',
            'Challenging but rewarding. Growth outside comfort zones.',
            'Small daily wins add up to massive results over time.'
          )
        );
      ELSE
        INSERT IGNORE INTO habit_logs (habit_id, log_date, completed, xp_earned)
        VALUES (j, d, c, x);
      END IF;

      SET j = j + 1;
    END WHILE;
    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;
CALL seed_sam();
DROP PROCEDURE IF EXISTS seed_sam;

-- ── Sam's badges ─────────────────────────────────────────────
INSERT INTO user_achievements
  (user_id, badge_key, badge_name, badge_desc, badge_emoji, xp_reward, unlocked_at)
VALUES
(2,'first_habit','First Step',   'Completed your very first habit',      '🌱', 25,  DATE_SUB(NOW(),INTERVAL 89 DAY)),
(2,'streak_7',   'Week Warrior', 'Maintained a 7-day streak',            '🔥', 100, DATE_SUB(NOW(),INTERVAL 83 DAY)),
(2,'streak_30',  'Month Master', 'Maintained a 30-day streak',           '🏆', 300, DATE_SUB(NOW(),INTERVAL 60 DAY)),
(2,'perfect_day','Perfect Day',  'Completed ALL habits in a single day', '⚡', 150, DATE_SUB(NOW(),INTERVAL 45 DAY)),
(2,'journal_5',  'Wordsmith',    'Wrote 5 journal entries',              '✍️', 75, DATE_SUB(NOW(),INTERVAL 30 DAY)),
(2,'level_5',    'Apprentice',   'Reached Level 5',                      '⭐', 50,  DATE_SUB(NOW(),INTERVAL 70 DAY)),
(2,'level_10',   'Journeyman',   'Reached Level 10',                     '🌟', 100, DATE_SUB(NOW(),INTERVAL 40 DAY)),
(2,'level_25',   'Expert',       'Reached Level 25',                     '💫', 250, DATE_SUB(NOW(),INTERVAL 15 DAY));

-- ── Sam's today quests (3 done, 1 in progress) ───────────────
INSERT IGNORE INTO daily_quests
  (user_id,quest_date,quest_key,quest_name,quest_desc,quest_emoji,target_value,current_value,xp_reward,completed)
VALUES
(2,CURDATE(),'complete_3',     'Triple Threat',    'Complete at least 3 habits today',    '🎯',3,3,50, 1),
(2,CURDATE(),'all_habits',     'Perfect Alignment','Complete all 6 habits today',         '⚡',6,4,150,0),
(2,CURDATE(),'journal_entry',  'Inner Voice',      'Write a journal entry for any habit', '📝',1,1,40, 1),
(2,CURDATE(),'morning_starter','Early Bird',       'Complete a habit before noon',        '🌅',1,1,30, 1);

-- ── Update Sam's XP and level ────────────────────────────────
UPDATE user_stats
SET total_xp = (
    SELECT COALESCE(SUM(hl.xp_earned),0)
    FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id
    WHERE h.user_id=2 AND hl.completed=1
  ) + 1050,
  `level` = GREATEST(1, FLOOR(
    (SQRT(8*((
      SELECT COALESCE(SUM(hl.xp_earned),0)
      FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id
      WHERE h.user_id=2 AND hl.completed=1
    )+1050)+225)-15)/2
  ))
WHERE user_id = 2;
