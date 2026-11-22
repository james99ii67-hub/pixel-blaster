// Sites dispatch authenticates visitors before forwarding requests to this Worker.
function accountPanel(request, env) {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  if (!userId) {
    return '<nav class="account-panel" aria-label="帳號"><a target="_top" href="/signin-with-chatgpt">使用 ChatGPT 登入</a></nav>';
  }

  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const testerEmail = env.PIXEL_TESTER_EMAIL?.trim().toLowerCase();
  const tester = Boolean(testerEmail && email === testerEmail);
  const status = tester
    ? `<strong>測試帳號 · 全武器已解鎖</strong>
      <label>測試關卡<select id="test-level"></select></label>
      <div class="developer-controls" role="group" aria-label="開發測試">
        <button id="test-invincible" type="button" aria-label="無敵" aria-pressed="false">無敵｜關</button>
        <button id="test-domain-cooldown" type="button" aria-label="領域無冷卻" aria-pressed="false">領域無冷卻｜關</button>
        <button id="test-ultimate-cooldown" type="button" aria-label="必殺技無冷卻" aria-pressed="false">必殺技無冷卻｜關</button>
      </div>`
    : '<span>已登入 · 一般玩家</span>';
  return `<nav class="account-panel" aria-label="帳號">${status}<a href="/signout-with-chatgpt" target="_top">登出</a></nav>`;
}

export function createGameWorker(files) {
  return {
    fetch(request, env) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      const path = new URL(request.url).pathname;
      let body, type;
      const headers = { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };
      if (path === "/" || path === "/index.html") {
        body = files.html.replace("<!-- site-account -->", accountPanel(request, env));
        type = "text/html";
        headers["Cache-Control"] = "private, no-store";
      } else if (path === "/game.js" || path === "/style.css") {
        const script = path === "/game.js";
        body = script ? files.js : files.css;
        type = script ? "text/javascript" : "text/css";
        headers["Cache-Control"] = "public, max-age=0, must-revalidate";
      } else {
        return new Response(null, { status: 404, headers });
      }
      headers["Content-Type"] = type + "; charset=utf-8";
      return new Response(request.method === "HEAD" ? null : body, { headers });
    }
  };
}
