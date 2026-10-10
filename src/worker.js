// π秒見積もり: 静的ファイル（public/）の配信と、1人プレイの自己ベストランキング API。
//
//   GET  /api/scores?limit=100&me=<playerId>  ランキング上位と自分の順位
//   POST /api/scores  { playerId, name, sec }  記録を送信（自己ベストなら更新）

const DECIMALS = 6;
const PI_FRAC = "14159265358979323846";
const MAX_LIMIT = 200;

// 小数点以下何桁 π と一致するか（フロントエンドと同じ判定）
function judge(sec) {
  const [ip, fp] = sec.toFixed(DECIMALS).split(".");
  let digits = -1;
  if (ip === "3") {
    digits = 0;
    while (digits < fp.length && fp[digits] === PI_FRAC[digits]) digits++;
  }
  return { digits, diff: Math.abs(sec - Math.PI) };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// 自分より上にいる人数 + 1
async function rankOf(db, playerId) {
  const me = await db.prepare("SELECT digits, diff, best_at FROM scores WHERE player_id = ?").bind(playerId).first();
  if (!me) return null;
  const { n } = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM scores
       WHERE digits > ?1 OR (digits = ?1 AND (diff < ?2 OR (diff = ?2 AND best_at < ?3)))`
    )
    .bind(me.digits, me.diff, me.best_at)
    .first();
  return n + 1;
}

async function getScores(url, env) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit"), 10) || 100, 1), MAX_LIMIT);
  const me = url.searchParams.get("me") || "";
  const { results } = await env.DB
    .prepare(
      `SELECT player_id, name, sec, digits, plays, best_at FROM scores
       ORDER BY digits DESC, diff ASC, best_at ASC LIMIT ?`
    )
    .bind(limit)
    .all();
  const { total } = await env.DB.prepare("SELECT COUNT(*) AS total FROM scores").first();
  // player_id は書き込みの鍵になるので外には出さず、自分かどうかだけ返す
  const scores = results.map(({ player_id, ...r }) => ({ ...r, me: !!me && player_id === me }));
  const mine = me
    ? await env.DB.prepare("SELECT name, sec, digits, plays, best_at FROM scores WHERE player_id = ?").bind(me).first()
    : null;
  return json({ total, scores, me: mine ? { ...mine, rank: await rankOf(env.DB, me) } : null });
}

async function postScore(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
  const playerId = String(body.playerId || "");
  const name = String(body.name || "").trim().slice(0, 20) || "名無し";
  const sec = Number(body.sec);
  if (!/^[0-9a-f]{32}$/.test(playerId)) return json({ error: "invalid playerId" }, 400);
  if (!(sec > 0 && sec < 60)) return json({ error: "invalid sec" }, 400);

  const { digits, diff } = judge(sec);
  const now = Date.now();
  const prev = await env.DB.prepare("SELECT digits, diff FROM scores WHERE player_id = ?").bind(playerId).first();
  const isBest = !prev || digits > prev.digits || (digits === prev.digits && diff < prev.diff);

  // 名前とプレイ回数は毎回更新、記録は自己ベストのときだけ更新
  await env.DB
    .prepare(
      `INSERT INTO scores (player_id, name, sec, digits, diff, plays, best_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)
       ON CONFLICT (player_id) DO UPDATE SET
         name = excluded.name,
         plays = scores.plays + 1,
         updated_at = excluded.updated_at,
         sec     = CASE WHEN ?7 THEN excluded.sec    ELSE scores.sec    END,
         digits  = CASE WHEN ?7 THEN excluded.digits ELSE scores.digits END,
         diff    = CASE WHEN ?7 THEN excluded.diff   ELSE scores.diff   END,
         best_at = CASE WHEN ?7 THEN excluded.best_at ELSE scores.best_at END`
    )
    .bind(playerId, name, sec, digits, diff, now, isBest ? 1 : 0)
    .run();

  const mine = await env.DB.prepare("SELECT name, sec, digits, plays, best_at FROM scores WHERE player_id = ?").bind(playerId).first();
  const { total } = await env.DB.prepare("SELECT COUNT(*) AS total FROM scores").first();
  return json({ isBest, total, me: { ...mine, rank: await rankOf(env.DB, playerId) } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/scores") {
      if (request.method === "GET") return getScores(url, env);
      if (request.method === "POST") return postScore(request, env);
      return json({ error: "method not allowed" }, 405);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
