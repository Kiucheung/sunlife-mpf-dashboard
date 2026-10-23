# 永明彩虹強積金 每日表現 Dashboard

🔗 網站：https://kiucheung.github.io/sunlife-mpf-dashboard/

方便查看**永明彩虹強積金計劃**各成分基金每日升跌 % 的網頁：

- 重點數字：最新估值日、升跌分佈、升幅／跌幅最大基金
- ⭐ 預設投資策略（DIS）：核心累積基金、65歲後基金每日升跌及走勢
- 當日升跌 % 棒形圖（綠色 = 升，紅色 = 跌）
- 個別基金價格走勢（月底價格）及每季回報
- 期間表現：近期累積（3個月／年初至今／1年等）、每季、曆年
- 可篩選、排序的基金列表；支援手機及深色模式

## 數據來源

[永明金融 強積金基金價格及表現](https://www.sunlife.com.hk/zh-hant/investments/mpf-orso-fund-prices-performance/mpf-fund-prices-performance/) 網頁背後的公開數據介面。

- 每日價格約有 1 個工作天延遲
- 官方累積及曆年表現按季更新
- 「近3個月／年初至今／近1年」及每季回報由每日單位價格自行計算，或與官方數字略有差異

## 自動更新

GitHub Actions（`.github/workflows/update-and-deploy.yml`）於每星期一至六 **10:30（香港時間）** 執行：

1. `python3 scripts/fetch.py` 抓取最新數據寫入 `public/data.json`（失敗時保留舊數據並以非零狀態退出）
2. 如數據有變更則自動 commit
3. 建置 Next.js 靜態網站並部署至 GitHub Pages

亦可於 Actions 頁面手動執行（workflow_dispatch）。

## 本地開發

```bash
npm install
python3 scripts/fetch.py   # 更新數據
npm run dev                # http://localhost:3000
```

技術：Next.js（static export）+ Tailwind CSS + Recharts。

## 免責聲明

僅供參考，不構成投資建議。過往表現不代表將來表現。本網站與永明金融並無關連。
