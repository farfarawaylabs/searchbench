import type {
  HistoryItem,
  JudgeOutput,
  ProviderResult,
  Run,
  SearchMode,
} from "../shared/schemas";

interface RunRow {
  id: string;
  query: string;
  provider_ids: string;
  num_results: number;
  mode: SearchMode | null;
  results: string;
  judge: string | null;
  judge_error: string | null;
  created_at: string;
}

function rowToRun(row: RunRow): Run {
  const run: Run = {
    id: row.id,
    query: row.query,
    createdAt: row.created_at,
    numResults: row.num_results,
    mode: row.mode ?? "web",
    providerRuns: JSON.parse(row.results) as Record<string, ProviderResult>,
  };
  if (row.judge) {
    try {
      run.judge = JSON.parse(row.judge) as JudgeOutput;
    } catch {
      run.judgeError = "Stored judge output was corrupt.";
    }
  } else if (row.judge_error) {
    run.judgeError = row.judge_error;
  }
  return run;
}

export async function saveRun(db: D1Database, run: Run): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runs (id, query, provider_ids, num_results, mode, results, judge, judge_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      run.id,
      run.query,
      JSON.stringify(Object.keys(run.providerRuns)),
      run.numResults,
      run.mode,
      JSON.stringify(run.providerRuns),
      run.judge ? JSON.stringify(run.judge) : null,
      run.judgeError ?? null,
      run.createdAt,
    )
    .run();
}

export async function getRun(db: D1Database, id: string): Promise<Run | null> {
  const row = await db
    .prepare(`SELECT * FROM runs WHERE id = ?`)
    .bind(id)
    .first<RunRow>();
  return row ? rowToRun(row) : null;
}

export async function listRuns(db: D1Database, limit: number): Promise<HistoryItem[]> {
  const { results } = await db
    .prepare(
      `SELECT id, query, provider_ids, num_results, mode, judge, created_at
       FROM runs ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(Math.min(Math.max(limit, 1), 100))
    .all<Pick<RunRow, "id" | "query" | "provider_ids" | "mode" | "judge" | "created_at">>();
  return results.map((row) => {
    let winnerId: string | null = null;
    let winnerScore: number | null = null;
    if (row.judge) {
      try {
        const judge = JSON.parse(row.judge) as JudgeOutput;
        const top = judge.overall.slice().sort((a, b) => b.score - a.score)[0];
        if (top) {
          winnerId = top.providerId;
          winnerScore = top.score;
        }
      } catch {
        // corrupt judge JSON — leave winner blank
      }
    }
    let providerIds: string[] = [];
    try {
      providerIds = JSON.parse(row.provider_ids) as string[];
    } catch {
      providerIds = [];
    }
    return {
      id: row.id,
      query: row.query,
      providerIds,
      createdAt: row.created_at,
      mode: row.mode ?? "web",
      winnerId,
      winnerScore,
    };
  });
}

export async function deleteRun(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare(`DELETE FROM runs WHERE id = ?`).bind(id).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function updateJudge(
  db: D1Database,
  id: string,
  judge: JudgeOutput | null,
  judgeError: string | null,
): Promise<void> {
  await db
    .prepare(`UPDATE runs SET judge = ?, judge_error = ? WHERE id = ?`)
    .bind(judge ? JSON.stringify(judge) : null, judgeError, id)
    .run();
}
