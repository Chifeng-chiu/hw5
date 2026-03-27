const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase, getAllPosts, getPostById, createPost, updatePost, deletePost, createUser, verifyUser, getUserById, getPostsByCategory, searchPosts } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

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

app.get('/', (req, res) => {
  const posts = getAllPosts();
  res.render('index', { posts, currentCategory: null, q: null });
});

app.get('/category/:name', (req, res) => {
  const category = decodeURIComponent(req.params.name);
  const posts = getPostsByCategory(category);
  res.render('index', { posts, currentCategory: category, q: null });
});

app.get('/search', (req, res) => {
  const q = req.query.q || '';
  const posts = q ? searchPosts(q) : [];
  res.render('index', { posts, currentCategory: null, q });
});

app.get('/post/:id', (req, res) => {
  const post = getPostById(parseInt(req.params.id));
  if (!post) {
    return res.status(404).send('Post not found');
  }
  res.render('post', { post });
});

app.get('/new', requireAuth, (req, res) => {
  res.render('new');
});

app.post('/posts', requireAuth, (req, res) => {
  const { title, content, category } = req.body;
  const user = req.session.user;
  createPost(title, content, user.username, user.id, category || '生活');
  res.redirect('/');
});

app.get('/edit/:id', requireAuth, (req, res) => {
  const post = getPostById(parseInt(req.params.id));
  if (!post) {
    return res.status(404).send('Post not found');
  }
  if (post.user_id && post.user_id !== req.session.user.id) {
    return res.status(403).send('You can only edit your own posts');
  }
  res.render('edit', { post });
});

app.post('/update/:id', requireAuth, (req, res) => {
  const post = getPostById(parseInt(req.params.id));
  if (!post) {
    return res.status(404).send('Post not found');
  }
  if (post.user_id && post.user_id !== req.session.user.id) {
    return res.status(403).send('You can only edit your own posts');
  }
  const { title, content } = req.body;
  updatePost(parseInt(req.params.id), title, content, req.session.user.username);
  res.redirect(`/post/${req.params.id}`);
});

app.post('/delete/:id', requireAuth, (req, res) => {
  const post = getPostById(parseInt(req.params.id));
  if (!post) {
    return res.status(404).send('Post not found');
  }
  if (post.user_id && post.user_id !== req.session.user.id) {
    return res.status(403).send('You can only delete your own posts');
  }
  deletePost(parseInt(req.params.id));
  res.redirect('/');
});

app.get('/register', redirectIfAuth, (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', redirectIfAuth, async (req, res) => {
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
  
  try {
    const user = await createUser(username, email, password);
    req.session.user = user;
    res.redirect('/');
  } catch (err) {
    res.render('register', { error: err.message });
  }
});

app.get('/login', redirectIfAuth, (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', redirectIfAuth, async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.render('login', { error: 'Please fill in all fields' });
  }
  
  try {
    const user = await verifyUser(username, password);
    if (user) {
      req.session.user = user;
      res.redirect('/');
    } else {
      res.render('login', { error: 'Invalid username or password' });
    }
  } catch (err) {
    res.render('login', { error: 'An error occurred. Please try again.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/profile', requireAuth, (req, res) => {
  const { getUserPosts } = require('./database');
  const posts = getUserPosts(req.session.user.id);
  const user = getUserById(req.session.user.id);
  res.render('profile', { user, posts });
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Blog system running at http://localhost:${PORT}`);
  });
}

if (process.env.VERCEL === undefined) {
  startServer();
}

module.exports = app;
