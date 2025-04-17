// start.js - Script khởi động cả dashboard và ứng dụng tự động
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Đường dẫn đến các file
const dashboardServerPath = path.join(__dirname, 'dashboard-server.js');
const automationScriptPath = path.join(__dirname, 'asu-application-automation.js');

// Tạo thư mục public nếu chưa tồn tại
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Đảm bảo các file dashboard.js và index.html đã được lưu vào thư mục public
const dashboardJsPath = path.join(publicDir, 'dashboard.js');
const indexHtmlPath = path.join(publicDir, 'index.html');

// Kiểm tra sự tồn tại của các file cần thiết
const requiredFiles = [
  { path: dashboardServerPath, name: 'Dashboard Server' },
  { path: automationScriptPath, name: 'ASU Automation Script' },
  { path: dashboardJsPath, name: 'Dashboard JavaScript' },
  { path: indexHtmlPath, name: 'Dashboard HTML' }
];

let missingFiles = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file.path)) {
    missingFiles.push(file.name);
  }
}

if (missingFiles.length > 0) {
  console.error('Không thể khởi động. Các file sau không tồn tại:');
  missingFiles.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

// Tạo giao diện dòng lệnh
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('==============================================');
console.log('       ASU APPLICATION AUTOMATION SYSTEM      ');
console.log('==============================================');
console.log('');
console.log('Chọn chức năng:');
console.log('1. Khởi động Dashboard');
console.log('2. Chạy ứng dụng tự động tạo tài khoản');
console.log('3. Khởi động cả hai');
console.log('4. Thoát');

rl.question('Nhập lựa chọn của bạn (1-4): ', (answer) => {
  switch (answer.trim()) {
    case '1':
      startDashboard();
      break;
    case '2':
      startAutomation();
      break;
    case '3':
      startBoth();
      break;
    case '4':
      console.log('Thoát chương trình.');
      rl.close();
      process.exit(0);
      break;
    default:
      console.log('Lựa chọn không hợp lệ. Thoát chương trình.');
      rl.close();
      process.exit(1);
  }
});

// Biến lưu trữ các process
let dashboardProcess = null;
let automationProcess = null;

// Hàm khởi động dashboard
function startDashboard() {
  console.log('Đang khởi động Dashboard...');
  
  dashboardProcess = spawn('node', [dashboardServerPath], {
    stdio: 'inherit',
    shell: true
  });
  
  dashboardProcess.on('error', (error) => {
    console.error('Lỗi khi khởi động Dashboard:', error);
  });
  
  dashboardProcess.on('close', (code) => {
    console.log(`Dashboard đã đóng với mã: ${code}`);
  });
  
  console.log('Dashboard đã được khởi động.');
  console.log('Truy cập Dashboard tại: http://localhost:3000');
  
  setupCloseHandler();
}

// Hàm khởi động ứng dụng tự động
function startAutomation() {
  console.log('Đang khởi động Ứng dụng tự động...');
  
  automationProcess = spawn('node', [automationScriptPath], {
    stdio: 'inherit',
    shell: true
  });
  
  automationProcess.on('error', (error) => {
    console.error('Lỗi khi khởi động Ứng dụng tự động:', error);
  });
  
  automationProcess.on('close', (code) => {
    console.log(`Ứng dụng tự động đã đóng với mã: ${code}`);
  });
  
  console.log('Ứng dụng tự động đã được khởi động.');
  
  setupCloseHandler();
}

// Hàm khởi động cả hai
function startBoth() {
  startDashboard();
  
  // Đợi Dashboard khởi động thành công trước khi chạy ứng dụng tự động
  setTimeout(() => {
    startAutomation();
  }, 3000);
}

// Thiết lập xử lý khi đóng ứng dụng
function setupCloseHandler() {
  rl.close();
  
  console.log('\nNhấn Ctrl+C để dừng tất cả các ứng dụng...');
  
  process.on('SIGINT', () => {
    console.log('\nĐang dừng các ứng dụng...');
    
    if (dashboardProcess) {
      dashboardProcess.kill();
    }
    
    if (automationProcess) {
      automationProcess.kill();
    }
    
    console.log('Tất cả các ứng dụng đã được dừng.');
    process.exit(0);
  });
}