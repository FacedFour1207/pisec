-- 1人プレイの自己ベスト（プレイヤーごとに1行）
CREATE TABLE scores (
  player_id  TEXT PRIMARY KEY,          -- ブラウザごとにランダム生成される ID
  name       TEXT NOT NULL,
  sec        REAL NOT NULL,             -- 自己ベストの記録（秒）
  digits     INTEGER NOT NULL,          -- 小数点以下の一致桁数（整数部が 3 でなければ -1）
  diff       REAL NOT NULL,             -- |sec - π|
  plays      INTEGER NOT NULL DEFAULT 0,
  best_at    INTEGER NOT NULL,          -- 自己ベストを出した時刻（UNIX ミリ秒）
  updated_at INTEGER NOT NULL
);

CREATE INDEX scores_rank ON scores (digits DESC, diff ASC, best_at ASC);
