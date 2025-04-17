const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { exec } = require('child_process');

// Cấu hình
const CONFIG = {
  ASU_URL: 'https://webapp4.asu.edu/uga_admissionsapp/?partner=SCAP',
  EXCEL_PATH: './emails.xlsx',
  LOG_DIR: './account_logs',
  DEBUGGING_PORT: 9222,
  CHROME_PATH: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  CLOUDFLARE_TIMEOUT: 45000, // 45 giây để CloudFlare tự giải
  PAGE_LOAD_TIMEOUT: 60000,   // 60 giây cho trang tải
  FORM_TIMEOUT: 30000,        // 30 giây cho form xuất hiện
  HUMAN_DELAY: {             // Độ trễ giống người thật
    MIN_TYPE: 50,            // Thời gian tối thiểu giữa các ký tự (ms)
    MAX_TYPE: 150,           // Thời gian tối đa giữa các ký tự (ms)
    MIN_ACTION: 500,         // Thời gian tối thiểu giữa các hành động (ms)
    MAX_ACTION: 2000,        // Thời gian tối đa giữa các hành động (ms)
  }
};

// Đảm bảo thư mục logs tồn tại
if (!fs.existsSync(CONFIG.LOG_DIR)) {
  fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
}

// Hàm tạo độ trễ ngẫu nhiên giữa MIN và MAX
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Hàm chờ ngẫu nhiên giữa các hành động
async function humanDelay(type = 'action') {
  const delay = type === 'typing' 
    ? randomDelay(CONFIG.HUMAN_DELAY.MIN_TYPE, CONFIG.HUMAN_DELAY.MAX_TYPE)
    : randomDelay(CONFIG.HUMAN_DELAY.MIN_ACTION, CONFIG.HUMAN_DELAY.MAX_ACTION);
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Hàm nhập text theo kiểu người thật (chậm, có độ trễ ngẫu nhiên)
async function typeHumanLike(element, text) {
  for (const char of text) {
    await element.sendKeys(char);
    await humanDelay('typing');
  }
}

// Hàm đọc email từ file Excel
async function readEmailFromExcel() {
  try {
    console.log(`Đọc email từ file: ${CONFIG.EXCEL_PATH}`);
    
    if (!fs.existsSync(CONFIG.EXCEL_PATH)) {
      throw new Error(`Không tìm thấy file Excel tại: ${CONFIG.EXCEL_PATH}`);
    }
    
    const workbook = XLSX.readFile(CONFIG.EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      throw new Error('File Excel không có sheet nào');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      throw new Error('Sheet Excel trống hoặc không có dữ liệu hợp lệ');
    }
    
    const emails = data.map(row => row.email || row.Email || '').filter(email => email && email.includes('@'));
    
    if (emails.length === 0) {
      throw new Error('Không tìm thấy email hợp lệ. Đảm bảo có cột tên "email" hoặc "Email"');
    }
    
    console.log(`Đã đọc ${emails.length} email từ Excel`);
    // Trả về email đầu tiên
    return emails[0];
  } catch (error) {
    console.error('LỖI khi đọc email từ Excel:', error);
    // Nếu không đọc được từ Excel, trả về email mặc định
    console.log('Sử dụng email mặc định thay thế');
    return 'test' + Math.floor(Math.random() * 1000) + '@example.com';
  }
}

// Hàm khởi chạy Chrome với debugging enabled
async function launchChromeWithDebugging() {
  console.log('Khởi động Chrome với chế độ remote debugging...');
  
  return new Promise((resolve, reject) => {
    try {
      // Tạo thư mục profile tạm thời
      const tempProfileDir = path.join(__dirname, 'chrome_debug_profile');
      if (!fs.existsSync(tempProfileDir)) {
        fs.mkdirSync(tempProfileDir, { recursive: true });
      }
      
      // Lệnh để chạy Chrome với remote debugging
      const chromeCommand = `"${CONFIG.CHROME_PATH}" --remote-debugging-port=${CONFIG.DEBUGGING_PORT} --user-data-dir="${tempProfileDir}"`;
      
      // Sử dụng exec để mở Chrome
      exec(chromeCommand, { windowsHide: false });
      
      // Đợi Chrome khởi động
      setTimeout(() => {
        console.log('Chrome đã được mở thành công.');
        resolve(true);
      }, 3000);
    } catch (error) {
      console.error('LỖI khi khởi động Chrome:', error);
      reject(error);
    }
  });
}

// Hàm kết nối với Chrome đang chạy
async function connectToRunningChrome() {
  console.log(`Kết nối với Chrome đang chạy trên port ${CONFIG.DEBUGGING_PORT}...`);
  
  try {
    // Thiết lập options để kết nối
    const options = new chrome.Options();
    options.debuggerAddress(`localhost:${CONFIG.DEBUGGING_PORT}`);
    
    // Tạo WebDriver
    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    
    // Thiết lập timeout
    await driver.manage().setTimeouts({
      implicit: 5000,
      pageLoad: CONFIG.PAGE_LOAD_TIMEOUT,
      script: 30000,
    });
    
    console.log('Đã kết nối thành công với Chrome đang chạy');
    return driver;
  } catch (error) {
    console.error('LỖI khi kết nối với Chrome:', error);
    throw error;
  }
}

// Hàm tạo dữ liệu ngẫu nhiên
// Cập nhật hàm generateRandomData để sử dụng địa chỉ từ MA và TX
function generateRandomData() {
  // Danh sách họ phổ biến
  const firstNames = ['John', 'Michael', 'William', 'David', 'James', 'Robert', 'Thomas', 'Daniel', 'Matthew', 'Joseph', 'Christopher', 'Anthony', 'Mark', 'Paul', 'Steven',
  'Andrew', 'Joshua', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Gary', 'Ryan', 'Nicholas', 'Eric', 'Jacob', 'Jonathan', 'Justin', 'Scott', 'Brandon', 'Frank'];
  
  // Danh sách tên phổ biến
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill',
  'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards',
  ];
  
  // Chọn ngẫu nhiên
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  // Tạo mật khẩu theo yêu cầu
  const password = generateASUPassword();
  
  // Chọn ngày sinh ngẫu nhiên (2001-2003)
  const birthYear = Math.floor(Math.random() * 3) + 2001;
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  
  // Thông tin bước 2
  const isFemale = Math.random() > 0.5;
  
  // Chọn địa chỉ từ MA hoặc TX
  const randomAddress = generateRealUSAddress();
  
  // Số điện thoại di động ngẫu nhiên
  // Mã vùng cho Massachusetts: 508, 617, 781, 978
  // Mã vùng cho Texas: 214, 281, 512, 713, 817, 832, 972
  const maCodes = ['508', '617', '781', '978'];
  const txCodes = ['214', '281', '512', '713', '817', '832', '972'];
  
  // Chọn mã vùng phù hợp với tiểu bang
  let mobileAreaCode;
  if (randomAddress.state === 'MA') {
    mobileAreaCode = maCodes[Math.floor(Math.random() * maCodes.length)];
  } else {
    mobileAreaCode = txCodes[Math.floor(Math.random() * txCodes.length)];
  }
  
  const mobileNumber = Math.floor(Math.random() * 9000000 + 1000000).toString();
  
  // Sử dụng cùng số điện thoại cho cả di động và cố định
  const phoneAreaCode = mobileAreaCode; 
  const phoneNumber = mobileNumber;
  
  // SSN ngẫu nhiên
  const ssn = generateRandomSSN();
  
  // Thông tin phụ huynh
  const parent1FirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const parent1LastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const parent2FirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const parent2LastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  // Partner/Dependent
  const partnerFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const partnerLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return {
    firstName,
    lastName,
    suffix: 'IV',
    birthMonth,
    birthDay,
    birthYear,
    password,
    // Step 2 info - fill with address from MA or TX
    isFemale,
    gender: isFemale ? 'F' : 'M',
    address: randomAddress.address,
    city: randomAddress.city,
    state: randomAddress.state,
    zipCode: randomAddress.zipCode,
    mobileAreaCode,
    mobileNumber,
    phoneAreaCode,
    phoneNumber,
    ssn,
    // Parents info
    parent1: {
      firstName: parent1FirstName,
      lastName: parent1LastName,
      isLiving: 'Y',
      relation: 'Mother',
      schoolingLevel: 'High School',
      attendedAsu: Math.random() > 0.5 ? 'Y' : 'N'
    },
    parent2: {
      firstName: parent2FirstName,
      lastName: parent2LastName,
      isLiving: 'Y',
      relation: 'Father',
      schoolingLevel: 'Other/Unknown',
      attendedAsu: Math.random() > 0.5 ? 'Y' : 'N'
    },
    // Partner info
    partner: {
      firstName: partnerFirstName,
      lastName: partnerLastName,
      relationship: 'Spouse'
    }
  };
}
  
  // Hàm tạo SSN ngẫu nhiên nhưng hợp lệ theo format
function generateRandomSSN() {
  // Tạo 3 số đầu tiên (không được là 000, 666, hoặc 900-999)
  let area;
  do {
    area = Math.floor(Math.random() * 899 + 1).toString().padStart(3, '0');
  } while (area === '000' || area === '666' || (parseInt(area) >= 900 && parseInt(area) <= 999));

  // Tạo 2 số giữa (00-99, không được là 00)
  let group;
  do {
    group = Math.floor(Math.random() * 99 + 1).toString().padStart(2, '0');
  } while (group === '00');

  // Tạo 4 số cuối (0000-9999, không được là 0000)
  let serial;
  do {
    serial = Math.floor(Math.random() * 9999 + 1).toString().padStart(4, '0');
  } while (serial === '0000');

  return area + group + serial;
}
  
  // Hàm tạo mật khẩu theo yêu cầu của ASU:
  // - Ít nhất 10 ký tự
  // - Bao gồm 3 trong 4 loại ký tự:
  //   - Chữ hoa (A-Z)
  //   - Chữ thường (a-z)
  //   - Số (0-9)
  //   - Ký tự đặc biệt (!%*_-+=:./?)
function generateASUPassword() {
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!%*_-+=:./?';
  
  // Luôn sử dụng tất cả 4 loại ký tự để đảm bảo tuân thủ
  let password = '';
  
  // Thêm ít nhất một ký tự từ mỗi loại
  password += upperChars.charAt(Math.floor(Math.random() * upperChars.length));
  password += lowerChars.charAt(Math.floor(Math.random() * lowerChars.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  
  // Thêm nhiều ký tự ngẫu nhiên để đạt được ít nhất 10 ký tự
  const allChars = upperChars + lowerChars + numbers + specialChars;
  while (password.length < 12) { // Sử dụng 12 để đảm bảo an toàn (nhiều hơn 10 yêu cầu)
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Trộn ngẫu nhiên các ký tự
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Hàm tạo địa chỉ thực tại Hoa Kỳ với zip code phù hợp
function generateRealUSAddress() {
  // Các địa chỉ thực tế tại Massachusetts và Texas
  const realAddresses = [
    // Địa chỉ tại Massachusetts
    {
      address: '123 Tremont St',
      city: 'Boston',
      state: 'MA',
      zipCode: '02108'
    },
    {
      address: '45 Beacon St',
      city: 'Boston',
      state: 'MA',
      zipCode: '02108'
    },
    {
      address: '789 Boylston St',
      city: 'Boston',
      state: 'MA',
      zipCode: '02116'
    },
    {
      address: '101 Memorial Dr',
      city: 'Cambridge',
      state: 'MA',
      zipCode: '02142'
    },
    {
      address: '55 State St',
      city: 'Springfield',
      state: 'MA',
      zipCode: '01103'
    },
    {
      address: '22 Main St',
      city: 'Worcester',
      state: 'MA',
      zipCode: '01608'
    },
    {
      address: '333 Elm St',
      city: 'Newton',
      state: 'MA',
      zipCode: '02458'
    },
    
    // Địa chỉ tại Texas
    {
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201'
    },
    {
      address: '456 Oak Ave',
      city: 'Houston',
      state: 'TX',
      zipCode: '77002'
    },
    {
      address: '789 Pine Blvd',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701'
    },
    {
      address: '101 Maple Dr',
      city: 'San Antonio',
      state: 'TX',
      zipCode: '78205'
    },
    {
      address: '222 Elm St',
      city: 'Fort Worth',
      state: 'TX',
      zipCode: '76102'
    },
    {
      address: '333 Cedar Rd',
      city: 'Plano',
      state: 'TX',
      zipCode: '75024'
    },
    {
      address: '444 Pecan St',
      city: 'Irving',
      state: 'TX',
      zipCode: '75039'
    },
    {
      address: '555 Walnut St',
      city: 'Corpus Christi',
      state: 'TX',
      zipCode: '78401'
    },
    {
      address: '666 Birch St',
      city: 'Laredo',
      state: 'TX',
      zipCode: '78040'
    },
    {
      address: '777 Spruce St',
      city: 'Lubbock',
      state: 'TX',
      zipCode: '79401'
    },
    {
      address: '888 Willow St',
      city: 'Garland',
      state: 'TX',
      zipCode: '75040'
    },
    {
      address: '999 Cypress St',
      city: 'Amarillo',
      state: 'TX',
      zipCode: '79101'
    },
    {
      address: '1010 Ash St',
      city: 'Grand Prairie',
      state: 'TX',
      zipCode: '75050'
    },
    {
      address: '1111 Fir St',
      city: 'McKinney',
      state: 'TX',
      zipCode: '75069'
    },
    {
      address: '1212 Hickory St',
      city: 'Frisco',
      state: 'TX',
      zipCode: '75034'
    },
    {
      address: '1313 Palm St',
      city: 'Mesquite',
      state: 'TX',
      zipCode: '75149'
    },
    {
      address: '1414 Magnolia St',
      city: 'Carrollton',
      state: 'TX',
      zipCode: '75006'
    },
    {
      address: '1515 Chestnut St',
      city: 'Denton',
      state: 'TX',
      zipCode: '76201'
    },
    {
      address: '1616 Oakwood St',
      city: 'Waco',
      state: 'TX',
      zipCode: '76701'
    },
    {
      address: '1717 Maplewood St',
      city: 'Abilene',
      state: 'TX',
      zipCode: '79601'
    },
    {
      address: '1818 Redwood St',
      city: 'Killeen',
      state: 'TX',
      zipCode: '76540'
    },
    {
      address: '1919 Cedarwood St',
      city: 'Tyler',
      state: 'TX',
      zipCode: '75701'
    },
    {
      address: '2020 Oakridge St',
      city: 'Longview',
      state: 'TX',
      zipCode: '75601'
    }
  ];
  
  // Chọn một địa chỉ ngẫu nhiên
  const randomIndex = Math.floor(Math.random() * realAddresses.length);
  return realAddresses[randomIndex];
}

// Hàm xử lý trang thông tin giáo dục (trang 3)
async function handleEducationPage(driver, userData) {
  console.log('\n===== TRANG 3: THÔNG TIN TRƯỜNG HỌC =====');
  
  try {
    // Đợi cho trang load hoàn chỉnh
    await driver.sleep(2000);
    
    // 1. Chọn Country (United States)
    console.log('Chọn Country: United States');
    const countrySelect = await driver.findElement(By.id('form-app-school-country'));
    await scrollToElement(driver, countrySelect);
    await driver.executeScript(`
      const select = arguments[0];
      select.value = 'USA';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, countrySelect);
    await humanDelay();
    
    // 2. Chọn State trùng với state đã điền ở trang 2
    console.log(`Chọn State: ${userData.state}`);
    const stateSelect = await driver.findElement(By.id('form-app-school-state'));
    await scrollToElement(driver, stateSelect);
    await driver.executeScript(`
      const select = arguments[0];
      select.value = '${userData.state}';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, stateSelect);
    await humanDelay();
    
    // Đợi để city load
    await driver.sleep(2000);
    
    // 3. Chọn City
    console.log(`Chọn City: ${userData.city}`);
    const citySelect = await driver.findElement(By.id('form-app-school-city'));
    await scrollToElement(driver, citySelect);
    
    // Kiểm tra xem city có trong danh sách không
    let cityExists = false;
    try {
      cityExists = await driver.executeScript(`
        const select = arguments[0];
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].value === '${userData.city}') {
            return true;
          }
        }
        return false;
      `, citySelect);
    } catch (e) {
      console.log('Lỗi khi kiểm tra city:', e.message);
    }
    
    // Nếu city không có trong danh sách, chọn "Any City"
    let cityToSelect = userData.city;
    if (!cityExists) {
      cityToSelect = 'Any City';
      console.log(`City ${userData.city} không có trong danh sách, chọn "Any City" thay thế`);
    }
    
    await driver.executeScript(`
      const select = arguments[0];
      select.value = '${cityToSelect}';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, citySelect);
    await humanDelay();
    
    // Đợi để school load
    await driver.sleep(1500);
    
    // 4. Chọn "Home School" cho trường học
    console.log('Chọn "Home School" cho High School');
    try {
      const schoolSelect = await driver.findElement(By.id('form-app-high-school'));
      await scrollToElement(driver, schoolSelect);
      
      let homeSchoolExists = await driver.executeScript(`
        const select = arguments[0];
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].text.toLowerCase().includes('home school')) {
            select.selectedIndex = i;
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
            return true;
          }
        }
        return false;
      `, schoolSelect);
      
      if (!homeSchoolExists) {
        // Nếu không tìm thấy Home School, chọn option đầu tiên
        console.log('Không tìm thấy "Home School", chọn trường đầu tiên trong danh sách');
        await driver.executeScript(`
          const select = arguments[0];
          if (select.options.length > 1) {
            select.selectedIndex = 1;
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
          }
        `, schoolSelect);
      }
    } catch (error) {
      console.log('Lỗi khi chọn Home School:', error.message);
    }
    await humanDelay();
    
    // 5. Chọn Graduation Date
    // Chọn một tháng ngẫu nhiên
    const randomMonth = Math.floor(Math.random() * 12) + 1;
    console.log(`Chọn graduation month: ${randomMonth}`);
    const monthSelect = await driver.findElement(By.id('form-app-school-graduation-date-m'));
    await scrollToElement(driver, monthSelect);
    await driver.executeScript(`
      const select = arguments[0];
      select.value = '${randomMonth}';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, monthSelect);
    await humanDelay();
    
    // Chọn năm tốt nghiệp (2022-2024)
    const graduationYear = Math.floor(Math.random() * 3) + 2022;
    console.log(`Điền graduation year: ${graduationYear}`);
    const yearInput = await driver.findElement(By.id('form-app-school-graduation-date-y'));
    await scrollToElement(driver, yearInput);
    await yearInput.clear();
    await typeHumanLike(yearInput, graduationYear.toString());
    await humanDelay();
    
    // 6. Tích checkbox cho transcript name
    console.log('Tích checkbox cho transcript name');
    try {
      const transcriptCheckbox = await driver.findElement(By.id('transcriptName-1'));
      await scrollToElement(driver, transcriptCheckbox);
      await safeClick(driver, transcriptCheckbox);
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy checkbox transcriptName-1:', error.message);
    }
    
    // 7. Click Done
    console.log('Click Done');
    try {
      const doneButton = await driver.findElement(By.css('.hs-done'));
      await scrollToElement(driver, doneButton);
      await safeClick(driver, doneButton);
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy nút Done:', error.message);
    }
    
    // 8. Chọn "I have never attended a college or university"
    console.log('Chọn "I have never attended a college or university"');
    const collegeSelect = await driver.findElement(By.id('app-past-colleges-1'));
    await scrollToElement(driver, collegeSelect);
    await driver.executeScript(`
      const select = arguments[0];
      select.value = 'never attended';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, collegeSelect);
    await humanDelay();
    
    // 9. Click Save & Continue
    console.log('Click Save & Continue');
    const saveButton = await driver.findElement(By.id('btn-accept-start-app-button'));
    await scrollToElement(driver, saveButton);
    await safeClick(driver, saveButton);
    
    // Ghi log thành công
    console.log('Đã hoàn thành điền form trang 3 (Thông tin trường học)!');
    
    // Đợi chuyển trang
    await driver.sleep(3000);
    
    return true;
  } catch (error) {
    console.error('LỖI khi điền form trang 3 (Thông tin trường học):', error);
    throw error;
  }
}

// Hàm xử lý trang Self-reported (trang 4)
async function handleSelfReportedPage(driver) {
  console.log('\n===== TRANG 4: FASTER ADMISSION =====');
  
  try {
    // Đợi cho trang load hoàn chỉnh
    await driver.sleep(2000);
    
    // Chọn "No" cho câu hỏi "Want a faster admission"
    console.log('Chọn "No" cho câu hỏi "Want a faster admission"');
    try {
      const noRadio = await driver.findElement(By.id('self-reported-question-no'));
      await scrollToElement(driver, noRadio);
      await safeClick(driver, noRadio);
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy radio button No cho faster admission:', error.message);
      // Nếu không tìm thấy radio button, có thể trang đã tự chuyển hoặc không có trang này
      console.log('Bỏ qua trang Faster Admission');
      return true;
    }
    
    // Có thể trang sẽ tự chuyển tiếp sau khi chọn No, nếu không thì ta cần tìm nút Continue
    try {
      // Tìm nút Continue nếu có
      const continueButton = await driver.findElement(By.css('input[type="submit"][value="Continue"]'));
      await scrollToElement(driver, continueButton);
      await safeClick(driver, continueButton);
    } catch (e) {
      console.log('Không tìm thấy nút Continue, trang có thể đã tự chuyển tiếp');
    }
    
    // Ghi log thành công
    console.log('Đã hoàn thành điền form trang 4 (Faster Admission)!');
    
    // Đợi chuyển trang
    await driver.sleep(3000);
    
    return true;
  } catch (error) {
    console.error('LỖI khi điền form trang 4 (Faster Admission):', error);
    throw error;
  }
}

// Hàm xử lý trang Residency (trang 5)
async function handleResidencyPage(driver, userData) {
  console.log('\n===== TRANG 5: RESIDENCY INFORMATION =====');
  
  try {
    // Đợi cho trang load hoàn chỉnh
    await driver.sleep(2000);
    
    // Kiểm tra xem trang này có tồn tại không
    let residencyStateExists = false;
    try {
      const stateSelect = await driver.findElement(By.id('residency-domicile-state'));
      residencyStateExists = true;
    } catch (e) {
      console.log('Không tìm thấy trang Residency, có thể đã bỏ qua');
      return true;
    }
    
    if (!residencyStateExists) {
      return true;
    }
    
    // 1. Chọn State cho "State do you consider"
    console.log(`Chọn State: ${userData.state} cho "State do you consider"`);
    const stateSelect = await driver.findElement(By.id('residency-domicile-state'));
    await scrollToElement(driver, stateSelect);
    await driver.executeScript(`
      const select = arguments[0];
      select.value = '${userData.state}';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, stateSelect);
    await humanDelay();
    
    // 2. Chọn State cho "State do your parents"
    console.log(`Chọn State: ${userData.state} cho "State do your parents"`);
    try {
      const parentStateSelect = await driver.findElement(By.id('parent-domicile-state'));
      await scrollToElement(driver, parentStateSelect);
      await driver.executeScript(`
        const select = arguments[0];
        select.value = '${userData.state}';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, parentStateSelect);
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy dropdown parent-domicile-state:', error.message);
    }
    
    // 3. Click Save & Continue
    console.log('Click Save & Continue');
    const saveButton = await driver.findElement(By.id('save-continue-btn'));
    await scrollToElement(driver, saveButton);
    await safeClick(driver, saveButton);
    
    // Ghi log thành công
    console.log('Đã hoàn thành điền form trang 5 (Residency Information)!');
    
    // Đợi chuyển trang
    await driver.sleep(3000);
    
    return true;
  } catch (error) {
    console.error('LỖI khi điền form trang 5 (Residency Information):', error);
    throw error;
  }
}

// Add these helper functions to improve debugging of the modal selection

// Function to help debug modal elements
async function debugModalElements(driver) {
  console.log('Debugging modal elements...');
  
  try {
    // Get all radio buttons
    const radioButtons = await driver.findElements(By.css('input[type="radio"]'));
    console.log(`Found ${radioButtons.length} total radio buttons on page`);
    
    // Get specifically the terms-for-major-all radio buttons
    const termRadios = await driver.findElements(By.css('input[name="terms-for-major-all"]'));
    console.log(`Found ${termRadios.length} radio buttons with name="terms-for-major-all"`);
    
    // List all values of the term radio buttons
    if (termRadios.length > 0) {
      console.log('Values of available radio buttons:');
      for (let i = 0; i < termRadios.length; i++) {
        const value = await termRadios[i].getAttribute('value');
        const id = await termRadios[i].getAttribute('id');
        const isChecked = await termRadios[i].isSelected();
        console.log(`[${i}] value="${value}", id="${id}", checked=${isChecked}`);
      }
    }
    
    // Check if our specific radio button exists
    try {
      const targetRadio = await driver.findElement(By.css('input[value="2254-SESA"]'));
      console.log('Target radio button with value="2254-SESA" exists!');
      const isVisible = await targetRadio.isDisplayed();
      console.log(`Is it visible? ${isVisible}`);
      
      // Get parent elements to check if inside hidden container
      const parentElementClass = await driver.executeScript(`
        const radio = document.querySelector('input[value="2254-SESA"]');
        if (radio) {
          let parent = radio.parentElement;
          let classes = [];
          while (parent && parent.tagName !== 'BODY') {
            classes.push(parent.className);
            parent = parent.parentElement;
          }
          return classes;
        }
        return [];
      `);
      
      console.log('Parent element classes:', parentElementClass);
    } catch (e) {
      console.log('Target radio button does not exist:', e.message);
    }
  } catch (error) {
    console.error('Error during modal debugging:', error);
  }
}

// Enhanced wait function with explicit wait for the modal
async function waitForModalAndRadioButtons(driver, timeout = 10000) {
  console.log(`Waiting up to ${timeout}ms for modal with radio buttons...`);
  
  try {
    // First wait for any modal or dialog to appear
    await driver.wait(async () => {
      const modals = await driver.findElements(By.css('.ui-dialog, .modal, [role="dialog"]'));
      return modals.length > 0;
    }, timeout, 'No modal dialog appeared');
    
    console.log('Modal appeared, now waiting for radio buttons...');
    
    // Then wait for radio buttons within the modal
    await driver.wait(async () => {
      const radioButtons = await driver.findElements(By.css('input[name="terms-for-major-all"]'));
      return radioButtons.length > 0;
    }, timeout, 'No radio buttons found in modal');
    
    console.log('Radio buttons are now available');
    
    // Give a moment for any animations to complete
    await driver.sleep(1000);
    
    return true;
  } catch (error) {
    console.error('Error waiting for modal:', error.message);
    // Run debug function to get more information
    await debugModalElements(driver);
    return false;
  }
}



// Hàm xử lý trang chọn ngành học (trang 6)
// Replace the entire handleMajorSelectionPage function with this version
// Complete Major Selection Process handling both first and second major
// Complete Major Selection Process handling both first and second major
async function handleMajorSelectionPage(driver) {
  console.log('\n===== TRANG 6: MAJOR SELECTION =====');
  
  try {
    // Đợi cho trang load hoàn chỉnh
    await driver.sleep(3000);
    
    // Kiểm tra xem trang này có tồn tại không
    let majorSelectionExists = false;
    try {
      const searchButton = await driver.findElement(By.css('.search-button'));
      majorSelectionExists = true;
    } catch (e) {
      console.log('Không tìm thấy trang Major Selection, có thể đã bỏ qua');
      return true;
    }
    
    if (!majorSelectionExists) {
      return true;
    }
    
    // ======= PHẦN 1: CHỌN MAJOR THỨ NHẤT =======
    console.log('\n--- PHẦN 1: CHỌN MAJOR THỨ NHẤT ---');
    
    // 1.1. Click Search button cho Location
    console.log('Click Search button cho Course by Location');
    try {
      // Tìm nút Search chính xác bằng thuộc tính onclick
      const searchButton = await driver.findElement(By.css("input[value='Search'][onclick='doLocationSearch();']"));
      
      if (searchButton) {
        await scrollToElement(driver, searchButton);
        await safeClick(driver, searchButton);
        await humanDelay();
        console.log('Đã click nút Search cho Location Search');
      }
    } catch (error) {
      console.log('Không tìm thấy nút Search chính xác qua CSS, thử XPath...');
      
      try {
        // Thử tìm bằng XPath
        const searchButtonXPath = await driver.findElement(By.xpath("//input[@value='Search' and @onclick='doLocationSearch();']"));
        await scrollToElement(driver, searchButtonXPath);
        await safeClick(driver, searchButtonXPath);
        await humanDelay();
        console.log('Đã click nút Search qua XPath');
      } catch (e) {
        console.log('Không tìm thấy nút Search qua XPath, thử JavaScript...');
        
        // Dùng JavaScript để click
        const jsClicked = await driver.executeScript(`
          const buttons = document.querySelectorAll("input[value='Search']");
          for (let btn of buttons) {
            if (btn.getAttribute('onclick') === 'doLocationSearch();') {
              btn.click();
              return true;
            }
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click nút Search qua JavaScript');
          await humanDelay();
        } else {
          console.log('Không thể click nút Search, bỏ qua bước này');
        }
      }
    }
    
    // Đợi kết quả search
    await driver.sleep(2000);
    
    // 1.2. Click Choose button để chọn major đầu tiên
    console.log('Click Choose button để chọn major đầu tiên');
    try {
      const chooseButton = await driver.findElement(By.css('.choose.localStore'));
      await scrollToElement(driver, chooseButton);
      await safeClick(driver, chooseButton);
      await humanDelay();
      console.log('Đã click Choose button cho major đầu tiên');
    } catch (error) {
      console.log('Không tìm thấy nút Choose đầu tiên qua CSS, thử XPath...');
      
      try {
        const chooseButton = await driver.findElement(By.xpath("//input[@value='Choose']"));
        await scrollToElement(driver, chooseButton);
        await safeClick(driver, chooseButton);
        await humanDelay();
        console.log('Đã click Choose button đầu tiên qua XPath');
      } catch (e) {
        console.log('Không tìm thấy nút Choose đầu tiên qua XPath, thử JavaScript...');
        
        const jsClicked = await driver.executeScript(`
          const chooseButtons = document.querySelectorAll("input[value='Choose']");
          if (chooseButtons.length > 0) {
            chooseButtons[0].click();
            return true;
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click Choose button đầu tiên qua JavaScript');
          await humanDelay();
        } else {
          console.log('Không thể click Choose button đầu tiên');
        }
      }
    }
    
    // 1.3. Đợi modal hiện ra và chọn radio button cho major đầu tiên
    console.log('Đợi modal hiển thị cho major đầu tiên...');
    await driver.sleep(2000);
    
    try {
      // Tìm và chọn radio button
      const firstRadio = await driver.findElement(By.css('input[name="terms-for-major-all"]'));
      await scrollToElement(driver, firstRadio);
      await safeClick(driver, firstRadio);
      console.log('Đã chọn radio button cho major đầu tiên');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy radio button cho major đầu tiên, thử JavaScript...');
      
      const jsClicked = await driver.executeScript(`
        const radios = document.querySelectorAll('input[name="terms-for-major-all"]');
        if (radios.length > 0) {
          radios[0].click();
          return true;
        }
        return false;
      `);
      
      if (jsClicked) {
        console.log('Đã chọn radio button cho major đầu tiên qua JavaScript');
        await humanDelay();
      } else {
        console.log('Không thể chọn radio button cho major đầu tiên');
      }
    }
    
    // 1.4. Click Add Major sau khi chọn radio button
    console.log('Click Add Major cho major đầu tiên');
    try {
      const addMajorButton = await driver.findElement(By.css("input[value='Add Major'][onclick*='validateAndSet']"));
      await scrollToElement(driver, addMajorButton);
      await safeClick(driver, addMajorButton);
      console.log('Đã click Add Major cho major đầu tiên');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy nút Add Major cho major đầu tiên, thử cách khác...');
      
      try {
        const addMajorButton = await driver.findElement(By.css("input[value='Add Major']"));
        await scrollToElement(driver, addMajorButton);
        await safeClick(driver, addMajorButton);
        console.log('Đã click Add Major cho major đầu tiên (cách 2)');
        await humanDelay();
      } catch (e) {
        console.log('Không tìm thấy nút Add Major cho major đầu tiên, thử JavaScript...');
        
        const jsClicked = await driver.executeScript(`
          const addButtons = document.querySelectorAll("input[value='Add Major']");
          if (addButtons.length > 0) {
            addButtons[0].click();
            return true;
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click Add Major cho major đầu tiên qua JavaScript');
          await humanDelay();
        } else {
          console.log('Không thể click Add Major cho major đầu tiên');
        }
      }
    }
    
    // ======= PHẦN 2: CHỌN MAJOR THỨ HAI (SECOND MAJOR) =======
    console.log('\n--- PHẦN 2: CHỌN MAJOR THỨ HAI ---');
    await driver.sleep(2000);
    
    // 2.1. Chọn "Business" trong Secondary Interest dropdown
    console.log('Chọn "Business" trong Secondary Interest dropdown');
    try {
      const interestSelect = await driver.findElement(By.id('form-app-secondary-interests'));
      await scrollToElement(driver, interestSelect);
      
      // Chọn "Business" trong dropdown
      await driver.executeScript(`
        const select = arguments[0];
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].text === 'Business') {
            select.selectedIndex = i;
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
            break;
          }
        }
      `, interestSelect);
      
      console.log('Đã chọn "Business" trong Secondary Interest dropdown');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy Secondary Interest dropdown:', error.message);
    }
    
    // 2.2. Tick checkbox "Future opportunities"
    try {
      console.log('Tick checkbox "Future opportunities"');
      const futureCheckbox = await driver.findElement(By.id('teacher-cert-interest'));
      await scrollToElement(driver, futureCheckbox);
      await safeClick(driver, futureCheckbox);
      console.log('Đã tick checkbox Future opportunities');
      await humanDelay();
    } catch (e) {
      console.log('Không tìm thấy checkbox Future opportunities:', e.message);
    }
    
    // 2.3. Click nút Search cho Secondary Interest
    console.log('Click nút Search cho Secondary Interest');
    try {
      // Tìm nút Search với onclick="doInterestsSecondarySearch();"
      const searchButton = await driver.findElement(By.css("input.search-button[onclick='doInterestsSecondarySearch();']"));
      await scrollToElement(driver, searchButton);
      await safeClick(driver, searchButton);
      console.log('Đã click nút Search cho Secondary Interest');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy nút Search cho Secondary Interest qua CSS, thử XPath...');
      
      try {
        const searchButtonXPath = await driver.findElement(By.xpath("//input[@value='Search' and @onclick='doInterestsSecondarySearch();']"));
        await scrollToElement(driver, searchButtonXPath);
        await safeClick(driver, searchButtonXPath);
        console.log('Đã click nút Search cho Secondary Interest qua XPath');
        await humanDelay();
      } catch (e) {
        console.log('Không tìm thấy nút Search cho Secondary Interest qua XPath, thử JavaScript...');
        
        const jsClicked = await driver.executeScript(`
          const buttons = document.querySelectorAll("input[value='Search']");
          for (let btn of buttons) {
            if (btn.getAttribute('onclick') === 'doInterestsSecondarySearch();') {
              btn.click();
              return true;
            }
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click nút Search cho Secondary Interest qua JavaScript');
          await humanDelay();
        } else {
          console.log('Không thể click nút Search cho Secondary Interest');
        }
      }
    }
    
    // Đợi kết quả search
    await driver.sleep(2000);
    
    // 2.4. Click Choose button cho major thứ hai
    console.log('Click Choose button cho major thứ hai');
    try {
      // Dùng ID và class từ HTML bạn cung cấp
      const chooseButton = await driver.findElement(By.css("input#form-app-major.tips.choose.localStore[value='Choose']"));
      await scrollToElement(driver, chooseButton);
      await safeClick(driver, chooseButton);
      console.log('Đã click Choose button cho major thứ hai');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy nút Choose cho major thứ hai qua CSS chính xác, thử CSS đơn giản...');
      
      try {
        const chooseButton = await driver.findElement(By.css("input[value='Choose']"));
        await scrollToElement(driver, chooseButton);
        await safeClick(driver, chooseButton);
        console.log('Đã click Choose button cho major thứ hai qua CSS đơn giản');
        await humanDelay();
      } catch (e) {
        console.log('Không tìm thấy nút Choose cho major thứ hai qua CSS đơn giản, thử JavaScript...');
        
        const jsClicked = await driver.executeScript(`
          const chooseButtons = document.querySelectorAll("input[value='Choose']");
          if (chooseButtons.length > 0) {
            // Thử chọn nút Choose thứ hai nếu có
            if (chooseButtons.length > 1) {
              chooseButtons[1].click();
            } else {
              chooseButtons[0].click();
            }
            return true;
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click Choose button cho major thứ hai qua JavaScript');
          await humanDelay();
        } else {
          console.log('Không thể click Choose button cho major thứ hai');
        }
      }
    }
    
    // 2.5. Chọn radio button trong modal (sử dụng value="2254-SESA" như bạn đã cung cấp)
    console.log('Đợi modal hiển thị cho major thứ hai...');
    await driver.sleep(2000);
    
    console.log('Tìm và chọn radio button có value="2254-SESA"');
    try {
      const targetRadio = await driver.findElement(By.css('input[name="terms-for-major-all"][value="2254-SESA"]'));
      await scrollToElement(driver, targetRadio);
      await safeClick(driver, targetRadio);
      console.log('Đã chọn radio button có value="2254-SESA"');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy radio button có value="2254-SESA", thử JavaScript...');
      
      const jsClicked = await driver.executeScript(`
        const radio = document.querySelector('input[name="terms-for-major-all"][value="2254-SESA"]');
        if (radio) {
          radio.click();
          return true;
        }
        
        // Nếu không tìm thấy, chọn radio button đầu tiên
        const anyRadio = document.querySelector('input[name="terms-for-major-all"]');
        if (anyRadio) {
          anyRadio.click();
          return true;
        }
        
        return false;
      `);
      
      if (jsClicked) {
        console.log('Đã chọn radio button cho major thứ hai qua JavaScript');
        await humanDelay();
      } else {
        console.log('Không thể chọn radio button cho major thứ hai');
      }
    }
    
    // 2.6. Click Add Major sau khi chọn radio button
    console.log('Click Add Major cho major thứ hai');
    try {
      // Sử dụng selector chính xác theo HTML bạn cung cấp
      const addMajorButton = await driver.findElement(By.css("input[value='Add Major'][onclick*='validateAndSetSecondarySelection']"));
      await scrollToElement(driver, addMajorButton);
      await safeClick(driver, addMajorButton);
      console.log('Đã click Add Major cho major thứ hai');
      await humanDelay();
    } catch (error) {
      console.log('Không tìm thấy nút Add Major cho major thứ hai qua CSS chính xác, thử CSS đơn giản...');
      
      try {
        const addMajorButton = await driver.findElement(By.css("input[value='Add Major']"));
        await scrollToElement(driver, addMajorButton);
        await safeClick(driver, addMajorButton);
        console.log('Đã click Add Major cho major thứ hai qua CSS đơn giản');
        await humanDelay();
      } catch (e) {
        console.log('Không tìm thấy nút Add Major cho major thứ hai qua CSS đơn giản, thử JavaScript...');
        
        const jsClicked = await driver.executeScript(`
          const addButtons = document.querySelectorAll("input[value='Add Major']");
          if (addButtons.length > 0) {
            addButtons[0].click();
            return true;
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click Add Major cho major thứ hai qua JavaScript');
          await humanDelay();
        } else {
          console.log('Không thể click Add Major cho major thứ hai');
        }
      }
    }
    
    // 2.7. Click Save & Continue sau khi thêm cả hai major
    console.log('Click Save & Continue');
    try {
      // Sử dụng ID chính xác theo HTML bạn cung cấp
      const saveButton = await driver.findElement(By.id('selected-major-save-continue-btn'));
      await scrollToElement(driver, saveButton);
      await safeClick(driver, saveButton);
      console.log('Đã click Save & Continue');
    } catch (error) {
      console.log('Không tìm thấy nút Save & Continue theo ID, thử CSS...');
      
      try {
        const saveButtonCSS = await driver.findElement(By.css("input[value='Save & Continue']"));
        await scrollToElement(driver, saveButtonCSS);
        await safeClick(driver, saveButtonCSS);
        console.log('Đã click Save & Continue qua CSS');
      } catch (e) {
        console.log('Không tìm thấy nút Save & Continue qua CSS, thử JavaScript...');
        
        const jsClicked = await driver.executeScript(`
          const saveButton = document.querySelector("#selected-major-save-continue-btn, input[value='Save & Continue']");
          if (saveButton) {
            saveButton.click();
            return true;
          }
          return false;
        `);
        
        if (jsClicked) {
          console.log('Đã click Save & Continue qua JavaScript');
        } else {
          console.log('Không thể click Save & Continue');
        }
      }
    }
    
    // Ghi log thành công
    console.log('Đã hoàn thành điền form trang 6 (Major Selection) với cả hai major!');
    
    // Đợi chuyển trang
    await driver.sleep(3000);
    
    return true;
  } catch (error) {
    console.error('LỖI khi điền form trang 6 (Major Selection):', error);
    throw error;
  }
}

// Hàm xử lý trang cuối cùng và submit application
async function handleFinalSubmitPage(driver) {
  console.log('\n===== TRANG 7: FINAL REVIEW & SUBMIT =====');
  
  try {
    // Đợi cho trang load hoàn chỉnh
    await driver.sleep(3000);
    
    // Kiểm tra xem trang này có tồn tại không
    let finalPageExists = false;
    try {
      const confirmCheckbox = await driver.findElement(By.id('review-checkbox'));
      finalPageExists = true;
    } catch (e) {
      console.log('Không tìm thấy trang Final Review, có thể quá trình đã hoàn tất');
      return true;
    }
    
    if (!finalPageExists) {
      return true;
    }
    
    // 1. Tick checkbox xác nhận
    console.log('Tick checkbox xác nhận');
    const confirmCheckbox = await driver.findElement(By.id('review-checkbox'));
    await scrollToElement(driver, confirmCheckbox);
    await safeClick(driver, confirmCheckbox);
    await humanDelay();
    
    // 2. Click Submit My Application
    console.log('Click Submit My Application');
    const submitButton = await driver.findElement(By.id('review-submit'));
    await scrollToElement(driver, submitButton);
    await safeClick(driver, submitButton);
    
    // 3. Đợi trang xác nhận thành công load
    console.log('Đợi trang xác nhận thành công load...');
    try {
      // Đợi tối đa 30 giây cho trang xác nhận thành công
      await driver.wait(until.elementLocated(By.xpath("//h1[contains(text(), 'Application Submitted')]")), 30000);
      
      console.log('THÀNH CÔNG! Đơn đăng ký đã được nộp thành công!');
      
      // Chụp ảnh màn hình thành công
      try {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(CONFIG.LOG_DIR, `success_final_${timestamp}.png`);
        
        const screenshot = await driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, screenshot, 'base64');
        
        console.log(`Đã lưu ảnh kết quả cuối cùng tại: ${screenshotPath}`);
      } catch (e) {
        console.error('Không thể chụp ảnh kết quả cuối cùng:', e.message);
      }
      
      return true;
    } catch (timeoutError) {
      console.log('Không thấy trang xác nhận thành công trong thời gian chờ!');
      
      // Kiểm tra xem có lỗi không
      const pageSource = await driver.getPageSource();
      if (pageSource.includes('error') || pageSource.includes('Error') || pageSource.includes('fail') || pageSource.includes('Fail')) {
        console.error('Có thể đã xảy ra lỗi khi nộp đơn!');
        
        // Chụp ảnh màn hình lỗi
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = path.join(CONFIG.LOG_DIR, `error_final_${timestamp}.png`);
        
        const screenshot = await driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, screenshot, 'base64');
        
        console.log(`Đã lưu ảnh lỗi cuối cùng tại: ${screenshotPath}`);
        
        throw new Error('Có lỗi xảy ra khi nộp đơn!');
      }
      
      // Nếu không phát hiện lỗi, có thể trang đang tải chậm
      console.log('Không phát hiện lỗi, có thể trang đang tải chậm. Đợi thêm...');
      await driver.sleep(10000);
      
      // Kiểm tra lại
      const updatedPageSource = await driver.getPageSource();
      if (updatedPageSource.includes('Application Submitted') || updatedPageSource.includes('Success') || updatedPageSource.includes('success')) {
        console.log('THÀNH CÔNG! Đơn đăng ký đã được nộp thành công!');
        return true;
      } else {
        console.error('Không thể xác nhận đơn đã được nộp thành công!');
        throw new Error('Không thể xác nhận đơn đã được nộp thành công!');
      }
    }
  } catch (error) {
    console.error('LỖI khi nộp đơn cuối cùng:', error);
    throw error;
  }
}
  
  // Hàm kiểm tra mật khẩu đáp ứng các yêu cầu của ASU
function verifyPasswordRequirements(password) {
  // Kiểm tra độ dài tối thiểu
  if (password.length < 10) {
    return false;
  }
  
  // Kiểm tra số loại ký tự
  let typesCount = 0;
  
  // Kiểm tra chữ hoa
  if (/[A-Z]/.test(password)) typesCount++;
  
  // Kiểm tra chữ thường
  if (/[a-z]/.test(password)) typesCount++;
  
  // Kiểm tra chữ số
  if (/[0-9]/.test(password)) typesCount++;
  
  // Kiểm tra ký tự đặc biệt
  if (/[!%*_\-+=:./?]/.test(password)) typesCount++;
  
  // Cần ít nhất 3 trong 4 loại
  return typesCount >= 3;
}
  
  // Hàm lưu thông tin tài khoản
  function saveAccountInfo(accountInfo) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = path.join(CONFIG.LOG_DIR, `account_${timestamp}.json`);
    
    fs.writeFileSync(fileName, JSON.stringify(accountInfo, null, 2));
    console.log(`Đã lưu thông tin tài khoản vào file: ${fileName}`);
    
    // In thông tin ra console để người dùng dễ thấy
    console.log("\n===== THÔNG TIN TÀI KHOẢN =====");
    console.log(`Email: ${accountInfo.email}`);
    console.log(`Họ tên: ${accountInfo.firstName} ${accountInfo.lastName} ${accountInfo.suffix}`);
    console.log(`Ngày sinh: ${accountInfo.birthMonth}/${accountInfo.birthDay}/${accountInfo.birthYear}`);
    console.log(`Mật khẩu: ${accountInfo.password}`);
    
    if (accountInfo.address) {
      console.log(`\n----- THÔNG TIN THÊM -----`);
      console.log(`Giới tính: ${accountInfo.isFemale ? 'Nữ' : 'Nam'}`);
      console.log(`Địa chỉ: ${accountInfo.address}, ${accountInfo.city}, ${accountInfo.state} ${accountInfo.zipCode}`);
      console.log(`Số điện thoại di động: ${accountInfo.mobileAreaCode}-${accountInfo.mobileNumber}`);
      console.log(`Số điện thoại cố định: ${accountInfo.phoneAreaCode}-${accountInfo.phoneNumber}`);
      console.log(`SSN: ${accountInfo.ssn}`);
      
      console.log(`\n----- THÔNG TIN PHỤ HUYNH -----`);
      console.log(`Mẹ: ${accountInfo.parent1.firstName} ${accountInfo.parent1.lastName}`);
      console.log(`Bố: ${accountInfo.parent2.firstName} ${accountInfo.parent2.lastName}`);
      
      console.log(`\n----- THÔNG TIN PARTNER -----`);
      console.log(`Họ tên: ${accountInfo.partner.firstName} ${accountInfo.partner.lastName}`);
      console.log(`Email: ${accountInfo.email}`);
    }
    
    console.log("================================\n");
    
    return fileName;
  }

// Hàm đợi Cloudflare và trang form hiển thị
async function waitForPageLoad(driver, elementId) {
    console.log('Đợi CloudFlare xác thực và trang tải...');
    
    try {
      // Đợi cho đến khi element xuất hiện
      await driver.wait(
        until.elementLocated(By.id(elementId)),
        CONFIG.CLOUDFLARE_TIMEOUT,
        `Timeout khi đợi element với ID ${elementId}`
      );
      
      console.log('Trang đã tải thành công!');
      return true;
    } catch (error) {
      console.error('LỖI khi đợi trang tải:', error.message);
      
      // Kiểm tra xem có phải đang ở trang CloudFlare không
      try {
        const pageSource = await driver.getPageSource();
        if (pageSource.includes('cloudflare') || pageSource.includes('cf-') || pageSource.includes('challenge')) {
          console.log('Vẫn đang ở trang CloudFlare. Tiếp tục đợi...');
          
          // Đợi thêm thời gian
          await driver.sleep(10000);
          
          // Kiểm tra lại
          await driver.wait(
            until.elementLocated(By.id(elementId)),
            30000,
            `Timeout khi đợi element với ID ${elementId}`
          );
          
          console.log('Đã vượt qua CloudFlare và trang đã tải!');
          return true;
        }
      } catch (e) {
        console.error('Không thể xác định trạng thái trang:', e.message);
      }
      
      throw error;
    }
  }
  
  // Hàm để điền form trang 1 và chuyển đến trang 2
  async function fillCreateAccountForm(driver, email, retryCount = 0) {
    console.log(`Bắt đầu điền form tạo tài khoản (Trang 1)${retryCount > 0 ? ` - Lần thử ${retryCount + 1}` : ''}...`);
    
    // Số lần thử lại tối đa
    const MAX_RETRIES = 3;
    
    // Tạo dữ liệu ngẫu nhiên
    const userData = generateRandomData();
    
    try {
      // Xóa các trường đã điền trước đó (nếu là lần thử lại)
      if (retryCount > 0) {
        console.log('Xóa dữ liệu đã điền trước đó...');
        const fieldsToClear = [
          'form-app-name-first', 
          'form-app-name-last', 
          'form-app-dob-y', 
          'form-app-email', 
          'form-app-retype-email', 
          'form-app-password', 
          'form-app-retype-password'
        ];
        
        for (const fieldId of fieldsToClear) {
          try {
            const field = await driver.findElement(By.id(fieldId));
            await field.clear();
            await humanDelay('typing');
          } catch (e) {
            console.log(`Không thể xóa trường ${fieldId}: ${e.message}`);
          }
        }
      }
      
      // Điền First Name
      console.log(`Điền First Name: ${userData.firstName}`);
      const firstNameInput = await driver.findElement(By.id('form-app-name-first'));
      await typeHumanLike(firstNameInput, userData.firstName);
      await humanDelay();
      
      // Điền Last Name
      console.log(`Điền Last Name: ${userData.lastName}`);
      const lastNameInput = await driver.findElement(By.id('form-app-name-last'));
      await typeHumanLike(lastNameInput, userData.lastName);
      await humanDelay();
      
      // Chọn Suffix (IV)
      console.log('Chọn Suffix: IV');
      const suffixSelect = await driver.findElement(By.id('form-app-name-suffix'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = '${userData.suffix}';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, suffixSelect);
      await humanDelay();
      
      // Chọn tháng sinh
      console.log(`Chọn tháng sinh: ${userData.birthMonth}`);
      const monthSelect = await driver.findElement(By.id('form-app-dob-m'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = '${userData.birthMonth}';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, monthSelect);
      await humanDelay();
      
      // Đợi một chút để ngày load
      await driver.sleep(1000);
      
      // Chọn ngày sinh
      console.log(`Chọn ngày sinh: ${userData.birthDay}`);
      const daySelect = await driver.findElement(By.id('form-app-dob-d'));
      await driver.executeScript(`
        const select = arguments[0];
        const options = select.options;
        if (options.length > ${userData.birthDay}) {
          select.value = '${userData.birthDay}';
        } else if (options.length > 1) {
          select.value = options[1].value;
        }
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, daySelect);
      await humanDelay();
      
      // Điền năm sinh
      console.log(`Điền năm sinh: ${userData.birthYear}`);
      const birthYearInput = await driver.findElement(By.id('form-app-dob-y'));
      await typeHumanLike(birthYearInput, userData.birthYear.toString());
      await humanDelay();
      
      // Điền Email
      console.log(`Điền Email: ${email}`);
      const emailInput = await driver.findElement(By.id('form-app-email'));
      await typeHumanLike(emailInput, email);
      await humanDelay();
      
      // Điền lại Email
      console.log(`Điền lại Email: ${email}`);
      const retypeEmailInput = await driver.findElement(By.id('form-app-retype-email'));
      await typeHumanLike(retypeEmailInput, email);
      await humanDelay();
      
      // Điền Password
      console.log(`Điền Password: ${userData.password}`);
      const passwordInput = await driver.findElement(By.id('form-app-password'));
      await typeHumanLike(passwordInput, userData.password);
      await humanDelay();
      
      // Điền lại Password
      console.log(`Điền lại Password: ${userData.password}`);
      const retypePasswordInput = await driver.findElement(By.id('form-app-retype-password'));
      await typeHumanLike(retypePasswordInput, userData.password);
      await humanDelay();
      
      // Lưu thông tin tài khoản
      const accountInfo = {
        ...userData,
        email: email,
        timestamp: new Date().toISOString()
      };
      
      const logFile = saveAccountInfo(accountInfo);
      
      // Nhấn nút "Start My Application" 
      console.log('Nhấn nút "Start My Application"...');
      const startButton = await driver.findElement(By.id('start-my-application'));
      await startButton.click();
      await humanDelay();
      
      // Kiểm tra thông báo lỗi sau khi nhấn nút
      try {
        // Đợi một lúc để xem có thông báo lỗi hiện lên không
        await driver.sleep(2000);
        
        // Tìm thông báo lỗi trên trang
        const errorElements = await driver.findElements(By.css('.error-msg, .invalid-feedback, .alert-danger, .form-error'));
        
        if (errorElements.length > 0) {
          // Có lỗi xảy ra, ghi lại thông báo lỗi
          console.log('Phát hiện lỗi khi submit form:');
          for (const errorElement of errorElements) {
            const errorText = await errorElement.getText();
            console.log(`- ${errorText}`);
          }
          
          // Kiểm tra xem có lỗi liên quan đến mật khẩu không
          const pageSource = await driver.getPageSource();
          const hasPasswordError = pageSource.includes('password') && 
                                (pageSource.includes('error') || pageSource.includes('invalid'));
          
          if (hasPasswordError) {
            console.log('Có lỗi liên quan đến mật khẩu. Tạo mật khẩu mới mạnh hơn...');
            userData.password = generateASUPassword();
            console.log(`Mật khẩu mới: ${userData.password}`);
          }
          
          // Thử lại nếu chưa vượt quá số lần thử
          if (retryCount < MAX_RETRIES) {
            console.log(`Thử lại lần ${retryCount + 2}...`);
            return await fillCreateAccountForm(driver, email, retryCount + 1);
          } else {
            throw new Error(`Đã thử lại ${MAX_RETRIES} lần nhưng vẫn không thành công.`);
          }
        }
        
        // Nếu không có lỗi, nhấn lần nữa để chắc chắn
        try {
          console.log('Nhấn nút "Start My Application" lần 2...');
          await startButton.click();
        } catch (clickError) {
          console.log('Không thể nhấn nút lần 2, có thể đã chuyển trang');
        }
        
        // Đợi để page 2 load
        try {
          await driver.wait(
            until.elementLocated(By.css('#pronoun-1, #gender-1, #form-app-country')), 
            20000, 
            'Không tìm thấy các element trên trang 2'
          );
          
          console.log('Đã chuyển đến trang 2 thành công!');
        } catch (error) {
          console.log('Không thể xác nhận đã chuyển đến trang 2:', error.message);
          
          // Kiểm tra xem còn ở trang 1 không
          const isStillOnPage1 = await driver.findElements(By.id('start-my-application'));
          if (isStillOnPage1.length > 0) {
            console.log('Vẫn còn ở trang 1. Thử lại...');
            if (retryCount < MAX_RETRIES) {
              return await fillCreateAccountForm(driver, email, retryCount + 1);
            } else {
              throw new Error(`Đã thử lại ${MAX_RETRIES} lần nhưng vẫn không thành công.`);
            }
          }
          
          console.log('Cố gắng tiếp tục xử lý...');
        }
    
        return accountInfo;
      } catch (error) {
        console.error('LỖI khi điền form trang 1:', error);
        
        // Thử lại nếu chưa vượt quá số lần thử
        if (retryCount < MAX_RETRIES) {
          console.log(`Gặp lỗi. Thử lại lần ${retryCount + 2}...`);
          await driver.sleep(2000); // Đợi một chút trước khi thử lại
          return await fillCreateAccountForm(driver, email, retryCount + 1);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('LỖI khi điền form:', error.message);
      throw error;
    }
}
// Hàm thực hiện javascript click an toàn để tránh lỗi element không click được
async function safeClick(driver, element) {
    try {
      // Thử click thông thường trước
      await element.click();
    } catch (error) {
      // Nếu không click được, dùng JavaScript để click
      console.log('Không thể click bằng phương pháp thông thường, dùng JavaScript để click...');
      await driver.executeScript("arguments[0].click();", element);
    }
  }
  
  // Cuộn trang đến phần tử để đảm bảo nó hiển thị và có thể click
  async function scrollToElement(driver, element) {
    await driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
    await driver.sleep(500); // Đợi một chút để hoàn thành cuộn
  }
  
  // Hàm xử lý trang 2 (thông tin cá nhân và địa chỉ)
  async function fillPersonalInfoForm(driver, userData, email, retryCount = 0) {
    // Số lần thử lại tối đa
    const MAX_RETRIES = 3;
    
    console.log('Bắt đầu điền form thông tin cá nhân (Trang 2)...');
    
    try {
      // Đợi trang 2 load hoàn tất
      await driver.sleep(3000);
      
      // 1. Tích checkbox giới tính và đại từ
      console.log('Tích checkbox giới tính và đại từ...');
      
      // Cuộn trang để đảm bảo các phần tử giới tính hiển thị
      const pronoun1Element = await driver.findElement(By.id('pronoun-1'));
      await scrollToElement(driver, pronoun1Element);
      
      if (userData.isFemale) {
        // Tích She/Her
        console.log('Chọn She/Her...');
        const sheHerCheckbox = await driver.findElement(By.id('pronoun-2'));
        await safeClick(driver, sheHerCheckbox);
        await humanDelay();
        
        // Tích Female
        console.log('Chọn Female...');
        const femaleCheckbox = await driver.findElement(By.id('gender-1'));
        await safeClick(driver, femaleCheckbox);
      } else {
        // Tích He/Him
        console.log('Chọn He/Him...');
        const heHimCheckbox = await driver.findElement(By.id('pronoun-1'));
        await safeClick(driver, heHimCheckbox);
        await humanDelay();
        
        // Tích Male
        console.log('Chọn Male...');
        const maleCheckbox = await driver.findElement(By.id('gender-2'));
        await safeClick(driver, maleCheckbox);
      }
      await humanDelay();
      
      // 3. Chọn United States
      console.log('Chọn United States trong Country...');
      const countrySelect = await driver.findElement(By.id('form-app-country'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = 'USA';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, countrySelect);
      await humanDelay();
      
      // 4. Điền địa chỉ
      console.log(`Điền địa chỉ: ${userData.address}`);
      const addressInput = await driver.findElement(By.id('form-app-address-1'));
      await typeHumanLike(addressInput, userData.address);
      await humanDelay();
      
      // 5. Điền thành phố
      console.log(`Điền thành phố: ${userData.city}`);
      const cityInput = await driver.findElement(By.id('form-app-city'));
      await typeHumanLike(cityInput, userData.city);
      await humanDelay();
      
      // 6. Chọn state
      console.log(`Chọn state: ${userData.state}`);
      const stateSelect = await driver.findElement(By.id('form-app-state'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = '${userData.state}';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, stateSelect);
      await humanDelay();
      
      // 7. Điền zip code
      console.log(`Điền zip code: ${userData.zipCode}`);
      const zipInput = await driver.findElement(By.id('form-app-zip'));
      await typeHumanLike(zipInput, userData.zipCode);
      await humanDelay();
      
      // 8. Điền số điện thoại di động
      console.log(`Điền số điện thoại: ${userData.mobileAreaCode}-${userData.mobileNumber}`);
      // Area code
      const mobileAreaInput = await driver.findElement(By.id('form-app-us-mobile-area-code'));
      await typeHumanLike(mobileAreaInput, userData.mobileAreaCode);
      await humanDelay();
      
      // Mobile number
      const mobileNumberInput = await driver.findElement(By.id('form-app-us-mobile-number'));
      await typeHumanLike(mobileNumberInput, userData.mobileNumber);
      await humanDelay();
      
      // 8.1 Điền số điện thoại cố định
      try {
        console.log(`Điền số điện thoại cố định: ${userData.phoneAreaCode}-${userData.phoneNumber}`);
        // Tìm và điền area code
        const phoneAreaCodeInput = await driver.findElement(By.id('app-US-phone-area-code'));
        await typeHumanLike(phoneAreaCodeInput, userData.phoneAreaCode);
        await humanDelay();
        
        // Tìm và điền phone number
        const phoneNumberInput = await driver.findElement(By.id('app-US-phone'));
        await typeHumanLike(phoneNumberInput, userData.phoneNumber);
        await humanDelay();
      } catch (error) {
        console.log('Không tìm thấy trường điện thoại cố định, bỏ qua:', error.message);
      }
      
      // 9. Tích checkbox Would like to receive information 
      console.log('Tích checkbox nhận thông tin qua SMS...');
      const smsCheckbox = await driver.findElement(By.id('form-app-mobile-sms'));
      await scrollToElement(driver, smsCheckbox);
      await safeClick(driver, smsCheckbox);
      await humanDelay();
      
      // 10. Chọn giới tính trong dropdown
      console.log(`Chọn giới tính: ${userData.gender === 'F' ? 'Female' : 'Male'}`);
      const genderSelect = await driver.findElement(By.id('form-app-gender'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = '${userData.gender}';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, genderSelect);
      await humanDelay();
      
      // 11. Chọn "None of these options apply to me" (veteran status)
      console.log('Chọn "None of these options apply to me" cho veteran status...');
      const veteranCheckbox = await driver.findElement(By.id('app-veteran-status-3'));
      await scrollToElement(driver, veteranCheckbox);
      await safeClick(driver, veteranCheckbox);
      await humanDelay();
      
      // 12. Chọn "I am a US Citizen"
      console.log('Chọn "I am a US Citizen"...');
      const citizenshipCheckbox = await driver.findElement(By.id('app-citizenship-1'));
      await scrollToElement(driver, citizenshipCheckbox);
      await safeClick(driver, citizenshipCheckbox);
      await humanDelay();
      
      // 13. Chọn US làm country of birth
      console.log('Chọn United States làm country of birth...');
      const birthCountrySelect = await driver.findElement(By.id('birth-country'));
      await scrollToElement(driver, birthCountrySelect);
      await driver.executeScript(`
        const select = arguments[0];
        select.value = 'USA';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, birthCountrySelect);
      await humanDelay();
      
      // 14. Điền SSN
      console.log(`Điền SSN: ${userData.ssn}`);
      const ssnInput = await driver.findElement(By.id('app-citizen-ssn'));
      await scrollToElement(driver, ssnInput);
      await typeHumanLike(ssnInput, userData.ssn);
      await humanDelay();
      
      // 15. Tích các checkbox liên quan đến ASU
      console.log('Tích checkbox ASU Global Launch...');
      const globalLaunchCheckbox = await driver.findElement(By.id('app-student-at-asu-type-global-launch'));
      await scrollToElement(driver, globalLaunchCheckbox);
      await safeClick(driver, globalLaunchCheckbox);
      await humanDelay();
      
      console.log('Tích checkbox Never affiliated with ASU...');
      const notAffiliatedCheckbox = await driver.findElement(By.id('app-student-at-asu-type-never-affiliated'));
      await scrollToElement(driver, notAffiliatedCheckbox);
      await safeClick(driver, notAffiliatedCheckbox);
      await humanDelay();
      
      // 16. Chọn English làm ngôn ngữ chính
      console.log('Chọn English làm ngôn ngữ chính...');
      const languageSelect = await driver.findElement(By.id('form-app-language'));
      await scrollToElement(driver, languageSelect);
      await driver.executeScript(`
        const select = arguments[0];
        select.value = 'eng';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, languageSelect);
      await humanDelay();
      
      // 17. Điền thông tin Parent 1 (Mother)
      console.log(`Điền thông tin Parent 1: ${userData.parent1.firstName} ${userData.parent1.lastName} (Mother)`);
      
      // First Name
      const parent1FirstNameInput = await driver.findElement(By.id('form-app-parent1-first-name'));
      await scrollToElement(driver, parent1FirstNameInput);
      await typeHumanLike(parent1FirstNameInput, userData.parent1.firstName);
      await humanDelay();
      
      // Last Name
      const parent1LastNameInput = await driver.findElement(By.id('form-app-parent1-last-name'));
      await typeHumanLike(parent1LastNameInput, userData.parent1.lastName);
      await humanDelay();
      
      // Is Living
      const parent1LivingSelect = await driver.findElement(By.id('form-app-parent1-living'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = 'Y';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, parent1LivingSelect);
      await humanDelay();
      
      // Relation (Mother)
      const parent1RelationSelect = await driver.findElement(By.id('app-parent1-relation'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = 'Mother';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, parent1RelationSelect);
      await humanDelay();
      
      // 18. Highest Level of Education
      const parent1EducationSelect = await driver.findElement(By.id('form-app-parent1-schooling-level'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = 'High School';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, parent1EducationSelect);
      await humanDelay();
      
      // 19. Attended ASU
      const parent1AsuSelect = await driver.findElement(By.id('form-app-parent1-attended-asu'));
      await driver.executeScript(`
        const select = arguments[0];
        select.value = '${userData.parent1.attendedAsu}';
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
      `, parent1AsuSelect);
      await humanDelay();

      // 20. Điền thông tin Parent 2 (Father)
    console.log(`Điền thông tin Parent 2: ${userData.parent2.firstName} ${userData.parent2.lastName} (Father)`);
    
    // First Name
    const parent2FirstNameInput = await driver.findElement(By.id('form-app-parent2-first-name'));
    await scrollToElement(driver, parent2FirstNameInput);
    await typeHumanLike(parent2FirstNameInput, userData.parent2.firstName);
    await humanDelay();
    
    // Last Name
    const parent2LastNameInput = await driver.findElement(By.id('form-app-parent2-last-name'));
    await typeHumanLike(parent2LastNameInput, userData.parent2.lastName);
    await humanDelay();
    
    // Is Living
    const parent2LivingSelect = await driver.findElement(By.id('form-app-parent2-living'));
    await driver.executeScript(`
      const select = arguments[0];
      select.value = 'Y';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, parent2LivingSelect);
    await humanDelay();
    
    // Relation (Father)
    const parent2RelationSelect = await driver.findElement(By.id('app-parent2-relation'));
    await driver.executeScript(`
      const select = arguments[0];
      select.value = 'Father';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, parent2RelationSelect);
    await humanDelay();
    
    // Highest Level of Education
    const parent2EducationSelect = await driver.findElement(By.id('form-app-parent2-schooling-level'));
    await driver.executeScript(`
      const select = arguments[0];
      select.value = 'Other/Unknown';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, parent2EducationSelect);
    await humanDelay();
    
    // Attended ASU
    const parent2AsuSelect = await driver.findElement(By.id('form-app-parent2-attended-asu'));
    await driver.executeScript(`
      const select = arguments[0];
      select.value = '${userData.parent2.attendedAsu}';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    `, parent2AsuSelect);
    await humanDelay();
    
    // 21. Tích vào radio button Partner/Dependent trước khi điền thông tin
console.log('Tích chọn Partner/Dependent...');
const partnerDependentRadio = await driver.findElement(By.id('form-app-partner-type-dependent'));
await scrollToElement(driver, partnerDependentRadio);
await safeClick(driver, partnerDependentRadio);
await humanDelay();

// Đợi một chút để form partner/dependent hiển thị
await driver.sleep(1000);

// Sau đó tiếp tục điền thông tin partner
console.log(`Điền thông tin Partner: ${userData.partner.firstName} ${userData.partner.lastName}`);

// First Name
const partnerFirstNameInput = await driver.findElement(By.id('form-app-partner-dependent-first-name'));
await scrollToElement(driver, partnerFirstNameInput);
await typeHumanLike(partnerFirstNameInput, userData.partner.firstName);
await humanDelay();

// Last Name
const partnerLastNameInput = await driver.findElement(By.id('form-app-partner-dependent-last-name'));
await typeHumanLike(partnerLastNameInput, userData.partner.lastName);
await humanDelay();

// Email Address (same as user's email)
const partnerEmailInput = await driver.findElement(By.id('form-app-partner-dependent-email-addr'));
await typeHumanLike(partnerEmailInput, email);
await humanDelay();

// Relationship (Spouse)
const partnerRelationSelect = await driver.findElement(By.id('form-app-partner-dependent-relationship'));
await driver.executeScript(`
  const select = arguments[0];
  select.value = 'Spouse';
  const event = new Event('change', { bubbles: true });
  select.dispatchEvent(event);
`, partnerRelationSelect);
await humanDelay();
    
    // 22. Tích checkbox Terms and Conditions
    console.log('Tích checkbox Terms and Conditions...');
    const termsCheckbox = await driver.findElement(By.id('form-app-partner-dependent-terms-and-conditions'));
    await scrollToElement(driver, termsCheckbox);
    await safeClick(driver, termsCheckbox);
    await humanDelay();
    
    // Đợi modal xuất hiện và xử lý các checkbox trong modal
    await driver.wait(until.elementLocated(By.id('scap-documents-dependent')), 10000);
    console.log('Modal đã xuất hiện, tích các checkbox trong modal...');
    
    // Tích 5 checkbox trong modal
    const modalCheckboxes = [
      'scap-documents-dependent',
      'scap-satisfaction-dependent',
      'scap-reimbursement-dependent',
      'scap-fees-dependent',
      'scap-share-dependent'
    ];
    
    for (const checkboxId of modalCheckboxes) {
      console.log(`Tích checkbox: ${checkboxId}`);
      const checkbox = await driver.findElement(By.id(checkboxId));
      await scrollToElement(driver, checkbox);
      await safeClick(driver, checkbox);
      await humanDelay('typing'); // Độ trễ nhỏ giữa các lần tích
    }
    
    // Nhấn nút Accept
    console.log('Nhấn nút Accept trên modal...');
    const acceptButton = await driver.findElement(By.id('button-accept-dependent'));
    await scrollToElement(driver, acceptButton);
    await safeClick(driver, acceptButton);
    await humanDelay();
    
    // Modal đã đóng, nhấn nút Save & Continue
    console.log('Nhấn nút Save & Continue...');
    const saveButton = await driver.findElement(By.id('btn-accept-start-app-button'));
    await scrollToElement(driver, saveButton);
    await safeClick(driver, saveButton);

        // Kiểm tra và nhấn nút Submit (nếu xuất hiện)
        try {
          console.log('Kiểm tra và nhấn nút Submit...');
          await driver.sleep(2000); // Đợi popup hiển thị
          
          // Dùng JavaScript trực tiếp để tìm và nhấn nút Submit có text là "Submit"
          const submitClicked = await driver.executeScript(`
            const buttons = document.querySelectorAll('button.ui-button');
            for (let i = 0; i < buttons.length; i++) {
              if (buttons[i].textContent.trim() === 'Submit') {
                buttons[i].click();
                return true;
              }
            }
            return false;
          `);
          
          if (submitClicked) {
            console.log('Đã nhấn nút Submit thành công bằng JavaScript!');
            await humanDelay();
          } else {
            console.log('Không tìm thấy nút Submit chính xác, thử cách khác...');
            
            // Thử cách 2: Nhấn tất cả các nút có class ui-button
            const allButtonsClicked = await driver.executeScript(`
              const buttons = document.querySelectorAll('button.ui-button');
              let clicked = false;
              for (let i = 0; i < buttons.length; i++) {
                buttons[i].click();
                clicked = true;
              }
              return clicked;
            `);
            
            if (allButtonsClicked) {
              console.log('Đã nhấn các nút ui-button!');
              await humanDelay();
            } else {
              console.log('Không tìm thấy nút nào có class ui-button');
            }
          }
        } catch (error) {
          console.log('Lỗi khi xử lý nút Submit:', error.message);
          // Bỏ qua lỗi này vì không ảnh hưởng đến quy trình
        }
    
    // Kiểm tra có lỗi không sau khi nhấn Save & Continue
    try {
      // Đợi một lúc để xem có thông báo lỗi hiện lên không
      await driver.sleep(2000);
      
      // Tìm thông báo lỗi trên trang
      const errorElements = await driver.findElements(By.css('.error-msg, .invalid-feedback, .alert-danger, .form-error'));
      
      if (errorElements.length > 0) {
        // Có lỗi xảy ra, ghi lại thông báo lỗi
        console.log('Phát hiện lỗi khi submit form trang 2:');
        for (const errorElement of errorElements) {
          const errorText = await errorElement.getText();
          console.log(`- ${errorText}`);
        }
        
        // Thử lại nếu chưa vượt quá số lần thử
        if (retryCount < MAX_RETRIES) {
          console.log(`Thử lại form trang 2 lần ${retryCount + 2}...`);
          return await fillPersonalInfoForm(driver, userData, email, retryCount + 1);
        } else {
          throw new Error(`Đã thử lại form trang 2 ${MAX_RETRIES} lần nhưng vẫn không thành công.`);
        }
      }
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông báo lỗi trang 2:', error.message);
    }
    
    // Cập nhật thông tin tài khoản với thông tin trang 2
    const updatedAccountInfo = {
      ...userData,
      email,
      timestamp: new Date().toISOString()
    };
    
    // Lưu lại thông tin tài khoản đã cập nhật
    saveAccountInfo(updatedAccountInfo);
    
    console.log('Đã hoàn thành điền form trang 2!');
    return updatedAccountInfo;
  } catch (error) {
    console.error('LỖI khi điền form trang 2:', error);
    
    // Thử lại nếu chưa vượt quá số lần thử
    if (retryCount < MAX_RETRIES) {
      console.log(`Gặp lỗi trong trang 2. Thử lại lần ${retryCount + 2}...`);
      await driver.sleep(2000); // Đợi một chút trước khi thử lại
      return await fillPersonalInfoForm(driver, userData, email, retryCount + 1);
    } else {
      throw error;
    }
  }
}

// Hàm kiểm tra và xử lý lỗi
async function takeErrorScreenshot(driver, error) {
    try {
      console.error('Đã xảy ra lỗi:', error.message);
      
      // Chụp ảnh màn hình lỗi
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotPath = path.join(CONFIG.LOG_DIR, `error_${timestamp}.png`);
      
      const screenshot = await driver.takeScreenshot();
      fs.writeFileSync(screenshotPath, screenshot, 'base64');
      
      console.log(`Đã lưu ảnh lỗi tại: ${screenshotPath}`);
      
      // Lưu HTML trang lỗi
      const htmlPath = path.join(CONFIG.LOG_DIR, `error_page_${timestamp}.html`);
      const pageSource = await driver.getPageSource();
      fs.writeFileSync(htmlPath, pageSource);
      
      console.log(`Đã lưu HTML trang lỗi tại: ${htmlPath}`);
    } catch (e) {
      console.error('Lỗi khi lưu thông tin debug:', e.message);
    }
  }
  
  // Hàm chính
// Cập nhật hàm chính để xử lý tất cả các trang
async function runAutomation() {
  console.log('====== TỰ ĐỘNG TẠO TÀI KHOẢN ASU ======');
  console.log('Chế độ: Tự động 100% (Tất cả các trang)');
  
  let driver = null;
  let accountData = null;
  let realAddress = null;
  
  try {
    // Tạo địa chỉ US thực tế
    realAddress = generateRealUSAddress();
    console.log(`Sử dụng địa chỉ thực tại US: ${realAddress.address}, ${realAddress.city}, ${realAddress.state} ${realAddress.zipCode}`);
    
    // Đọc email từ file Excel
    const email = await readEmailFromExcel();
    console.log(`Sử dụng email: ${email}`);
    
    // Khởi chạy Chrome với debugging enabled
    await launchChromeWithDebugging();
    
    // Đợi Chrome mở hoàn toàn
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Kết nối với Chrome đang chạy
    driver = await connectToRunningChrome();
    
    // Mở trang ASU
    console.log(`Mở trang tạo tài khoản ASU: ${CONFIG.ASU_URL}`);
    await driver.get(CONFIG.ASU_URL);
    
    // Đợi CloudFlare và trang form
    await waitForPageLoad(driver, 'start-my-application');
    
    // TRANG 1: Điền form tạo tài khoản và chuyển đến trang 2
    console.log('\n===== TRANG 1: TẠO TÀI KHOẢN =====');
    accountData = await fillCreateAccountForm(driver, email);
    
    // Đợi để page 2 load
    await driver.sleep(3000);
    
    // TRANG 2: Điền form thông tin cá nhân
    console.log('\n===== TRANG 2: THÔNG TIN CÁ NHÂN =====');
    // Thêm thông tin địa chỉ thực
    accountData = {
      ...accountData,
      address: realAddress.address,
      city: realAddress.city,
      state: realAddress.state,
      zipCode: realAddress.zipCode
    };
    
    accountData = await fillPersonalInfoForm(driver, accountData, email);
    
    // TRANG 3: Điền thông tin trường học
    await handleEducationPage(driver, accountData);
    
    // TRANG 4: Xử lý trang Self-reported
    await handleSelfReportedPage(driver);
    
    // TRANG 5: Xử lý trang Residency
    await handleResidencyPage(driver, accountData);
    
    // TRANG 6: Xử lý trang chọn ngành học
    await handleMajorSelectionPage(driver);
    
    // TRANG 7: Xử lý trang cuối cùng và submit application
    const isSuccess = await handleFinalSubmitPage(driver);
    
    if (isSuccess) {
      // Cập nhật thông tin tài khoản với trạng thái thành công
      const finalAccountInfo = {
        ...accountData,
        applicationStatus: "SUCCESS",
        completionDate: new Date().toISOString()
      };
      
      // Lưu thông tin tài khoản cuối cùng với trạng thái thành công
      const logFile = saveAccountInfo(finalAccountInfo);
      
      console.log('\n===== HOÀN THÀNH =====');
      console.log(`Đã tạo tài khoản và nộp đơn thành công với email: ${email}`);
      console.log(`Thông tin tài khoản đã được lưu tại: ${logFile}`);
    }
    
    return true;
  } catch (error) {
    await takeErrorScreenshot(driver, error);
    console.error('LỖI CHẠY SCRIPT:', error.message);
    
    // Cập nhật thông tin tài khoản với trạng thái thất bại nếu có accountData
    if (accountData) {
      const failedAccountInfo = {
        ...accountData,
        applicationStatus: "FAILED",
        failureReason: error.message,
        failureDate: new Date().toISOString()
      };
      
      // Lưu thông tin tài khoản với trạng thái thất bại
      saveAccountInfo(failedAccountInfo);
    }
    
    return false;
  } finally {
    // Đợi một chút trước khi đóng trình duyệt
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (driver) {
      try {
        console.log('Đóng trình duyệt Chrome...');
        await driver.quit();
        console.log('Đã đóng Chrome thành công.');
      } catch (e) {
        console.error('Lỗi khi đóng Chrome:', e.message);
      }
    }
  }
}
  
  // Chạy chương trình
  runAutomation()
    .then(success => {
      if (success) {
        console.log('\nSCRIPT HOÀN THÀNH THÀNH CÔNG');
      } else {
        console.log('\nSCRIPT HOÀN THÀNH VỚI LỖI');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\nSCRIPT THẤT BẠI:', error);
      process.exit(1);
    });