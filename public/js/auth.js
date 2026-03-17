/**
 * auth.js - 금융상품 가이드 카카오 로그인
 * (cha-biz-ai-v5 패턴, finmarket_db 서버 연동)
 */
(function () {
  'use strict';

  var API_BASE = 'https://aiforalab.com/finmarket-api/api.php';
  var KAKAO_JS_KEY = 'fc0a1313d895b1956f3830e5bf14307b';
  var TOKEN_KEY = 'finmarket_token';
  var USER_KEY = 'finmarket_user';
  var _loginInProgress = false;

  // ── 세션 관리 ──
  function getStoredSession() {
    try {
      var token = localStorage.getItem(TOKEN_KEY);
      var user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      if (token && user) return { token: token, user: user };
    } catch (e) {}
    return null;
  }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ── 카카오 로그인 ──
  function kakaoLogin() {
    if (_loginInProgress) return;
    _loginInProgress = true;

    var btn = document.getElementById('kakao-login-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '로그인 중...';
    }

    try { Kakao.Auth.setAccessToken(null); } catch (e) {}

    var timeout = setTimeout(function () {
      _loginInProgress = false;
      if (btn) { btn.disabled = false; btn.textContent = '카카오 로그인'; }
      alert('로그인 시간이 초과되었습니다. 다시 시도해 주세요.');
    }, 45000);

    Kakao.Auth.login({
      success: function () {
        clearTimeout(timeout);
        proceedWithKakaoUser(btn);
      },
      fail: function (err) {
        clearTimeout(timeout);
        _loginInProgress = false;
        console.error('Kakao login failed:', err);
        if (btn) { btn.disabled = false; btn.textContent = '카카오 로그인'; }
      }
    });
  }

  function proceedWithKakaoUser(resetBtn) {
    Kakao.API.request({
      url: '/v2/user/me',
      success: function (res) {
        var nickname = (res.kakao_account && res.kakao_account.profile && res.kakao_account.profile.nickname) || '사용자';
        var kakaoId = res.id;
        var email = (res.kakao_account && res.kakao_account.email) || null;
        sendLoginToServer(kakaoId, nickname, email, resetBtn);
      },
      fail: function (err) {
        console.error('Kakao user info error:', err);
        _loginInProgress = false;
        if (resetBtn) { resetBtn.disabled = false; resetBtn.textContent = '카카오 로그인'; }
      }
    });
  }

  function sendLoginToServer(kakaoId, nickname, email, resetBtn) {
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'kakao_login', kakao_id: String(kakaoId), nickname: nickname, email: email })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _loginInProgress = false;
      if (data.success) {
        saveSession(data.token, data.user);
        onLoginSuccess(data.user);
      } else {
        console.error('Server login error:', data.error);
        if (resetBtn) { resetBtn.disabled = false; resetBtn.textContent = '카카오 로그인'; }
      }
    })
    .catch(function (err) {
      _loginInProgress = false;
      console.error('Server login fetch error:', err);
      // 서버 실패 시 localStorage 폴백
      var user = { name: nickname, visit_count: 1 };
      saveSession('local', user);
      onLoginSuccess(user);
    });
  }

  // ── 게스트 모드 ──
  function guestLogin() {
    var user = { name: '게스트', visit_count: 0 };
    saveSession('guest', user);
    onLoginSuccess(user);
  }

  // ── 로그인 성공 ──
  function onLoginSuccess(user) {
    closeLoginModal();
    updateUI(user);
    enableAIFeatures();
  }

  // ── 로그아웃 ──
  function logout() {
    try { Kakao.Auth.logout(function () {}); } catch (e) {}
    clearSession();
    disableAIFeatures();
    showLoginModal();
    updateUI(null);
  }

  // ── UI ──
  function updateUI(user) {
    var userBar = document.getElementById('userBar');
    var badge = document.getElementById('user-badge');
    if (user) {
      if (badge) badge.textContent = user.name + (user.visit_count > 1 ? ' · ' + user.visit_count + '회 방문' : '');
      if (userBar) userBar.style.display = 'flex';
    } else {
      if (userBar) userBar.style.display = 'none';
    }
  }

  function enableAIFeatures() {
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.remove('locked');
    document.querySelectorAll('.mode-tab').forEach(function (t) { t.classList.remove('disabled'); });
  }

  function disableAIFeatures() {
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.add('locked');
    document.querySelectorAll('.mode-tab').forEach(function (t) { t.classList.add('disabled'); });
  }

  function showLoginModal() {
    var modal = document.getElementById('login-modal');
    if (modal) {
      modal.classList.add('active');
      var btn = document.getElementById('kakao-login-btn');
      if (btn) { btn.disabled = true; btn.textContent = '카카오 로그인'; }
      document.querySelectorAll('#login-modal input[type="checkbox"]').forEach(function (c) {
        if (!c.disabled) c.checked = false;
      });
    }
  }

  function closeLoginModal() {
    var modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('active');
  }

  // ── 동의 체크박스 ──
  function setupConsent() {
    var allBox = document.getElementById('consent-all');
    var reqBoxes = document.querySelectorAll('.consent-req:not([disabled])');
    var optBoxes = document.querySelectorAll('.consent-opt');
    var allChecks = [].concat(Array.from(reqBoxes), Array.from(optBoxes));
    var kakaoBtn = document.getElementById('kakao-login-btn');

    function updateState() {
      var allReqChecked = Array.from(reqBoxes).every(function (c) { return c.checked; });
      if (kakaoBtn) kakaoBtn.disabled = !allReqChecked;
      if (allBox) allBox.checked = allChecks.every(function (c) { return c.checked; });
    }

    if (allBox) {
      allBox.addEventListener('change', function () {
        allChecks.forEach(function (c) { c.checked = allBox.checked; });
        updateState();
      });
    }
    allChecks.forEach(function (c) { c.addEventListener('change', updateState); });

    var detail = document.getElementById('consent-detail-1');
    if (detail) {
      var detailLabel = detail.previousElementSibling;
      detail.style.display = 'none';
      if (detailLabel) {
        detailLabel.addEventListener('click', function (e) {
          if (e.target.tagName !== 'INPUT') {
            e.preventDefault();
            detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
          }
        });
      }
    }
  }

  // ── 초기화 ──
  function init() {
    if (window.Kakao && !Kakao.isInitialized()) {
      Kakao.init(KAKAO_JS_KEY);
    }

    setupConsent();

    var kakaoBtn = document.getElementById('kakao-login-btn');
    if (kakaoBtn) kakaoBtn.addEventListener('click', kakaoLogin);

    var guestBtn = document.getElementById('login-guest-btn');
    if (guestBtn) guestBtn.addEventListener('click', guestLogin);

    // 기존 세션 확인 → 서버 검증
    var session = getStoredSession();
    if (session && session.token && session.token !== 'guest' && session.token !== 'local') {
      // 서버에 토큰 검증
      fetch(API_BASE + '?action=verify&token=' + encodeURIComponent(session.token))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            saveSession(session.token, data.user);
            onLoginSuccess(data.user);
          } else {
            clearSession();
            disableAIFeatures();
            setTimeout(showLoginModal, 1500);
          }
        })
        .catch(function () {
          // 서버 불통 시 로컬 세션으로 진행
          onLoginSuccess(session.user);
        });
    } else if (session) {
      // 게스트/로컬 세션
      onLoginSuccess(session.user);
    } else {
      disableAIFeatures();
      setTimeout(showLoginModal, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.finmarketAuth = {
    logout: logout,
    getUser: function () { var s = getStoredSession(); return s ? s.user : null; },
    getToken: function () { return localStorage.getItem(TOKEN_KEY); }
  };
})();
