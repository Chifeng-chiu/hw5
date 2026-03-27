const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'blog.db');

console.log('[Database] 資料庫路徑:', dbPath);

let db;

async function initDatabase() {
  console.log('[Database] 開始初始化...');
  try {
    const SQL = await initSqlJs();
    console.log('[Database] sql.js 載入成功');
    
    if (fs.existsSync(dbPath)) {
      console.log('[Database] 發現現有資料庫:', dbPath);
      const buffer = fs.readFileSync(dbPath);
      console.log('[Database] 資料庫大小:', buffer.length, 'bytes');
      db = new SQL.Database(buffer);
    } else {
      console.log('[Database] 建立新資料庫');
      db = new SQL.Database();
    }
    
    console.log('[Database] 建立 users 資料表...');
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('[Database] 建立 posts 資料表...');
    db.run(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Anonymous',
        user_id INTEGER,
        category TEXT DEFAULT '生活',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log('[Database] 儲存資料庫...');
    saveDatabase();
    console.log('[Database] 初始化完成');
    return db;
  } catch (err) {
    console.error('[Database] 初始化錯誤:', err);
    throw err;
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getAllPosts() {
  const result = db.exec('SELECT * FROM posts ORDER BY created_at DESC');
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function getPostById(id) {
  const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const obj = {};
    columns.forEach((col, i) => obj[col] = values[i]);
    stmt.free();
    return obj;
  }
  stmt.free();
  return null;
}

function createPost(title, content, author, userId = null, category = '生活') {
  const now = new Date().toISOString();
  db.run('INSERT INTO posts (title, content, author, user_id, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [title, content, author || 'Anonymous', userId, category, now, now]);
  saveDatabase();
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0].values[0][0];
}

function updatePost(id, title, content, author) {
  const now = new Date().toISOString();
  db.run('UPDATE posts SET title = ?, content = ?, author = ?, updated_at = ? WHERE id = ?',
    [title, content, author, now, id]);
  saveDatabase();
}

function deletePost(id) {
  db.run('DELETE FROM posts WHERE id = ?', [id]);
  saveDatabase();
}

async function createUser(username, email, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  try {
    db.run('INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, now]);
    saveDatabase();
    const result = db.exec('SELECT last_insert_rowid() as id');
    return { id: result[0].values[0][0], username, email };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      if (err.message.includes('username')) {
        throw new Error('Username already exists');
      }
      if (err.message.includes('email')) {
        throw new Error('Email already exists');
      }
    }
    throw err;
  }
}

async function verifyUser(username, password) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
  stmt.bind([username, username]);
  
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const user = {};
    columns.forEach((col, i) => user[col] = values[i]);
    stmt.free();
    
    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      return { id: user.id, username: user.username, email: user.email };
    }
  }
  stmt.free();
  return null;
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const user = {};
    columns.forEach((col, i) => user[col] = values[i]);
    stmt.free();
    return user;
  }
  stmt.free();
  return null;
}

function getUserPosts(userId) {
  const result = db.exec(`SELECT * FROM posts WHERE user_id = ${userId} ORDER BY created_at DESC`);
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function getPostsByCategory(category) {
  const stmt = db.prepare('SELECT * FROM posts WHERE category = ? ORDER BY created_at DESC');
  stmt.bind([category]);
  const results = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const obj = {};
    columns.forEach((col, i) => obj[col] = values[i]);
    results.push(obj);
  }
  stmt.free();
  return results;
}

function searchPosts(keyword) {
  const stmt = db.prepare('SELECT * FROM posts WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC');
  const searchTerm = `%${keyword}%`;
  stmt.bind([searchTerm, searchTerm]);
  const results = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const obj = {};
    columns.forEach((col, i) => obj[col] = values[i]);
    results.push(obj);
  }
  stmt.free();
  return results;
}

module.exports = {
  initDatabase,
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  createUser,
  verifyUser,
  getUserById,
  getUserPosts,
  getPostsByCategory,
  searchPosts
};
