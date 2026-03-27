# 部落格系統開發記錄

## 對話重點摘要

---

## 一、初始問題
- 使用者想開啟 CCC 資料夾內的網頁
- 這是一個 Node.js + Express + SQLite 部落格系統

---

## 二、資料庫錯誤修復
### 錯誤：`table posts has no column named user_id`
- 原因：舊的 `blog.db` 資料庫缺少 `user_id` 欄位
- 解決：刪除舊資料庫讓系統重新建立

### 解決步驟：
1. 刪除 `blog.db`
2. 重新啟動伺服器
3. 確認 `CREATE TABLE` 語法正確

---

## 三、排版改版（Dcard 風格）

### 使用者需求：
- 左側有分類（感情、事業、學習等）
- 按下分類可導向不同頁面
- 頂部有搜尋關鍵字區域

### 實作內容：

#### 1. 左側分類側邊欄
- 分類項目：感情、事業、學習、生活、興趣、健康、理財
- 側邊欄固定在左側，延伸至頁面底部
- 使用 `position: fixed` 實現

#### 2. 頂部搜尋列
- HTML 表單，`method="GET"`
- 搜尋標題和內容

#### 3. 資料庫更新
```javascript
// 新增 category 欄位
db.run(`
  CREATE TABLE IF NOT EXISTS posts (
    ...
    category TEXT DEFAULT '生活',
    ...
  )
`);
```

#### 4. 新增函數
- `getPostsByCategory(category)` - 按分類查詢
- `searchPosts(keyword)` - 關鍵字搜尋

#### 5. 新增路由
```javascript
app.get('/category/:name', ...)
app.get('/search', ...)
```

#### 6. 寫文章表單更新
- 新增分類下拉選單

---

## 四、CSS 排版問題修復

### 問題 1：`currentCategory is not defined`
- 原因：首頁路由沒傳遞 `currentCategory` 變數
- 解決：`res.render('index', { posts, currentCategory: null, q: null })`

### 問題 2：側邊欄不延伸到頁面底部
- 解決：
```css
.sidebar {
  position: fixed;
  left: 0;
  top: 80px;
  bottom: 0;
}
```

### 問題 3：分類和搜尋按鈕顯示錯誤
- 原因 1：`getPostsByCategory` 函數未 export
- 解決：在 `module.exports` 加入
- 原因 2：中文 URL 編碼問題
- 解決：
  - EJS 使用 `encodeURIComponent()`
  - Server 使用 `decodeURIComponent()`

---

## 五、背景顏色修改
- 改為墨藍色漸層
```css
background: linear-gradient(135deg, #1a365d 0%, #0d1b2a 50%, #1b263b 100%);
```

---

## 六、檔案修改清單

| 檔案 | 修改內容 |
|------|----------|
| `server.js` | 新增分類/搜尋路由、decodeURIComponent |
| `database.js` | 新增 category 欄位、getPostsByCategory、searchPosts 函數 |
| `views/index.ejs` | 新增側邊欄、搜尋列、encodeURIComponent |
| `views/new.ejs` | 新增分類下拉選單 |
| `public/css/style.css` | 側邊欄固定、背景顏色、手機版響應式 |
| `note.md` | 本記錄文件 |

---

## 七、常用指令

```bash
# 安裝依賴
npm install

# 啟動伺服器
npm start

# 刪除資料庫（重置）
node -e "require('fs').unlinkSync('blog.db')"

# 關閉佔用 3000 連接埠的程式
npx kill-port 3000
```

---

## 八、已知問題與注意事項

1. **中文 URL**：必須使用 `encodeURIComponent` / `decodeURIComponent`
2. **函數 export**：新增函數後要記得加入 `module.exports`
3. **資料庫**：修改結構後需刪除舊資料庫重新建立
4. **伺服器重啟**：修改程式碼後需重啟伺服器才會生效
