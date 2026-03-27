const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { initDatabase, getAllPosts, getPostById, createPost, updatePost, deletePost, createUser, verifyUser, getUserById, getPostsByCategory, searchPosts } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[Server] 啟動中...');
console.log('[Server] __dirname:', __dirname);
console.log('[Server] VERCEL環境:', process.env.VERCEL);
console.log('[Server] views 路徑:', path.join(__dirname, 'views'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

console.log('[Server] Express 設定完成');

let dbInitialized = false;
let initPromise = null;

async function ensureDbInit() {
  console.log('[DB] 檢查資料庫初始化...');
  if (dbInitialized) {
    console.log('[DB] 已初始化，跳過');
    return;
  }
  if (!initPromise) {
    console.log('[DB] 開始初始化...');
    initPromise = initDatabase()
      .then(() => {
        console.log('[DB] 初始化成功');
        dbInitialized = true;
      })
      .catch((err) => {
        console.error('[DB] 初始化失敗:', err);
      });
  }
  await initPromise;
  console.log('[DB] await 完成');
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

console.log('[Server] Session 設定完成');

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentYear = new Date().getFullYear();
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function redirectIfAuth(req, res, next) {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
}

app.get('/', async (req, res) => {
  console.log('[Route] GET / - 開始');
  try {
    await ensureDbInit();
    console.log('[Route] GET / - 取得文章列表');
    const posts = getAllPosts();
    console.log('[Route] GET / - 找到', posts.length, '篇文章');
    res.render('index', { posts, currentCategory: null, q: null });
    console.log('[Route] GET / - 完成');
  } catch (err) {
    console.error('[Route] GET / - 錯誤:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/category/:name', async (req, res) => {
  console.log('[Route] GET /category/:name - 開始', req.params.name);
  try {
    await ensureDbInit();
    const category = decodeURIComponent(req.params.name);
    console.log('[Route] GET /category/:name - 分類:', category);
    const posts = getPostsByCategory(category);
    console.log('[Route] GET /category/:name - 找到', posts.length, '篇文章');
    res.render('index', { posts, currentCategory: category, q: null });
  } catch (err) {
    console.error('[Route] GET /category/:name - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/search', async (req, res) => {
  console.log('[Route] GET /search - 開始', req.query.q);
  try {
    await ensureDbInit();
    const q = req.query.q || '';
    console.log('[Route] GET /search - 關鍵字:', q);
    const posts = q ? searchPosts(q) : [];
    console.log('[Route] GET /search - 找到', posts.length, '篇文章');
    res.render('index', { posts, currentCategory: null, q });
  } catch (err) {
    console.error('[Route] GET /search - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/post/:id', async (req, res) => {
  console.log('[Route] GET /post/:id - 開始', req.params.id);
  try {
    await ensureDbInit();
    const post = getPostById(parseInt(req.params.id));
    if (!post) {
      console.log('[Route] GET /post/:id - 文章不存在');
      return res.status(404).send('Post not found');
    }
    console.log('[Route] GET /post/:id - 找到文章:', post.title);
    res.render('post', { post });
  } catch (err) {
    console.error('[Route] GET /post/:id - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/new', requireAuth, async (req, res) => {
  console.log('[Route] GET /new - 開始');
  try {
    await ensureDbInit();
    console.log('[Route] GET /new - 渲染寫文章頁面');
    res.render('new');
  } catch (err) {
    console.error('[Route] GET /new - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/posts', requireAuth, async (req, res) => {
  console.log('[Route] POST /posts - 開始');
  try {
    await ensureDbInit();
    const { title, content, category } = req.body;
    const user = req.session.user;
    console.log('[Route] POST /posts - 建立文章:', title, '分類:', category);
    createPost(title, content, user.username, user.id, category || '生活');
    console.log('[Route] POST /posts - 完成，重新導向');
    res.redirect('/');
  } catch (err) {
    console.error('[Route] POST /posts - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/edit/:id', requireAuth, async (req, res) => {
  console.log('[Route] GET /edit/:id - 開始', req.params.id);
  try {
    await ensureDbInit();
    const post = getPostById(parseInt(req.params.id));
    if (!post) {
      return res.status(404).send('Post not found');
    }
    if (post.user_id && post.user_id !== req.session.user.id) {
      return res.status(403).send('You can only edit your own posts');
    }
    console.log('[Route] GET /edit/:id - 渲染編輯頁面');
    res.render('edit', { post });
  } catch (err) {
    console.error('[Route] GET /edit/:id - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/update/:id', requireAuth, async (req, res) => {
  console.log('[Route] POST /update/:id - 開始', req.params.id);
  try {
    await ensureDbInit();
    const post = getPostById(parseInt(req.params.id));
    if (!post) {
      return res.status(404).send('Post not found');
    }
    if (post.user_id && post.user_id !== req.session.user.id) {
      return res.status(403).send('You can only edit your own posts');
    }
    const { title, content } = req.body;
    console.log('[Route] POST /update/:id - 更新文章');
    updatePost(parseInt(req.params.id), title, content, req.session.user.username);
    res.redirect(`/post/${req.params.id}`);
  } catch (err) {
    console.error('[Route] POST /update/:id - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/delete/:id', requireAuth, async (req, res) => {
  console.log('[Route] POST /delete/:id - 開始', req.params.id);
  try {
    await ensureDbInit();
    const post = getPostById(parseInt(req.params.id));
    if (!post) {
      return res.status(404).send('Post not found');
    }
    if (post.user_id && post.user_id !== req.session.user.id) {
      return res.status(403).send('You can only delete your own posts');
    }
    console.log('[Route] POST /delete/:id - 刪除文章');
    deletePost(parseInt(req.params.id));
    res.redirect('/');
  } catch (err) {
    console.error('[Route] POST /delete/:id - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.get('/register', redirectIfAuth, async (req, res) => {
  console.log('[Route] GET /register - 開始');
  try {
    await ensureDbInit();
    res.render('register', { error: null });
  } catch (err) {
    console.error('[Route] GET /register - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/register', redirectIfAuth, async (req, res) => {
  console.log('[Route] POST /register - 開始');
  try {
    await ensureDbInit();
    const { username, email, password, confirmPassword } = req.body;
    
    if (!username || !email || !password) {
      return res.render('register', { error: 'Please fill in all fields' });
    }
    
    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters' });
    }
    
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }
    
    const user = await createUser(username, email, password);
    req.session.user = user;
    console.log('[Route] POST /register - 註冊成功');
    res.redirect('/');
  } catch (err) {
    console.error('[Route] POST /register - 錯誤:', err.message);
    res.render('register', { error: err.message });
  }
});

app.get('/login', redirectIfAuth, async (req, res) => {
  console.log('[Route] GET /login - 開始');
  try {
    await ensureDbInit();
    res.render('login', { error: null });
  } catch (err) {
    console.error('[Route] GET /login - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/login', redirectIfAuth, async (req, res) => {
  console.log('[Route] POST /login - 開始');
  try {
    await ensureDbInit();
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.render('login', { error: 'Please fill in all fields' });
    }
    
    const user = await verifyUser(username, password);
    if (user) {
      req.session.user = user;
      console.log('[Route] POST /login - 登入成功');
      res.redirect('/');
    } else {
      console.log('[Route] POST /login - 帳號密碼錯誤');
      res.render('login', { error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('[Route] POST /login - 錯誤:', err);
    res.render('login', { error: 'An error occurred. Please try again.' });
  }
});

app.post('/logout', (req, res) => {
  console.log('[Route] POST /logout - 登出');
  req.session.destroy();
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  console.log('[Route] GET /logout - 登出');
  req.session.destroy();
  res.redirect('/');
});

app.get('/profile', requireAuth, async (req, res) => {
  console.log('[Route] GET /profile - 開始');
  try {
    await ensureDbInit();
    const { getUserPosts } = require('./database');
    const posts = getUserPosts(req.session.user.id);
    const user = getUserById(req.session.user.id);
    console.log('[Route] GET /profile - 找到', posts.length, '篇文章');
    res.render('profile', { user, posts });
  } catch (err) {
    console.error('[Route] GET /profile - 錯誤:', err);
    res.status(500).send('Server Error');
  }
});

console.log('[Server] 所有路由設定完成');

async function startServer() {
  console.log('[Server] 開始本地啟動...');
  await initDatabase();
  console.log('[Server] 資料庫初始化完成');
  app.listen(PORT, () => {
    console.log(`[Server] ✅ 部落格系統運行於 http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL === undefined) {
  console.log('[Server] 本地環境，啟動伺服器');
  startServer();
} else {
  console.log('[Server] Vercel 環境，導出 app');
}

module.exports = app;
