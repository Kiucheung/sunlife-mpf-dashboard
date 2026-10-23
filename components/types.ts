export type N = number | null;
export interface Fund {
  code: string; name_zh: string; name_en: string; class: string; category_zh: string; is_dis: boolean;
  nav: number; prev_nav: N; change_pct: N; risk_class?: string | null;
  official: Record<"3M" | "YTD" | "1YR" | "3YR" | "5YR" | "10YR" | "SIP", N>;
  calendar: Record<string, N>; computed: Record<"3M" | "YTD" | "1YR", N>; quarters: N[]; history: N[];
}
export interface MpfData {
  source: string; scheme_zh: string; generated_at: string; date: string; prev_date: string;
  official_as_of: string; calendar_as_of: string; years: string[]; quarter_labels: string[]; history_dates: (string | null)[]; funds: Fund[];
}
