export type N = number | null;
export interface Fund {
  code: string; name_zh: string; name_en: string; class: string; category_zh: string; is_dis: boolean;
  nav: number; prev_nav: N; change_pct: N; risk_class?: string | null;
  official: Record<"3M" | "YTD" | "1YR" | "3YR" | "5YR" | "10YR" | "SIP", N>;
  calendar: Record<string, N>; computed: Record<"3M" | "YTD" | "1YR", N>; quarters: N[]; history: N[];
  /** 與 daily_dates 對齊的每日單位價格（最多 30 個交易日） */
  daily?: N[];
}
export interface MpfData {
  source: string; scheme_zh: string; generated_at: string; date: string; prev_date: string;
  official_as_of: string; calendar_as_of: string; years: string[]; quarter_labels: string[]; history_dates: (string | null)[];
  /** 升序交易日（YYYY-MM-DD），最多 30 日 */
  daily_dates?: string[];
  funds: Fund[];
}
