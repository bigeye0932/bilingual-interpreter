雙向即時口譯 V1.0（免 OpenAI API Key）

檔案：
- index.html：網頁主畫面
- style.css：版面樣式
- app.js：語音辨識與翻譯程式
- manifest.webmanifest：可加入手機主畫面的基本設定

部署到 GitHub Pages：
1. 解壓縮 ZIP。
2. 在 GitHub 建立 Public repository。
3. 將上述四個檔案（及本說明檔）上傳到 repository 根目錄。
4. Settings > Pages > Build and deployment 選 Deploy from a branch。
5. Branch 選 main，資料夾選 /(root)，按 Save。
6. 等待 GitHub Pages 提供 https 網址。

重要限制：
- 本程式不使用 OpenAI API Key。
- 語音辨識使用瀏覽器 Web Speech API；Chrome/Edge 支援度通常較好，Safari/iPhone 的支援可能受系統版本限制。
- 免費翻譯使用 MyMemory 公開翻譯 API，可能有流量限制、延遲、品質或服務可用性限制。
- 翻譯文字會送到 MyMemory 服務處理，請勿輸入密碼、個資或機密內容。
- 若瀏覽器不支援語音辨識，可使用文字輸入欄及手機鍵盤聽寫。
- 網頁需透過 HTTPS 網址開啟，麥克風權限才較容易正常運作。
