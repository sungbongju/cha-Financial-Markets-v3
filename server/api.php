<?php
/**
 * finmarket-api - 금융상품 가이드 API
 * (business-api 패턴 기반, finmarket_db 사용)
 */
date_default_timezone_set('Asia/Seoul');
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
$allowed_origins = array(
    'https://sungbongju.github.io',
    'https://sdkparkforbi.github.io',
    'https://aiforalab.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'https://cha-financial-markets.vercel.app',
    'https://cha-financial-markets-v2.vercel.app'
);
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// DB
$db_host = 'localhost';
$db_name = 'finmarket_db';
$db_user = 'user2';
$db_pass = 'user2!!';
$JWT_SECRET = 'finmarket_jwt_secret_2026_cha';

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user, $db_pass,
        array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC)
    );
} catch (PDOException $e) {
    echo json_encode(array('success' => false, 'error' => 'DB connection failed'));
    exit;
}

// Routing
$action = '';
$input = array();
if (isset($_GET['action'])) $action = $_GET['action'];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) $input = array();
    if (!$action && isset($input['action'])) $action = $input['action'];
} else {
    $input = $_GET;
}

switch ($action) {
    case 'health':
        echo json_encode(array('status' => 'ok', 'service' => 'Finmarket API'));
        break;
    case 'kakao_login':
        handleKakaoLogin($pdo, $input);
        break;
    case 'verify':
        handleVerify($pdo, $input);
        break;
    case 'log_event':
        handleLogEvent($pdo, $input);
        break;
    case 'log_batch':
        handleLogBatch($pdo, $input);
        break;
    case 'save_chat':
        handleSaveChat($pdo, $input);
        break;
    default:
        echo json_encode(array('success' => false, 'error' => 'Unknown action: ' . $action));
}

// JWT
function createJWT($userId, $secret) {
    $header = base64_encode(json_encode(array('typ' => 'JWT', 'alg' => 'HS256')));
    $payload = base64_encode(json_encode(array('user_id' => $userId, 'exp' => time() + 86400 * 7)));
    $sig = base64_encode(hash_hmac('sha256', "$header.$payload", $secret, true));
    return "$header.$payload.$sig";
}

function verifyJWT($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    $sig = base64_encode(hash_hmac('sha256', $parts[0] . '.' . $parts[1], $secret, true));
    if ($sig !== $parts[2]) return null;
    $payload = json_decode(base64_decode($parts[1]), true);
    if (!$payload || $payload['exp'] < time()) return null;
    return $payload;
}

function getUserFromToken($pdo, $input) {
    global $JWT_SECRET;
    $token = '';
    if (isset($input['token'])) $token = $input['token'];
    if (!$token && isset($_GET['token'])) $token = $_GET['token'];
    if (!$token) return null;
    $payload = verifyJWT($token, $JWT_SECRET);
    if (!$payload) return null;
    return $payload;
}

// ── Kakao Login ──
function handleKakaoLogin($pdo, $input) {
    global $JWT_SECRET;
    $kakao_id = isset($input['kakao_id']) ? trim($input['kakao_id']) : '';
    $nickname = isset($input['nickname']) ? trim($input['nickname']) : '';
    $email    = isset($input['email'])    ? trim($input['email'])    : null;

    if (empty($kakao_id) || empty($nickname)) {
        echo json_encode(array('success' => false, 'error' => 'kakao_id and nickname required'));
        return;
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE kakao_id = ?');
    $stmt->execute(array($kakao_id));
    $user = $stmt->fetch();

    if ($user) {
        $pdo->prepare('UPDATE users SET visit_count = visit_count + 1, last_login = NOW(), name = ?, email = ? WHERE kakao_id = ?')
            ->execute(array($nickname, $email, $kakao_id));
        $stmt = $pdo->prepare('SELECT * FROM users WHERE kakao_id = ?');
        $stmt->execute(array($kakao_id));
        $user = $stmt->fetch();
    } else {
        $stmt = $pdo->prepare('INSERT INTO users (kakao_id, name, email, visit_count, last_login) VALUES (?, ?, ?, 1, NOW())');
        $stmt->execute(array($kakao_id, $nickname, $email));
        $user = array('id' => $pdo->lastInsertId(), 'kakao_id' => $kakao_id, 'name' => $nickname, 'visit_count' => 1);
    }

    $token = createJWT($user['id'], $JWT_SECRET);
    echo json_encode(array(
        'success' => true,
        'token' => $token,
        'user' => array(
            'id' => $user['id'],
            'name' => $user['name'],
            'visit_count' => intval($user['visit_count'])
        )
    ));
}

// ── Verify Token ──
function handleVerify($pdo, $input) {
    $payload = getUserFromToken($pdo, $input);
    if (!$payload) {
        echo json_encode(array('success' => false, 'error' => 'Invalid token'));
        return;
    }
    $stmt = $pdo->prepare('SELECT id, name, visit_count FROM users WHERE id = ?');
    $stmt->execute(array($payload['user_id']));
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(array('success' => false, 'error' => 'User not found'));
        return;
    }
    echo json_encode(array('success' => true, 'user' => $user));
}

// ── Log Event ──
function handleLogEvent($pdo, $input) {
    $payload = getUserFromToken($pdo, $input);
    if (!$payload) { echo json_encode(array('success' => false, 'error' => 'Auth required')); return; }

    $stmt = $pdo->prepare('INSERT INTO user_logs (user_id, session_id, event_type, section_id, duration_sec, detail) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute(array(
        $payload['user_id'],
        isset($input['session_id']) ? $input['session_id'] : 'default',
        isset($input['event_type']) ? $input['event_type'] : 'page_view',
        isset($input['section_id']) ? $input['section_id'] : null,
        isset($input['duration_sec']) ? intval($input['duration_sec']) : 0,
        isset($input['detail']) ? $input['detail'] : null
    ));
    echo json_encode(array('success' => true));
}

// ── Log Batch ──
function handleLogBatch($pdo, $input) {
    $payload = getUserFromToken($pdo, $input);
    if (!$payload) { echo json_encode(array('success' => false, 'error' => 'Auth required')); return; }

    $events = isset($input['events']) ? $input['events'] : array();
    $count = 0;
    $stmt = $pdo->prepare('INSERT INTO user_logs (user_id, session_id, event_type, section_id, duration_sec, detail) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($events as $ev) {
        $stmt->execute(array(
            $payload['user_id'],
            isset($ev['session_id']) ? $ev['session_id'] : 'default',
            isset($ev['event_type']) ? $ev['event_type'] : 'page_view',
            isset($ev['section_id']) ? $ev['section_id'] : null,
            isset($ev['duration_sec']) ? intval($ev['duration_sec']) : 0,
            isset($ev['detail']) ? $ev['detail'] : null
        ));
        $count++;
    }
    echo json_encode(array('success' => true, 'logged' => $count));
}

// ── Save Chat ──
function handleSaveChat($pdo, $input) {
    $payload = getUserFromToken($pdo, $input);
    if (!$payload) { echo json_encode(array('success' => false, 'error' => 'Auth required')); return; }

    $messages = isset($input['messages']) ? $input['messages'] : array();
    $sessionId = isset($input['session_id']) ? $input['session_id'] : null;
    $stmt = $pdo->prepare('INSERT INTO chat_history (user_id, session_id, role, content) VALUES (?, ?, ?, ?)');
    foreach ($messages as $msg) {
        $stmt->execute(array($payload['user_id'], $sessionId, $msg['role'], $msg['content']));
    }
    echo json_encode(array('success' => true));
}
?>
