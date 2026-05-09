<?php
// ============================================================
// HABBITO — auth.php   (login / register — JSON POST only)
// ============================================================
declare(strict_types=1);
require_once __DIR__ . '/config.php';

startSession();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'error' => 'POST only'], 405);
}

$body   = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$action = clean($body['action'] ?? '');

try {
    if ($action === 'login')    doLogin($body);
    elseif ($action === 'register') doRegister($body);
    else jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
} catch (PDOException $e) {
    jsonResponse(['success' => false, 'error' => APP_ENV === 'development' ? $e->getMessage() : 'Database error'], 500);
}

// ─────────────────────────────────────────────
function doLogin(array $b): never
{
    $id  = trim($b['identifier'] ?? '');
    $pw  = $b['password']        ?? '';
    $rem = !empty($b['remember']);

    if (!$id || !$pw) {
        jsonResponse(['success' => false, 'errors' => ['Please fill in all fields.']]);
    }

    // Rate limit — 8 tries per minute per IP
    $rk = 'rl_' . md5($_SERVER['REMOTE_ADDR'] ?? '0');
    if (!isset($_SESSION[$rk]) || time() - $_SESSION[$rk]['t'] > 60) {
        $_SESSION[$rk] = ['n' => 0, 't' => time()];
    }
    if (++$_SESSION[$rk]['n'] > 8) {
        jsonResponse(['success' => false, 'errors' => ['Too many attempts. Wait a minute and try again.']]);
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, username, password_hash, avatar_emoji FROM users WHERE email = :id OR username = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $user = $stmt->fetch();

    // Always call password_verify to prevent timing attacks
    $hash = $user ? $user['password_hash'] : '$2y$10$invaliddummyhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    if (!$user || !password_verify($pw, $hash)) {
        jsonResponse(['success' => false, 'errors' => ['Incorrect username / email or password.']]);
    }

    // Success — start session
    unset($_SESSION[$rk]);
    session_regenerate_id(true);
    $_SESSION['user_id']  = (int) $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['avatar']   = $user['avatar_emoji'];
    $_SESSION['csrf']     = bin2hex(random_bytes(32));

    if ($rem) {
        $p = session_get_cookie_params();
        setcookie(session_name(), session_id(), time() + 86400 * 30, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }

    $db->prepare('UPDATE users SET last_login = NOW() WHERE id = :id')->execute([':id' => $user['id']]);

    jsonResponse(['success' => true, 'redirect' => 'index.php']);
}

// ─────────────────────────────────────────────
function doRegister(array $b): never
{
    $username = clean($b['username'] ?? '', 50);
    $email    = strtolower(trim($b['email']    ?? ''));
    $password = $b['password'] ?? '';
    $confirm  = $b['confirm']  ?? '';

    $errors = [];
    if (strlen($username) < 3)                          $errors[] = 'Username must be at least 3 characters.';
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $username)) $errors[] = 'Username may only use letters, numbers, _ and -.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))     $errors[] = 'Enter a valid email address.';
    if (strlen($password) < 8)                          $errors[] = 'Password must be at least 8 characters.';
    if ($password !== $confirm)                         $errors[] = 'Passwords do not match.';
    if ($errors) jsonResponse(['success' => false, 'errors' => $errors]);

    $db   = getDB();
    $stmt = $db->prepare('SELECT SUM(username=:u) AS u_taken, SUM(email=:e) AS e_taken FROM users');
    $stmt->execute([':u' => $username, ':e' => $email]);
    $taken = $stmt->fetch();

    if ((int)$taken['u_taken']) jsonResponse(['success' => false, 'errors' => ['That username is already taken.']]);
    if ((int)$taken['e_taken']) jsonResponse(['success' => false, 'errors' => ['An account with that email already exists.']]);

    $hash    = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $avatars = ['🧑','🦊','🐼','🐧','🦁','🐺','🦋','🌟','🚀','🎯','💎','🔮'];
    $avatar  = $avatars[array_rand($avatars)];

    $db->prepare('INSERT INTO users (username, email, password_hash, avatar_emoji) VALUES (:u,:e,:h,:a)')
       ->execute([':u' => $username, ':e' => $email, ':h' => $hash, ':a' => $avatar]);
    $newId = (int) $db->lastInsertId();

    // Create stats row for new user
    $db->prepare('INSERT INTO user_stats (user_id, total_xp, `level`, daily_streak) VALUES (:uid,0,1,0)')
       ->execute([':uid' => $newId]);

    // Log them in immediately
    session_regenerate_id(true);
    $_SESSION['user_id']  = $newId;
    $_SESSION['username'] = $username;
    $_SESSION['avatar']   = $avatar;
    $_SESSION['csrf']     = bin2hex(random_bytes(32));

    jsonResponse(['success' => true, 'redirect' => 'index.php']);
}
