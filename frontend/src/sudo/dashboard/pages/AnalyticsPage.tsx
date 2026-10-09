/**
 * Visit stats. Forms chosen per the dataviz method:
 *   - totals → stat tiles (a number, not a chart),
 *   - views per day → single-series column chart (magnitude over time) with a
 *     per-column hover tooltip and a table view,
 *   - breakdowns (mode, device, pages, referrers …) → ranked horizontal bars
 *     with the value labelled at the tip.
 * Single hue (`--chart-mark`, validated against both surfaces) — no legend
 * needed since every chart plots one series named by its title.
 */
import { useState } from "react";

import { useAnalytics } from "@/api/admin";
import type { CountRow } from "@/api/types";
import { humanize } from "@/domain/format";
import { Button } from "@/ui/Button";

import styles from "../Dashboard.module.css";
import chart from "./Charts.module.css";

const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function AnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const stats = useAnalytics(days);
  const s = stats.data;

  return (
    <section className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.pageIntro}>
            Counted without cookies. A visitor is counted once per day, so “visitors” means unique visitor-days.
          </p>
        </div>
        <div className={styles.segmentedFilter} role="group" aria-label="Time range">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {!s ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Page views</span>
              <span className={styles.tileValue}>{compact.format(s.totals.pageviews)}</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Visitors</span>
              <span className={styles.tileValue}>{compact.format(s.totals.visitors)}</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Interactions</span>
              <span className={styles.tileValue}>{compact.format(s.totals.events - s.totals.pageviews)}</span>
              <span className={styles.tileNote}>mode switches, downloads, games…</span>
            </div>
          </div>

          <DailyChart daily={s.daily} />

          <div className={chart.breakdowns}>
            <Ranked title="Presentation mode" rows={s.by_mode} format={humanize} />
            <Ranked title="Device" rows={s.by_device} format={humanize} />
            <Ranked title="Theme" rows={s.by_theme} format={humanize} />
            <Ranked title="Top pages" rows={s.top_paths} />
            <Ranked title="Referrers" rows={s.top_referrers} empty="No external referrers yet." />
            <Ranked title="Interactions" rows={s.events_by_kind} format={humanize} />
            <Ranked title="Games played" rows={s.games} format={humanize} empty="No games played yet." />
          </div>
        </>
      )}
    </section>
  );
}

function DailyChart({ daily }: { daily: { date: string; views: number; visitors: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...daily.map((d) => d.views));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const H = 180;
  const n = daily.length;

  return (
    <figure className={`${styles.panel} ${chart.figure}`}>
      <figcaption className={chart.caption}>
        <span>Page views per day</span>
        <Button size="sm" variant="ghost" onClick={() => setAsTable((t) => !t)}>
          {asTable ? "Show chart" : "Show table"}
        </Button>
      </figcaption>

      {asTable ? (
        <div className={chart.tableWrap}>
          <table className={styles.diff}>
            <thead>
              <tr><th>Date</th><th>Views</th><th>Visitors</th></tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date}><td>{d.date}</td><td>{nf.format(d.views)}</td><td>{nf.format(d.visitors)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={chart.plot}>
          <div className={chart.yAxis} aria-hidden>
            {[...ticks].reverse().map((t) => (
              <span key={t}>{nf.format(t)}</span>
            ))}
          </div>
          <div className={chart.area} style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <span key={t} className={chart.grid} style={{ bottom: `${(t / top) * 100}%` }} aria-hidden />
            ))}
            <ol className={chart.columns} aria-label="Page views per day">
              {daily.map((d, i) => (
                <li key={d.date} className={chart.slot} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}
                  tabIndex={0} aria-label={`${d.date}: ${d.views} views, ${d.visitors} visitors`}>
                  <span className={chart.column} style={{ height: `${(d.views / top) * 100}%` }} data-active={hover === i} />
                </li>
              ))}
            </ol>
            {hover !== null ? (
              <div className={chart.tooltip} role="presentation"
                style={{ left: `${((hover + 0.5) / n) * 100}%` }} data-flip={hover > n * 0.7}>
                <strong>{daily[hover].date}</strong>
                <span>{nf.format(daily[hover].views)} views</span>
                <span>{nf.format(daily[hover].visitors)} visitors</span>
              </div>
            ) : null}
          </div>
          <div className={chart.xAxis} aria-hidden>
            <span>{daily[0]?.date.slice(5)}</span>
            <span>{daily[n - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}
    </figure>
  );
}

function Ranked({
  title,
  rows,
  format = (s) => s,
  empty = "No data yet.",
}: {
  title: string;
  rows: CountRow[];
  format?: (key: string) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={`${styles.panel} ${chart.ranked}`}>
      <h2 className={chart.caption}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        <ul className={chart.bars}>
          {rows.map((r) => (
            <li key={r.key} title={`${format(r.key)}: ${nf.format(r.count)}`}>
              <span className={chart.barLabel}>{format(r.key)}</span>
              <span className={chart.barTrack}>
                <span className={chart.bar} style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className={chart.barValue}>{nf.format(r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 0 plus 3-4 clean tick values covering `max` (1/2/5 × 10^n steps). */
export function niceTicks(max: number): number[] {
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? mag * 10;
  const ticks = [];
  for (let v = 0; v <= max + step - 1e-9; v += step) ticks.push(v);
  return ticks.length > 1 ? ticks : [0, step];
}
