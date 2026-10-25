"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Fund, MpfData, N } from "./types";

const EPS = 1e-6;
const fmt = (v: N | undefined, d = 2) => (v == null ? "—" : (v > EPS ? "+" : "") + v.toFixed(d) + "%");
const tone = (v: N | undefined) => (v == null || Math.abs(v) < EPS ? "text-slate-500 dark:text-slate-400" : v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");
const cellBg = (v: N | undefined) => (v == null || Math.abs(v) < EPS ? "" : v > 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/40");
const UP = "#10b981", DOWN = "#ef4444", FLAT = "#94a3b8";
const barColor = (v: number) => (v > EPS ? UP : v < -EPS ? DOWN : FLAT);
const shortName = (f: Fund) => f.name_zh.replace("永明強積金", "").replace("永明", "") + (f.class !== "--" ? ` ${f.class}` : "");
const typeOf = (f: Fund) => (f.category_zh || "").split("基金")[0];
const shortDate = (d: string) => { const p = d.split("-"); return `${Number(p[1])}/${Number(p[2])}`; };

function Card({ title, sub, right, children, className = "" }: { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>{title && <h2 className="text-lg font-semibold">{title}</h2>}{sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}</div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => { const n = !dark; setDark(n); document.documentElement.classList.toggle("dark", n); try { localStorage.setItem("theme", n ? "dark" : "light"); } catch {} };
  return { dark, toggle };
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`rounded-lg px-3 py-1.5 text-sm transition ${value === o.value ? "bg-white font-medium shadow dark:bg-slate-950" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>{o.label}</button>
      ))}
    </div>
  );
}
const selCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";

function PriceChart({ data, fund, dark, height = 240 }: { data: MpfData; fund: Fund; dark: boolean; height?: number }) {
  const pts = data.history_dates.map((d, i) => ({ d: d ?? "", nav: fund.history[i] })).filter((p) => p.nav != null);
  const grid = dark ? "#1e293b" : "#e2e8f0", tick = dark ? "#94a3b8" : "#64748b";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={pts} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="d" tick={{ fontSize: 11, fill: tick }} tickFormatter={(d: string) => d.slice(2, 7)} minTickGap={24} />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: tick }} tickFormatter={(v: number) => v.toFixed(2)} width={52} />
        <Tooltip contentStyle={{ background: dark ? "#0f172a" : "#fff", border: `1px solid ${grid}`, borderRadius: 8 }} formatter={(v: number) => [`HK$ ${v.toFixed(4)}`, "單位價格"]} labelFormatter={(l: string) => `估值日 ${l}`} />
        <Line type="monotone" dataKey="nav" stroke="#6366f1" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DivBarChart({ items, dark, height }: { items: { label: string; value: number }[]; dark: boolean; height?: number }) {
  const tick = dark ? "#94a3b8" : "#64748b";
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, items.length * 26)}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: tick }} tickFormatter={(v: number) => v.toFixed(1) + "%"} />
        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: tick }} interval={0} />
        <ReferenceLine x={0} stroke={tick} />
        <Tooltip cursor={{ fill: dark ? "#1e293b" : "#f1f5f9" }} contentStyle={{ background: dark ? "#0f172a" : "#fff", borderRadius: 8 }} formatter={(v: number) => [fmt(v), "升跌"]} />
        <Bar dataKey="value" radius={[3, 3, 3, 3]} label={{ position: "right", fontSize: 11, fill: tick, formatter: (v: number) => fmt(v) }}>
          {items.map((x) => <Cell key={x.label} fill={barColor(x.value)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Daily30({ data }: { data: MpfData }) {
  const dates = data.daily_dates ?? [];
  // newest first for display
  const datesDesc = [...dates].reverse();
  const [type, setType] = useState("全部");
  const [cls, setCls] = useState("A/無類別");
  const [open, setOpen] = useState<string | null>(null);
  const types = ["全部", ...Array.from(new Set(data.funds.map(typeOf)))];
  const funds = useMemo(() => data.funds.filter((f) => (type === "全部" || typeOf(f) === type) && (cls === "全部" || (cls === "A/無類別" ? f.class !== "B" : f.class === cls))), [data.funds, type, cls]);

  const changeAt = (f: Fund, dateIdxAsc: number): N => {
    const series = f.daily ?? [];
    const cur = series[dateIdxAsc];
    const prev = dateIdxAsc > 0 ? series[dateIdxAsc - 1] : null;
    if (cur == null || prev == null) return null;
    return ((cur / prev) - 1) * 100;
  };

  if (!dates.length) {
    return <Card title="30日單價"><p className="text-sm text-slate-500">尚未有每日單價紀錄，請稍候下次自動更新。</p></Card>;
  }

  return (
    <div className="space-y-6">
      <Card title="最近交易日單位價格" sub={`${dates[0]} 至 ${dates[dates.length - 1]}・共 ${dates.length} 個交易日（最多 30 日）。綠色 = 較前一日上升，紅色 = 下跌。左右滑動可睇晒所有日期；手機可點基金名稱展開詳情。`}>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-xs text-slate-500">基金類型<br /><select className={selCls} value={type} onChange={(e) => setType(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-slate-500">單位類別<br /><select className={selCls} value={cls} onChange={(e) => setCls(e.target.value)}>{["A/無類別", "全部", "A", "B", "--"].map((c) => <option key={c} value={c}>{c === "--" ? "無類別" : c}</option>)}</select></label>
        </div>

        {/* Desktop / tablet: sticky-column matrix, newest dates on the left */}
        <div className="hidden overflow-x-auto sm:block -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-white px-3 py-2 text-left font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">基金</th>
                {datesDesc.map((d) => (
                  <th key={d} className="whitespace-nowrap px-2 py-2 text-center font-medium text-slate-500 dark:text-slate-400">{shortDate(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => (
                <tr key={f.code} className="group">
                  <td className="sticky left-0 z-10 max-w-[140px] truncate border-b border-slate-100 bg-white px-3 py-1.5 text-left font-medium dark:border-slate-800 dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60" title={f.name_zh}>
                    {shortName(f)}{f.is_dis ? " ⭐" : ""}
                  </td>
                  {datesDesc.map((d) => {
                    const iAsc = dates.indexOf(d);
                    const nav = f.daily?.[iAsc] ?? null;
                    const ch = changeAt(f, iAsc);
                    return (
                      <td key={d} className={`border-b border-slate-100 px-2 py-1.5 text-center tabular-nums dark:border-slate-800 ${cellBg(ch)}`} title={ch == null ? d : `${d}：${fmt(ch)}`}>
                        <span className={`font-medium ${tone(ch)}`}>{nav == null ? "—" : nav.toFixed(4)}</span>
                        {ch != null && <div className={`text-[10px] ${tone(ch)}`}>{fmt(ch)}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: expandable per-fund cards */}
        <div className="space-y-2 sm:hidden">
          {funds.map((f) => {
            const isOpen = open === f.code;
            const lastI = dates.length - 1;
            const lastCh = changeAt(f, lastI);
            return (
              <div key={f.code} className="rounded-xl border border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setOpen(isOpen ? null : f.code)} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left">
                  <div>
                    <div className="font-medium">{shortName(f)}{f.is_dis ? " ⭐" : ""}</div>
                    <div className="text-[11px] text-slate-400">最新 {f.nav.toFixed(4)}</div>
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${tone(lastCh)}`}>{fmt(lastCh)} <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span></div>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-2 pb-2 dark:border-slate-800">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-slate-500"><th className="px-2 py-1 text-left">日期</th><th className="px-2 py-1 text-right">單價</th><th className="px-2 py-1 text-right">升跌</th></tr></thead>
                        <tbody>
                          {[...dates].reverse().map((d) => {
                            const iAsc = dates.indexOf(d);
                            const nav = f.daily?.[iAsc] ?? null;
                            const ch = changeAt(f, iAsc);
                            return (
                              <tr key={d} className={cellBg(ch)}>
                                <td className="px-2 py-1.5 text-slate-500">{d}</td>
                                <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${tone(ch)}`}>{nav == null ? "—" : nav.toFixed(4)}</td>
                                <td className={`px-2 py-1.5 text-right tabular-nums ${tone(ch)}`}>{fmt(ch)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">升跌 % = 當日單價 ÷ 前一交易日單價 − 1。空白／— 表示該日無數據。每日自動更新時會累積最新單價，保留最近 30 個交易日。</p>
      </Card>
    </div>
  );
}

export default function Dashboard({ data }: { data: MpfData }) {
  const { dark, toggle } = useDark();
  const [tab, setTab] = useState<"overview" | "daily30">("overview");
  const F = data.funds;
  const dis = F.filter((f) => f.is_dis);
  const ranked = [...F].filter((f) => f.change_pct != null).sort((a, b) => b.change_pct! - a.change_pct!);
  const ups = F.filter((f) => (f.change_pct ?? 0) > EPS).length, downs = F.filter((f) => (f.change_pct ?? 0) < -EPS).length;

  const [sel, setSel] = useState(F.find((f) => f.is_dis)?.code ?? F[0].code);
  const selFund = F.find((f) => f.code === sel)!;
  const [view, setView] = useState<"recent" | "quarter" | "year">("recent");
  const [type, setType] = useState("全部");
  const [cls, setCls] = useState("A/無類別");
  const [sort, setSort] = useState<{ k: string; asc: boolean }>({ k: "change_pct", asc: false });
  const types = ["全部", ...Array.from(new Set(F.map(typeOf)))];

  const filtered = useMemo(() => F.filter((f) => (type === "全部" || typeOf(f) === type) && (cls === "全部" || (cls === "A/無類別" ? f.class !== "B" : f.class === cls))), [F, type, cls]);
  const sorted = useMemo(() => {
    const get = (f: Fund): number | string => sort.k === "name" ? f.name_zh : sort.k === "nav" ? f.nav : sort.k === "prev" ? (f.prev_nav ?? -1e9) : sort.k === "cat" ? f.category_zh : sort.k.startsWith("q") ? f.quarters[+sort.k.slice(1)] ?? -1e9 : sort.k.startsWith("y") ? f.calendar[sort.k.slice(1)] ?? -1e9 : sort.k.startsWith("c") ? f.computed[sort.k.slice(1) as "3M"] ?? -1e9 : sort.k.startsWith("o") ? f.official[sort.k.slice(1) as "3M"] ?? -1e9 : f.change_pct ?? -1e9;
    return [...filtered].sort((a, b) => { const A = get(a), B = get(b); const c = typeof A === "number" && typeof B === "number" ? A - B : String(A).localeCompare(String(B)); return sort.asc ? c : -c; });
  }, [filtered, sort]);
  const Th = ({ k, children, left }: { k: string; children: React.ReactNode; left?: boolean }) => (
    <th onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : false }))} className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white ${left ? "text-left" : "text-right"}`}>
      {children}{sort.k === k ? (sort.asc ? " ▲" : " ▼") : ""}
    </th>
  );
  const Pct = ({ v }: { v: N | undefined }) => <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium ${tone(v)}`}>{fmt(v)}</td>;
  const NameTd = ({ f }: { f: Fund }) => (
    <td className="px-3 py-2 text-left"><div className="font-medium">{shortName(f)}{f.is_dis && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">DIS</span>}</div><div className="text-[11px] text-slate-400">{f.name_en}</div></td>
  );

  const periodCols: { k: string; label: string; get: (f: Fund) => N }[] =
    view === "recent" ? [
      { k: "c3M", label: "近3個月*", get: (f) => f.computed["3M"] }, { k: "cYTD", label: "年初至今*", get: (f) => f.computed.YTD }, { k: "c1YR", label: "近1年*", get: (f) => f.computed["1YR"] },
      { k: "o3M", label: "3個月†", get: (f) => f.official["3M"] }, { k: "oYTD", label: "年初至今†", get: (f) => f.official.YTD }, { k: "o1YR", label: "1年†", get: (f) => f.official["1YR"] }, { k: "o3YR", label: "3年†", get: (f) => f.official["3YR"] }, { k: "o5YR", label: "5年†", get: (f) => f.official["5YR"] }, { k: "o10YR", label: "10年†", get: (f) => f.official["10YR"] },
    ] : view === "quarter" ? data.quarter_labels.map((l, i) => ({ k: "q" + i, label: l, get: (f: Fund) => f.quarters[i] }))
      : data.years.map((y) => ({ k: "y" + y, label: y, get: (f: Fund) => f.calendar[y] }));
  const periodNote = view === "recent"
    ? `* 由每日單位價格計算，截至 ${data.date}（3個月／1年以 3／12 個月前月底為基準；年初至今以上年 12 月 31 日為基準）。† 永明官方公佈之累積表現，截至 ${data.official_as_of}。`
    : view === "quarter" ? `由每日單位價格計算：季度回報 = 季末價 ÷ 上季末價 − 1（季末非估值日則取之前最後估值日）。最後一欄為上季末至 ${data.date}。`
      : `永明官方公佈之曆年表現（截至 ${data.calendar_as_of}）。— 表示基金當年尚未成立。`;

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{data.scheme_zh}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">強積金每日基金表現</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">價格日期 {data.date}（對比 {data.prev_date}）・<span className="text-emerald-600 dark:text-emerald-400">綠色 = 升</span>・<span className="text-red-600 dark:text-red-400">紅色 = 跌</span></p>
        </div>
        <button onClick={toggle} className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="切換深色模式">{dark ? "☀️ 淺色" : "🌙 深色"}</button>
      </header>

      <div className="mb-6">
        <Seg value={tab} onChange={setTab} options={[
          { value: "overview", label: "概覽" },
          { value: "daily30", label: `30日單價${data.daily_dates?.length ? `（${data.daily_dates.length}）` : ""}` },
        ]} />
      </div>

      {tab === "daily30" ? <Daily30 data={data} /> : (
        <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "最新估值日", v: data.date, s: `共 ${F.length} 個基金／類別`, c: "" },
          { l: "當日升跌分佈", v: `${ups} 升 / ${downs} 跌`, s: `${F.length - ups - downs} 個持平`, c: "" },
          { l: "升幅最大", v: fmt(ranked[0]?.change_pct), s: ranked[0] ? shortName(ranked[0]) : "", c: tone(ranked[0]?.change_pct) },
          { l: "跌幅最大", v: fmt(ranked.at(-1)?.change_pct), s: ranked.at(-1) ? shortName(ranked.at(-1)!) : "", c: tone(ranked.at(-1)?.change_pct) },
        ].map((m) => (
          <div key={m.l} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">{m.l}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${m.c}`}>{m.v}</div>
            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{m.s}</div>
          </div>
        ))}
      </div>

      <Card title="⭐ 預設投資策略（DIS）" sub="核心累積基金（約 60% 股票）及 65歲後基金（約 20% 股票）。走勢為過去約 2 年月底單位價格。" className="mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          {dis.map((f) => (
            <div key={f.code} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="text-sm font-medium">{f.name_zh}</div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-bold tabular-nums">HK$ {f.nav.toFixed(4)}</span>
                <span className={`text-lg font-semibold ${tone(f.change_pct)}`}>{(f.change_pct ?? 0) > EPS ? "▲" : (f.change_pct ?? 0) < -EPS ? "▼" : "■"} {fmt(f.change_pct)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">前一日 {f.prev_nav?.toFixed(4)}・{f.category_zh}</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([["近3個月", f.computed["3M"]], ["年初至今", f.computed.YTD], ["近1年", f.computed["1YR"]]] as [string, N][]).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-white px-2 py-1.5 dark:bg-slate-900"><div className="text-[11px] text-slate-400">{l}</div><div className={`font-semibold tabular-nums ${tone(v)}`}>{fmt(v)}</div></div>
                ))}
              </div>
              <div className="mt-3"><PriceChart data={data} fund={f} dark={dark} height={160} /></div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Card title="當日升跌 %" sub={`${data.prev_date} → ${data.date}・只顯示 A 類及無類別`} className="lg:col-span-2">
          <DivBarChart dark={dark} items={ranked.filter((f) => f.class !== "B").map((f) => ({ label: shortName(f), value: f.change_pct! }))} />
        </Card>
        <Card title="基金價格走勢" sub="月底單位價格（HK$）及每季回報（由價格計算）" className="lg:col-span-3"
          right={<select className={selCls} value={sel} onChange={(e) => setSel(e.target.value)}>{F.map((f) => <option key={f.code} value={f.code}>{shortName(f)}{f.is_dis ? " ⭐" : ""}</option>)}</select>}>
          <PriceChart data={data} fund={selFund} dark={dark} />
          <h3 className="mb-2 mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">每季回報</h3>
          <DivBarChart dark={dark} items={data.quarter_labels.map((l, i) => ({ label: l, value: selFund.quarters[i] as number })).filter((x) => x.value != null)} />
        </Card>
      </div>

      <Card title="期間表現" className="mb-6" right={<Seg value={view} onChange={setView} options={[{ value: "recent", label: "近期累積" }, { value: "quarter", label: "每季" }, { value: "year", label: "曆年" }]} />}>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800"><tr><Th k="name" left>基金</Th>{periodCols.map((c) => <Th key={c.k} k={c.k}>{c.label}</Th>)}</tr></thead>
            <tbody>{sorted.map((f) => <tr key={f.code} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"><NameTd f={f} />{periodCols.map((c) => <Pct key={c.k} v={c.get(f)} />)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{periodNote}</p>
      </Card>

      <Card title="全部基金（當日）" sub="點擊欄位標題排序；篩選同時套用於上方期間表現表">
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-xs text-slate-500">基金類型<br /><select className={selCls} value={type} onChange={(e) => setType(e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="text-xs text-slate-500">單位類別<br /><select className={selCls} value={cls} onChange={(e) => setCls(e.target.value)}>{["A/無類別", "全部", "A", "B", "--"].map((c) => <option key={c} value={c}>{c === "--" ? "無類別" : c}</option>)}</select></label>
        </div>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800"><tr><Th k="name" left>基金</Th><Th k="cat" left>基金種類</Th><Th k="nav">最新價 (HK$)</Th><Th k="prev">前一日</Th><Th k="change_pct">當日升跌</Th></tr></thead>
            <tbody>{sorted.map((f) => (
              <tr key={f.code} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                <NameTd f={f} /><td className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400">{f.category_zh}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.nav.toFixed(4)}</td><td className="px-3 py-2 text-right tabular-nums text-slate-500">{f.prev_nav?.toFixed(4) ?? "—"}</td><Pct v={f.change_pct} />
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
        </>
      )}

      <footer className="mt-10 space-y-1 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>資料來源：<a className="text-indigo-600 underline dark:text-indigo-400" href={data.source} target="_blank" rel="noreferrer">永明金融 強積金基金價格及表現</a>・價格日期 {data.date}・資料更新於 {data.generated_at.replace("T", " ").slice(0, 16)} (HKT)</p>
        <p>強積金價格約有 1 個工作天延遲。過往表現不代表將來表現。</p>
        <p className="font-medium">僅供參考，不構成投資建議。本網站與永明金融並無關連。</p>
      </footer>
    </div>
  );
}
