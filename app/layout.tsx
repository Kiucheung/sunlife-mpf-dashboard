import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "永明彩虹強積金 每日表現", description: "永明彩虹強積金計劃各成分基金每日升跌、預設投資策略及期間表現" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
const themeInit = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-HK" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">{children}</body>
    </html>
  );
}
