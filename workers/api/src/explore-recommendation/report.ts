import { settings } from './repository';

interface Group {
  experiment: string;
  variant: string;
  exposedVisitors: number;
  openedVisitors: number;
  exposures: number;
  opens: number;
  loaded: number;
  errors: number;
  dismisses: number;
  favorites: number;
  sessions: number;
  returningVisitors: number;
  firstEvent: number;
}
const ratio = (n: number, d: number) => (d ? n / d : null);

/** Aggregate visitors before comparing groups: repeated swipes aren't independent samples. */
export async function recommendationReport(db: D1Database) {
  const config = await settings(db);
  const [events, groups, algorithms, calls, index, budget, age] = await db.batch([
    db
      .prepare(
        `SELECT experiment,variant,action,COUNT(*) AS events,COUNT(DISTINCT subject) AS visitors,
      COUNT(DISTINCT subject || ':' || session) AS sessions,COUNT(DISTINCT batch_id || ':' || project_id) AS works
      FROM explore_rec_events WHERE created_at>? GROUP BY experiment,variant,action`
      )
      .bind(Date.now() - 7 * 86400000),
    db
      .prepare(
        `WITH visitors AS (
      SELECT experiment,variant,subject,
        MAX(action='exposure') AS exposed, MAX(action='open') AS opened,
        SUM(action='exposure') AS exposures,SUM(action='open') AS opens,SUM(action='loaded') AS loaded,
        SUM(action='load_error') AS errors,SUM(action='dismiss') AS dismisses,SUM(action='favorite') AS favorites,
        COUNT(DISTINCT session) AS sessions,COUNT(DISTINCT date(created_at/1000,'unixepoch')) AS days,
        MIN(created_at) AS firstEvent
      FROM explore_rec_events WHERE created_at>? GROUP BY experiment,variant,subject)
      SELECT experiment,variant,SUM(exposed) AS exposedVisitors,SUM(exposed*opened) AS openedVisitors,
        SUM(exposures) AS exposures,SUM(opens) AS opens,SUM(loaded) AS loaded,SUM(errors) AS errors,
        SUM(dismisses) AS dismisses,SUM(favorites) AS favorites,SUM(sessions) AS sessions,
        SUM(days>1) AS returningVisitors,MIN(firstEvent) AS firstEvent
      FROM visitors GROUP BY experiment,variant`
      )
      .bind(Date.now() - 7 * 86400000),
    db
      .prepare(
        `SELECT experiment,variant,algorithm,action,COUNT(*) AS events FROM explore_rec_events
      WHERE created_at>? GROUP BY experiment,variant,algorithm,action`
      )
      .bind(Date.now() - 7 * 86400000),
    db
      .prepare(
        `SELECT kind,model,status,COUNT(*) AS calls,COALESCE(SUM(actual_micro),0) AS actual_micro,
      SUM(reserved_micro) AS reserved_micro,SUM(status='success' AND input_tokens IS NULL) AS unknown_usage_calls,AVG(latency_ms) AS mean_ms FROM explore_rec_calls
      WHERE month=? GROUP BY kind,model,status`
      )
      .bind(new Date().toISOString().slice(0, 7)),
    db.prepare(
      'SELECT model,COUNT(*) AS indexed FROM explore_rec_features WHERE vector IS NOT NULL GROUP BY model'
    ),
    db
      .prepare('SELECT * FROM explore_rec_budget WHERE month=?')
      .bind(new Date().toISOString().slice(0, 7)),
    db
      .prepare(
        "SELECT MIN(created_at) AS firstEvent FROM explore_rec_events WHERE experiment=? AND variant IN ('control','treatment')"
      )
      .bind(config.experiment),
  ]);
  const rows = groups.results as unknown as Group[];
  const control = rows.find((g) => g.experiment === config.experiment && g.variant === 'control');
  const treatment = rows.find(
    (g) => g.experiment === config.experiment && g.variant === 'treatment'
  );
  let decision = 'insufficient-sample';
  let comparison: Record<string, number | null> | null = null;
  if (control?.exposedVisitors && treatment?.exposedVisitors) {
    const c = control.openedVisitors / control.exposedVisitors;
    const t = treatment.openedVisitors / treatment.exposedVisitors;
    const difference = t - c;
    const margin =
      1.96 *
      Math.sqrt(
        (t * (1 - t)) / treatment.exposedVisitors + (c * (1 - c)) / control.exposedVisitors
      );
    comparison = {
      controlOpenRate: c,
      treatmentOpenRate: t,
      relativeGain: c ? difference / c : null,
      difference,
      lower95: difference - margin,
      upper95: difference + margin,
    };
    const sufficient =
      control.exposedVisitors >= 300 &&
      treatment.exposedVisitors >= 300 &&
      Date.now() - Number((age.results[0] as { firstEvent: number }).firstEvent) >= 7 * 86400000;
    const errorDifference =
      (ratio(treatment.errors, treatment.opens) || 0) - (ratio(control.errors, control.opens) || 0);
    const dismissDifference =
      (ratio(treatment.dismisses, treatment.exposures) || 0) -
      (ratio(control.dismisses, control.exposures) || 0);
    if (
      control.opens >= 50 &&
      treatment.opens >= 50 &&
      (errorDifference > 0.02 || dismissDifference > 0.02)
    )
      decision = 'pause-guardrail';
    else if (sufficient)
      decision =
        difference - margin > 0 && c > 0 && difference / c >= 0.1
          ? 'eligible-for-review'
          : 'keep-local-or-stop';
  }
  return {
    settings: config,
    windowDays: 7,
    events: events.results,
    groups: rows.map((g) => ({
      ...g,
      visitorOpenRate: ratio(g.openedVisitors, g.exposedVisitors),
      opensPerExposure: ratio(g.opens, g.exposures),
      loadErrorRate: ratio(g.errors, g.opens),
      dismissRate: ratio(g.dismisses, g.exposures),
      favoritesPer1000Exposures: ratio(g.favorites * 1000, g.exposures),
    })),
    algorithms: algorithms.results,
    calls: calls.results,
    index: index.results,
    budget: budget.results,
    comparison,
    decision,
    rules: {
      primary: 'Visitor open rate; intention-to-treat includes fallback. Manual modes excluded.',
      minimum:
        '300 exposed visitors in each group; at least 7 days; one review per completed weekly window.',
      promote:
        'Relative gain >=10%, 95% difference lower bound >0, no guardrail breach; requires review, never auto-expands.',
      pause:
        'After 50 opens in each group, load errors or dismisses increase by >2 percentage points.',
      incomplete:
        'Insufficient sample is not success. Review again after the next complete weekly window.',
    },
    interpretation:
      'Only remembered visitors are measured. UTC returning visits are descriptive, not causal retention proof. Descriptions, opens and iframe loads do not prove learning or playability. Reserved cost includes unknown/failed calls; known actual cost is only reported usage, not the Cloudflare invoice.',
  };
}
