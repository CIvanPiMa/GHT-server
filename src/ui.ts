export const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHT Server — Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0f2f5; color: #222; }
    .card { background: #fff; border-radius: 8px; padding: 36px 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); width: 100%; max-width: 360px; }
    h1 { font-size: 1.3rem; margin: 0 0 4px; }
    p.subtitle { color: #666; font-size: 0.85rem; margin: 0 0 24px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; }
    input[type="password"] { width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 8px 10px; font-size: 0.95rem; margin-bottom: 16px; }
    input[type="password"]:focus { outline: 2px solid #1a73e8; border-color: transparent; }
    button { width: 100%; background: #1a73e8; color: #fff; border: none; border-radius: 4px; padding: 9px; font-size: 0.95rem; cursor: pointer; }
    button:hover { background: #1558b0; }
    .msg-error { color: #c00; font-size: 0.88rem; margin-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>GHT Server</h1>
    <p class="subtitle">Enter the admin password to continue</p>
    <form id="login-form">
      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">Sign in</button>
      <div id="msg" class="msg-error"></div>
    </form>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var pw = document.getElementById('password').value;
      var msgEl = document.getElementById('msg');
      msgEl.textContent = '';
      fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      })
        .then(function(r) { return r.json().then(function(b) { return { ok: r.ok, body: b }; }); })
        .then(function(result) {
          if (result.ok) {
            window.location.href = '/';
          } else {
            msgEl.textContent = result.body.error || 'Login failed.';
          }
        })
        .catch(function() { msgEl.textContent = 'Request failed.'; });
    });
  </script>
</body>
</html>`;

export const UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GHT Server — Games</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 16px; color: #222; }
    h1 { font-size: 1.4rem; margin-bottom: 4px; }
    p.subtitle { color: #666; margin: 0 0 24px; font-size: 0.9rem; }
    .header-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
    .logout-btn { background: none; border: none; color: #1a73e8; font-size: 0.85rem; cursor: pointer; padding: 0; text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
    th { background: #f5f5f5; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
    code { background: #ececec; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
    .empty { color: #aaa; font-style: italic; }
    .msg-error { color: #c00; margin: 8px 0 0; font-size: 0.9rem; }
    .msg-ok { color: #080; margin: 8px 0 0; font-size: 0.9rem; }
    .create-form { display: flex; gap: 8px; align-items: center; margin-bottom: 28px; flex-wrap: wrap; }
    .create-form label { font-weight: 600; font-size: 0.9rem; }
    .create-form input { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; font-size: 0.95rem; width: 220px; }
    .create-form button { background: #1a73e8; color: #fff; border: none; border-radius: 4px; padding: 7px 16px; font-size: 0.95rem; cursor: pointer; }
    .create-form button:hover { background: #1558b0; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 0 0 20px; }
  </style>
</head>
<body>
  <div class="header-row">
    <h1>GHT Server</h1>
    <form method="POST" action="/logout" style="margin:0"><button class="logout-btn" type="submit">Sign out</button></form>
  </div>
  <p class="subtitle">Active games in the database</p>

  <form class="create-form" id="create-form">
    <label for="code-input">New game code</label>
    <input id="code-input" type="text" placeholder="Enter game code" autocomplete="off" required>
    <button type="submit">Create game</button>
  </form>
  <div id="form-msg"></div>

  <hr>
  <div id="root">Loading…</div>

  <script>
    function loadGames() {
      fetch('/games')
        .then(function(r) { return r.json(); })
        .then(function(games) {
          var root = document.getElementById('root');
          if (!games.length) {
            root.innerHTML = '<p class="empty">No games found.</p>';
            return;
          }
          var rows = games.map(function(g) {
            var codesCells = g.codes.length
              ? g.codes.map(function(c) { return '<code>' + c + '</code>'; }).join(' ')
              : '<span class="empty">—</span>';
            return '<tr><td>' + g.id + '</td><td>' + g.revision + '</td><td>' + codesCells + '</td></tr>';
          }).join('');
          root.innerHTML =
            '<table>' +
            '<thead><tr><th>ID</th><th>Revision</th><th>Codes</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>';
        })
        .catch(function() {
          document.getElementById('root').innerHTML = '<p class="msg-error">Failed to load games.</p>';
        });
    }

    document.getElementById('create-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var code = document.getElementById('code-input').value.trim();
      var msgEl = document.getElementById('form-msg');
      if (!code) return;
      fetch('/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      })
        .then(function(r) { return r.json().then(function(body) { return { ok: r.ok, body: body }; }); })
        .then(function(result) {
          if (result.ok) {
            msgEl.className = 'msg-ok';
            msgEl.textContent = 'Game #' + result.body.id + ' created.';
            document.getElementById('code-input').value = '';
            loadGames();
          } else {
            msgEl.className = 'msg-error';
            msgEl.textContent = result.body.error || 'Failed to create game.';
          }
        })
        .catch(function() {
          document.getElementById('form-msg').className = 'msg-error';
          document.getElementById('form-msg').textContent = 'Request failed.';
        });
    });

    loadGames();
  </script>
</body>
</html>`;
