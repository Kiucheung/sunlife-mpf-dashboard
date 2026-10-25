#!/usr/bin/env python3
"""抓取永明彩虹強積金計劃每日基金價格及表現，寫入 public/data.json。
失敗時保留舊檔案並以非零狀態退出。
每日單價累積最多 30 個交易日；首次執行會向後補齊。"""
import json, os, sys, time, datetime as dt, urllib.request, tempfile

URL = "https://www.sunlife.com.hk/webservice/getmpforsofunddata"
SRC = "https://www.sunlife.com.hk/zh-hant/investments/mpf-orso-fund-prices-performance/mpf-fund-prices-performance/"
SCHEME = "MPF"  # 永明彩虹強積金計劃
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data.json")
DIS_KEYS = ("核心累積", "65歲後")
DAILY_MAX = 30

def q(key, params=None, tries=4):
    body = {"domainAndUserName": "hkportal", "sqlKey": key}
    if params: body["sqlParams"] = params
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(URL, json.dumps(body).encode(), {
                "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (sunlife-mpf-dashboard)"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.load(r)
            if not isinstance(data, list): raise ValueError(f"unexpected response for {key}")
            return data
        except Exception as e:
            last = e; time.sleep(2 * (i + 1))
    raise RuntimeError(f"{key} {params} failed: {last}")

def d(s): return dt.datetime.strptime(s, "%d/%m/%Y").date()
def pct(s):
    try: return float(str(s).strip().rstrip("%"))
    except Exception: return None

def prices_on(day):
    """回傳該請求日對應的估值日及 {code: nav}。非交易日會回傳之前最近估值日。"""
    rows = [r for r in q("MPF_DAILYPRICE", [day.isoformat(), SCHEME]) if r.get("NAV") is not None]
    if not rows: return None, {}
    vd = max(d(r["VALUATION_DT"]) for r in rows)
    return vd, {r["FUND_CD"]: r["NAV"] for r in rows if d(r["VALUATION_DT"]) == vd}

def prices_rows_on(day):
    rows = [r for r in q("MPF_DAILYPRICE", [day.isoformat(), SCHEME]) if r.get("NAV") is not None]
    if not rows: return None, {}
    vd = max(d(r["VALUATION_DT"]) for r in rows)
    return vd, {r["FUND_CD"]: r for r in rows if d(r["VALUATION_DT"]) == vd}

def month_ends(last, n):
    out, y, m = [], last.year, last.month
    for _ in range(n):
        m -= 1
        if m == 0: y, m = y - 1, 12
        out.append(dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1))
    return sorted(out)

def load_prev():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def collect_daily(last, prev_data):
    """合併舊資料 + 補齊，回傳 (dates_asc, {code: [nav|None,...]})，最多 DAILY_MAX 日。"""
    # 由舊檔讀取：dates + 各基金 daily
    by_date = {}  # date_str -> {code: nav}
    if prev_data and prev_data.get("daily_dates"):
        for i, ds in enumerate(prev_data["daily_dates"]):
            if not ds: continue
            by_date[ds] = {}
            for f in prev_data.get("funds", []):
                series = f.get("daily") or []
                if i < len(series) and series[i] is not None:
                    by_date[ds][f["code"]] = series[i]

    # 需要的交易日數量
    have = set(by_date)
    need_backfill = len(have) < DAILY_MAX or (last.isoformat() not in have)

    if need_backfill:
        # 由最新估值日往回走，收集唯一交易日直至滿 DAILY_MAX
        cursor = last
        seen = set()
        empty_streak = 0
        # 最多掃約 60 個曆日（含假日）
        for _ in range(70):
            if len(seen) >= DAILY_MAX: break
            vd, navs = prices_on(cursor)
            if vd is None:
                empty_streak += 1
                if empty_streak >= 5: break
                cursor -= dt.timedelta(days=1)
                continue
            empty_streak = 0
            ds = vd.isoformat()
            if ds not in seen:
                seen.add(ds)
                # 已有舊資料則保留（可能更完整），否則寫入
                if ds not in by_date or len(navs) >= len(by_date[ds]):
                    by_date[ds] = navs
            # 跳到估值日的前一天，避免週末重複取同一天
            cursor = vd - dt.timedelta(days=1)
            if cursor.year < last.year - 1: break

    dates = sorted(by_date.keys())[-DAILY_MAX:]
    series = {code: [by_date[ds].get(code) for ds in dates] for ds in dates for code in by_date[ds]}
    # 補齊所有曾出現過的 code
    all_codes = set()
    for ds in dates:
        all_codes.update(by_date[ds])
    series = {code: [by_date[ds].get(code) for ds in dates] for code in all_codes}
    return dates, series

def main():
    last = d(q("MPF_LAST_VALUATION_DT", [SCHEME])[0]["LAST_VALUATION_DT"])
    cur_d, cur = prices_rows_on(last)
    if not cur: raise RuntimeError("no current prices")
    prev_d, prev = prices_rows_on(last - dt.timedelta(days=1))
    if not prev: raise RuntimeError("no previous prices")
    # prev 可能回傳非交易日的「前一估值日」；確保 prev_d < cur_d
    if prev_d and prev_d >= cur_d:
        prev_d, prev = prices_rows_on(cur_d - dt.timedelta(days=1))

    cr_dt = d(q("MPF_CR_LAST_VALUATION_DT", [SCHEME])[0]["LAST_VALUATION_DT"])
    cy_dt = d(q("MPF_CYP_LAST_VALUATION_DT", [SCHEME])[0]["LAST_VALUATION_DT"])
    off = {r["FUND_CD"]: r for r in q("MPF_CR_PERFORMANCE", [cr_dt.isoformat(), SCHEME])}
    cyp = {r["FUND_CD"]: r for r in q("MPF_CYP_PERFORMANCE", [cy_dt.isoformat(), SCHEME])}
    years = [str(cy_dt.year - n) for n in range(5, 0, -1)]

    pts = month_ends(last, 25)
    snaps = []
    for p in pts:
        vd, navs = prices_on(p)
        snaps.append((p, vd, navs))
    snaps.append((last, cur_d, {k: v["NAV"] for k, v in cur.items()}))
    snap_by_target = {s[0]: s for s in snaps}

    qe = [s[0] for s in snaps[:-1] if s[0].month in (3, 6, 9, 12)]
    qlabels = []
    for b in qe[1:] + [last]:
        lab = f"{b.year} Q{(b.month - 1) // 3 + 1}" + ("（至今）" if b == last else "")
        qlabels.append(lab)

    def back(months):
        y, m = last.year, last.month - months
        while m <= 0: y, m = y - 1, m + 12
        return next((s[0] for s in snaps[:-1] if (s[0].year, s[0].month) == (y, m)), None)
    ye = dt.date(last.year - 1, 12, 31)

    def ret(code, a, b):
        A = snap_by_target.get(a, (0, 0, {}))[2].get(code); B = snap_by_target.get(b, (0, 0, {}))[2].get(code)
        return round((B / A - 1) * 100, 2) if A and B else None

    prev_data = load_prev()
    print(f"Collecting up to {DAILY_MAX} trading days of daily prices...", flush=True)
    daily_dates, daily_series = collect_daily(cur_d, prev_data)
    print(f"Daily history: {len(daily_dates)} days ({daily_dates[0] if daily_dates else '?'} → {daily_dates[-1] if daily_dates else '?'})", flush=True)

    funds = []
    for code, r in sorted(cur.items(), key=lambda kv: kv[1].get("FUND_DISPLAY_SEQUENCE", 0)):
        p = prev.get(code, {}).get("NAV")
        o = off.get(code, {}); c = cyp.get(code, {})
        funds.append({
            "code": code, "name_zh": r["FUND_DESCRIPTION_ZH"], "name_en": r["FUND_DESCRIPTION_EN"],
            "class": r.get("FUND_CLASS") or "--", "category_zh": r.get("PRODUCT_CATEGORY_ZH"),
            "is_dis": any(k in r["FUND_DESCRIPTION_ZH"] for k in DIS_KEYS),
            "nav": r["NAV"], "prev_nav": p,
            "change_pct": round((r["NAV"] / p - 1) * 100, 4) if p else None,
            "risk_class": o.get("RISK_CLASS"),
            "official": {k: pct(o.get("PERFORMANCE_" + k)) for k in ("3M", "YTD", "1YR", "3YR", "5YR", "10YR", "SIP")},
            "calendar": {years[5 - n]: pct(c.get(f"PERFORMANCE_{n}PYR")) for n in range(1, 6)},
            "computed": {"3M": ret(code, back(3), last), "YTD": ret(code, ye, last), "1YR": ret(code, back(12), last)},
            "quarters": [ret(code, a, b) for a, b in zip(qe, qe[1:] + [last])],
            "history": [s[2].get(code) for s in snaps],
            "daily": daily_series.get(code, [None] * len(daily_dates)),
        })
    if len(funds) < 10: raise RuntimeError(f"too few funds: {len(funds)}")

    out = {"source": SRC, "scheme_zh": "永明彩虹強積金計劃", "scheme_en": "Sun Life Rainbow MPF Scheme",
           "generated_at": dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds"),
           "date": cur_d.isoformat(), "prev_date": prev_d.isoformat() if prev_d else None,
           "official_as_of": cr_dt.isoformat(), "calendar_as_of": cy_dt.isoformat(), "years": years,
           "quarter_labels": qlabels, "history_dates": [s[1].isoformat() if s[1] else None for s in snaps],
           "daily_dates": daily_dates, "funds": funds}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT), suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print(f"OK {cur_d} vs {prev_d}: {len(funds)} funds, {len(daily_dates)} daily days -> {os.path.normpath(OUT)}")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        print(f"ERROR: {e} (previous data.json kept)", file=sys.stderr); sys.exit(1)
