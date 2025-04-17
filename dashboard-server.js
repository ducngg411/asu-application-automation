// dashboard-server.js - Máy chủ Express để phục vụ giao diện theo dõi
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');
const chokidar = require('chokidar');

// Cấu hình đường dẫn
const CONFIG = {
  PORT: 3000,
  LOG_DIR: './account_logs',
};

// Khởi tạo Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Phục vụ các file tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint để lấy danh sách kết quả
app.get('/api/results', (req, res) => {
  try {
    const resultsPath = path.join(CONFIG.LOG_DIR, 'results_summary.json');
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      res.json(results);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error reading results:', error);
    res.status(500).json({ error: 'Failed to read results' });
  }
});

// Endpoint để lấy thông tin chi tiết tài khoản
app.get('/api/account/:logFile', (req, res) => {
  try {
    const logFile = req.params.logFile;
    const logPath = path.join(CONFIG.LOG_DIR, path.basename(logFile));
    
    if (fs.existsSync(logPath)) {
      const accountInfo = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      res.json(accountInfo);
    } else {
      res.status(404).json({ error: 'Account log not found' });
    }
  } catch (error) {
    console.error('Error reading account details:', error);
    res.status(500).json({ error: 'Failed to read account details' });
  }
});

// Endpoint để lấy danh sách ảnh chụp màn hình
app.get('/api/screenshots', (req, res) => {
  try {
    const files = fs.readdirSync(CONFIG.LOG_DIR)
      .filter(file => file.endsWith('.png'))
      .map(file => ({
        name: file,
        path: `/screenshots/${file}`,
        date: fs.statSync(path.join(CONFIG.LOG_DIR, file)).mtime
      }))
      .sort((a, b) => b.date - a.date);
    
    res.json(files);
  } catch (error) {
    console.error('Error reading screenshots:', error);
    res.status(500).json({ error: 'Failed to read screenshots' });
  }
});

// Phục vụ các file ảnh từ thư mục logs
app.use('/screenshots', express.static(CONFIG.LOG_DIR));

// Phục vụ trang index.html cho tất cả các route khác
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket để cập nhật theo thời gian thực
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Theo dõi thay đổi trong thư mục logs
const watcher = chokidar.watch(CONFIG.LOG_DIR, {
  persistent: true,
  ignoreInitial: true
});

watcher.on('add', path => {
  io.emit('update', { type: 'add', path });
});

watcher.on('change', path => {
  io.emit('update', { type: 'change', path });
});

// Đảm bảo thư mục logs tồn tại
if (!fs.existsSync(CONFIG.LOG_DIR)) {
  fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
}

// Tạo thư mục public nếu chưa tồn tại
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Khởi động server
server.listen(CONFIG.PORT, () => {
  console.log(`Dashboard server đang chạy tại http://localhost:${CONFIG.PORT}`);
});