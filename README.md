# 部落格系統 (Blog System)

## 📁 專案結構

| 檔案/資料夾 | 說明 |
|------------|------|
| `server.js` | Express 伺服器主程式，包含所有路由設定 |
| `database.js` | SQLite 資料庫操作，包含 CRUD 函數 |
| `views/` | EJS 模板資料夾 |
| `public/` | 靜態檔案（CSS、圖片等） |
| `package.json` | Node.js 專案設定 |
| `blog.db` | SQLite 資料庫檔案 |
| `note.md` | 開發記錄文件 |

## 🚀 啟動方式

```bash
# 安裝依賴
npm install

# 啟動伺服器
npm start
```

開啟瀏覽器造訪：http://localhost:3000

## ✨ 功能特色

- 📝 文章發布、編輯、刪除
- 🔍 搜尋功能
- 📂 分類功能（感情、事業、學習、生活、興趣、健康、理財）
- 👤 使用者註冊/登入
- 📱 響應式設計

## 🛠 技術棧

- **後端**：Node.js + Express
- **資料庫**：SQLite (sql.js)
- **模板引擎**：EJS
- **前端**：HTML5 + CSS3
