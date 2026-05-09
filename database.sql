SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS daily_quests;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS habit_logs;
DROP TABLE IF EXISTS habits;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── users ────────────────────────────────────────────────────
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

-- ── habits ───────────────────────────────────────────────────
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

-- ── habit_logs ───────────────────────────────────────────────
CREATE TABLE habit_logs (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  habit_id     INT UNSIGNED NOT NULL,
  log_date     DATE         NOT NULL,
  completed    TINYINT(1)   NOT NULL DEFAULT 0,
  journal_note TEXT             NULL,
  xp_earned   SMALLINT     NOT NULL DEFAULT 0,
  logged_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_habit_date (habit_id, log_date),
  KEY idx_log_date (log_date),
  CONSTRAINT fk_log_habit FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── user_stats ───────────────────────────────────────────────
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

-- ── user_achievements ────────────────────────────────────────
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

-- ── daily_quests ─────────────────────────────────────────────
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