<?php
// ============================================================
// HABBITO — config.php
// ============================================================
declare(strict_types=1);

define('APP_NAME',    'Habbito');
define('APP_ENV',     'development'); // change to 'production' when live

// ── Database — UPDATE THESE ───────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'habbito');
define('DB_USER', 'root');
define('DB_PASS', '');          // XAMPP default is blank

// ── XP constants ──────────────────────────────────────────────
define('XP_BASE',        10);
define('XP_STREAK_3',     5);
define('XP_STREAK_7',    15);
define('XP_STREAK_30',   50);
define('XP_FIRST_HABIT', 20);
define('XP_PERFECT_DAY', 75);
define('XP_JOURNAL',     15);
define('XP_LUCKY_MAX',   10);

date_default_timezone_set('UTC');

if (APP_ENV === 'development') {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(0);
}

// ── Database connection ───────────────────────────────────────
function getDB(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => true,  // allows reuse of named params in same query
        ]);
    } catch (PDOException $e) {
        $msg = APP_ENV === 'development'
            ? 'DB Error: ' . $e->getMessage()
            : 'Could not connect to the database. Check config.php credentials.';
        die(json_encode(['success' => false, 'error' => $msg]));
    }
    return $pdo;
}

// ── XP / Level ────────────────────────────────────────────────
function xpToLevel(int $xp): int
{
    if ($xp <= 0) return 1;
    return (int) max(1, floor((sqrt(8 * $xp + 225) - 15) / 2));
}
function levelStartXP(int $level): int
{
    return (int) max(0, floor((pow(2 * $level + 15, 2) - 225) / 8));
}
function xpProgressPercent(int $xp): float
{
    $lvl   = xpToLevel($xp);
    $start = levelStartXP($lvl);
    $next  = levelStartXP($lvl + 1);
    $range = $next - $start;
    if ($range <= 0) return 100.0;
    return round(min(100.0, ($xp - $start) / $range * 100), 2);
}

// ── JSON response ─────────────────────────────────────────────
function jsonResponse(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Input helpers ─────────────────────────────────────────────
function clean(mixed $v, int $max = 255): string
{
    return mb_substr(trim((string) $v), 0, $max);
}
function cleanInt(mixed $v): int
{
    return filter_var($v, FILTER_VALIDATE_INT) !== false ? (int) $v : 0;
}
function cleanDate(string $v): string
{
    $d = DateTime::createFromFormat('Y-m-d', $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : date('Y-m-d');
}

// ── Session ───────────────────────────────────────────────────
function startSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params(['lifetime'=>0,'path'=>'/','httponly'=>true,'samesite'=>'Strict']);
        session_start();
    }
}

function isLoggedIn(): bool
{
    startSession();
    return !empty($_SESSION['user_id']);
}

function currentUserId(): int
{
    startSession();
    return (int)($_SESSION['user_id'] ?? 0);
}

function currentUser(): array
{
    startSession();
    return [
        'id'       => (int)($_SESSION['user_id']  ?? 0),
        'username' => (string)($_SESSION['username'] ?? ''),
        'avatar'   => (string)($_SESSION['avatar']   ?? '🧑'),
    ];
}

function getCsrfToken(): string
{
    startSession();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

// ── Guard helpers ─────────────────────────────────────────────
// Call at top of page files
function requireLogin(): void
{
    startSession();
    if (empty($_SESSION['user_id'])) {
        header('Location: login.php');
        exit;
    }
}

// Call at top of ajax.php (returns JSON 401 if not logged in)
function requireLoginAjax(): int
{
    startSession();
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['success' => false, 'error' => 'Not logged in', 'redirect' => 'login.php'], 401);
    }
    return (int) $_SESSION['user_id'];
}
