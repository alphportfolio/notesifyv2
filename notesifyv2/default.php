<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Notesify — Redirecting…</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', sans-serif;
      background: #0a0a0a;
      color: #e8e8e8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spinner {
      width: 28px; height: 28px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>

  <script>
    (function () {
      var params  = new URLSearchParams(window.location.search);
      var mode    = params.get('mode');
      var oobCode = params.get('oobCode');
      var apiKey  = params.get('apiKey');
      var lang    = params.get('lang') || 'en';

      // Build the query string to forward
      var qs = '?mode=' + encodeURIComponent(mode || '')
             + '&oobCode=' + encodeURIComponent(oobCode || '')
             + '&apiKey=' + encodeURIComponent(apiKey || '')
             + '&lang=' + encodeURIComponent(lang);

      if (mode === 'verifyEmail') {
        window.location.replace('verify.html' + qs);
      } else if (mode === 'resetPassword') {
        window.location.replace('reset-password.html' + qs);
      } else if (mode === 'recoverEmail') {
        // Optional: handle email recovery if you ever use it
        window.location.replace('login.html' + qs);
      } else {
        // No recognised mode — go to home
        window.location.replace('index.html');
      }
    })();
  </script>
</body>
</html>