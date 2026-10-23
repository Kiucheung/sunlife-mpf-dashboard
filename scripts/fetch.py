#!/usr/bin/env python3
"""抓取永明彩虹強積金計劃每日基金價格及表現，寫入 public/data.json。
失敗時保留舊檔案並以非零狀態退出。"""
import json, os, sys, time, datetime as dt, urllib.request, tempfile

URL = "https://www.sunlife.com.hk/webservice/getmpforsofunddata"
SRC = "https://www.sunlife.com.hk/zh-hant/investments/mpf-orso-fund-prices-performance/mpf-fund-prices-performance/"
SCHEME = "MPF"  # 永明彩虹強積金計劃
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data.json")
DIS_KEYS = ("核心累積", "65歲後")

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
    """回傳 <= day 的最後估值日價格 (date, {code: row})"""
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

def main():
    last = d(q("MPF_LAST_VALUATION_DT", [SCHEME])[0]["LAST_VALUATION_DT"])
    cur_d, cur = prices_on(last)
    if not cur: raise RuntimeError("no current prices")
    prev_d, prev = prices_on(last - dt.timedelta(days=1))
    if not prev: raise RuntimeError("no previous prices")

    cr_dt = d(q("MPF_CR_LAST_VALUATION_DT", [SCHEME])[0]["LAST_VALUATION_DT"])
    cy_dt = d(q("MPF_CYP_LAST_VALUATION_DT", [SCHEME])[0]["LAST_VALUATION_DT"])
    off = {r["FUND_CD"]: r for r in q("MPF_CR_PERFORMANCE", [cr_dt.isoformat(), SCHEME])}
    cyp = {r["FUND_CD"]: r for r in q("MPF_CYP_PERFORMANCE", [cy_dt.isoformat(), SCHEME])}
    years = [str(cy_dt.year - n) for n in range(5, 0, -1)]  # 網站以「今年 - n」標示 nPYR

    pts = month_ends(last, 25)
    snaps = []  # (target, valuation_date, {code: nav})
    for p in pts:
        vd, rows = prices_on(p)
        snaps.append((p, vd, {k: v["NAV"] for k, v in rows.items()}))
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
        })
    if len(funds) < 10: raise RuntimeError(f"too few funds: {len(funds)}")

    out = {"source": SRC, "scheme_zh": "永明彩虹強積金計劃", "scheme_en": "Sun Life Rainbow MPF Scheme",
           "generated_at": dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds"),
           "date": cur_d.isoformat(), "prev_date": prev_d.isoformat(),
           "official_as_of": cr_dt.isoformat(), "calendar_as_of": cy_dt.isoformat(), "years": years,
           "quarter_labels": qlabels, "history_dates": [s[1].isoformat() if s[1] else None for s in snaps],
           "funds": funds}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(OUT), suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print(f"OK {cur_d} vs {prev_d}: {len(funds)} funds -> {os.path.normpath(OUT)}")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        print(f"ERROR: {e} (previous data.json kept)", file=sys.stderr); sys.exit(1)
