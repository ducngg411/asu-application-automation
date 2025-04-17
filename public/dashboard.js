// public/dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    // Variables
    let accounts = [];
    let screenshots = [];
    let selectedAccount = null;
    let socket = io();
    
    // DOM elements
    const accountsList = document.getElementById('accountsList');
    const accountDetails = document.getElementById('accountDetails');
    const screenshotsList = document.getElementById('screenshotsList');
    const refreshBtn = document.getElementById('refreshBtn');
    const totalAccountsEl = document.getElementById('totalAccounts');
    const successAccountsEl = document.getElementById('successAccounts');
    const failedAccountsEl = document.getElementById('failedAccounts');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const statusMessage = document.getElementById('statusMessage');
    const lastUpdate = document.getElementById('lastUpdate');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const copyDetailsBtn = document.getElementById('copyDetailsBtn');
    const statusBar = document.getElementById('statusBar');
    
    // Bootstrap modal
    const screenModal = new bootstrap.Modal(document.getElementById('screenModal'));
    const modalImage = document.getElementById('modalImage');
    
    // Initialize moment.js locale
    moment.locale('vi');
    
    // Initialize data
    fetchData();
    
    // Event listeners
    refreshBtn.addEventListener('click', fetchData);
    
    searchButton.addEventListener('click', filterAccounts);
    searchInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        filterAccounts();
      }
    });
    
    copyDetailsBtn.addEventListener('click', copyAccountDetails);
    
    // Socket.io event handling
    socket.on('connect', () => {
      updateStatus('Kết nối thành công đến máy chủ', 'success');
    });
    
    socket.on('disconnect', () => {
      updateStatus('Mất kết nối với máy chủ', 'danger');
    });
    
    socket.on('update', (data) => {
      console.log('Received update:', data);
      fetchData();
      updateStatus('Nhận được cập nhật mới', 'info');
    });
    
    // Functions
    function fetchData() {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang tải...';
      
      Promise.all([
        fetch('/api/results').then(res => res.json()),
        fetch('/api/screenshots').then(res => res.json())
      ])
      .then(([accountsData, screenshotsData]) => {
        accounts = accountsData;
        screenshots = screenshotsData;
        
        updateDashboard();
        renderAccounts();
        renderScreenshots();
        
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
        
        updateLastUpdate();
        updateStatus('Dữ liệu đã được cập nhật', 'success');
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
        updateStatus('Lỗi khi tải dữ liệu', 'danger');
      });
    }
    
    function updateDashboard() {
      const total = accounts.length;
      const success = accounts.filter(account => account.status === 'SUCCESS').length;
      const failed = accounts.filter(account => account.status === 'FAILED').length;
      
      totalAccountsEl.textContent = total;
      successAccountsEl.textContent = success;
      failedAccountsEl.textContent = failed;
      
      // Calculate progress percentage
      const totalExpected = Math.max(total, 1); // Avoid division by zero
      const progressPercent = (success + failed) / totalExpected * 100;
      progressBar.style.width = `${progressPercent}%`;
      progressText.textContent = `${success + failed} / ${totalExpected} emails`;
    }
    
    function renderAccounts(filteredAccounts = null) {
      const data = filteredAccounts || accounts;
      
      if (data.length === 0) {
        accountsList.innerHTML = '<tr><td colspan="7" class="text-center">Không có dữ liệu nào</td></tr>';
        return;
      }
      
      // Sort accounts by status (SUCCESS first) and then by completion date (newest first)
      const sortedAccounts = [...data].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'SUCCESS' ? -1 : 1;
        }
        
        const dateA = a.completionDate || a.failureDate || '';
        const dateB = b.completionDate || b.failureDate || '';
        return dateB.localeCompare(dateA);
      });
      
      accountsList.innerHTML = sortedAccounts.map((account, index) => {
        const name = account.firstName && account.lastName 
          ? `${account.firstName} ${account.lastName}` 
          : 'N/A';
        
        const completionTime = account.completionDate || account.failureDate;
        const formattedTime = completionTime 
          ? moment(completionTime).format('DD/MM/YYYY HH:mm:ss') 
          : 'N/A';
        
        const processingTime = account.processingTime 
          ? `${account.processingTime.toFixed(2)}s` 
          : 'N/A';
        
        const statusClass = account.status === 'SUCCESS' ? 'success' : 'failed';
        const statusText = account.status === 'SUCCESS' ? 'Thành công' : 'Thất bại';
        
        return `
          <tr class="account-row" data-index="${index}">
            <td>${account.email}</td>
            <td>${name}</td>
            <td>
              <div class="d-flex align-items-center">
                <span class="password-text">${account.password || 'N/A'}</span>
                ${account.password ? `
                  <i class="bi bi-clipboard ms-2 copy-btn" title="Copy password" 
                     onclick="event.stopPropagation(); navigator.clipboard.writeText('${account.password}')"></i>
                ` : ''}
              </div>
            </td>
            <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
            <td>${formattedTime}</td>
            <td>${processingTime}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary view-details-btn" data-index="${index}">
                <i class="bi bi-info-circle"></i> Chi tiết
              </button>
            </td>
          </tr>
        `;
      }).join('');
      
      // Add event listeners to rows
      document.querySelectorAll('.account-row').forEach(row => {
        row.addEventListener('click', function() {
          const index = this.getAttribute('data-index');
          selectAccount(sortedAccounts[index]);
          highlightRow(this);
        });
      });
      
      document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', function(event) {
          event.stopPropagation();
          const index = this.getAttribute('data-index');
          selectAccount(sortedAccounts[index]);
          highlightRow(this.closest('tr'));
        });
      });
    }
    
    function renderScreenshots() {
      if (screenshots.length === 0) {
        screenshotsList.innerHTML = '<p class="text-center text-muted">Chưa có ảnh chụp màn hình</p>';
        return;
      }
      
      // Sort screenshots by date (newest first)
      const sortedScreenshots = [...screenshots].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      screenshotsList.innerHTML = sortedScreenshots.map(screenshot => `
        <div class="col">
          <div class="card h-100">
            <div class="card-img-top img-thumbnail screenshot-thumbnail" 
                 style="height: 150px; background-image: url('${screenshot.path}'); background-size: cover; background-position: center; cursor: pointer;"
                 data-path="${screenshot.path}">
            </div>
            <div class="card-body p-2">
              <p class="card-text small text-truncate" title="${screenshot.name}">${screenshot.name}</p>
              <p class="card-text small text-muted">${moment(screenshot.date).fromNow()}</p>
            </div>
          </div>
        </div>
      `).join('');
      
      // Add event listeners to thumbnails
      document.querySelectorAll('.screenshot-thumbnail').forEach(thumbnail => {
        thumbnail.addEventListener('click', function() {
          const path = this.getAttribute('data-path');
          modalImage.src = path;
          screenModal.show();
        });
      });
    }
    
    function selectAccount(account) {
      selectedAccount = account;
      copyDetailsBtn.disabled = false;
      
      if (!account) {
        accountDetails.innerHTML = '<p class="text-center text-muted">Không có thông tin chi tiết</p>';
        return;
      }
      
      // Show loading state
      accountDetails.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>Đang tải thông tin chi tiết...</p></div>';
      
      // Debug: Log which file we're trying to fetch
      console.log("Đang tải thông tin chi tiết từ: ", account.logFile);
      
      // Fetch account details
      fetch(`/api/account/${account.logFile}`)
        .then(response => {
          if (!response.ok) {
            // Try to get error details if the response is not OK
            return response.json().then(errData => {
              throw new Error(`${response.status} ${response.statusText}: ${errData.error || 'Unknown error'}`);
            });
          }
          return response.json();
        })
        .then(data => {
          renderAccountDetails(data);
        })
        .catch(error => {
          console.error('Error fetching account details:', error);
          accountDetails.innerHTML = `
            <div class="alert alert-danger">
              <h5>Lỗi khi tải thông tin chi tiết</h5>
              <p>${error.message}</p>
              <small>Hãy kiểm tra file log: ${account.logFile}</small>
            </div>
          `;
        });
    }
    
    function renderAccountDetails(details) {
      if (!details) {
        accountDetails.innerHTML = '<p class="text-center text-muted">Không có thông tin chi tiết</p>';
        return;
      }
      
      const accountInfo = `
        <div class="account-detail-container">
          <h5>Thông tin cơ bản</h5>
          <div class="account-detail">
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Email:</div>
              <div class="col-md-8">${details.email || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Họ tên:</div>
              <div class="col-md-8">${details.firstName || 'N/A'} ${details.lastName || ''} ${details.suffix || ''}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Mật khẩu:</div>
              <div class="col-md-8">${details.password || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Ngày sinh:</div>
              <div class="col-md-8">${details.birthMonth || 'N/A'}/${details.birthDay || 'N/A'}/${details.birthYear || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Trạng thái:</div>
              <div class="col-md-8">
                <span class="status-badge status-${details.applicationStatus === 'SUCCESS' ? 'success' : 'failed'}">
                  ${details.applicationStatus === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
                </span>
              </div>
            </div>
            ${details.processingTime ? `
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Thời gian xử lý:</div>
              <div class="col-md-8">${details.processingTime.toFixed(2)} giây</div>
            </div>
            ` : ''}
          </div>
          
          ${details.address ? `
          <h5 class="mt-3">Thông tin địa chỉ</h5>
          <div class="account-detail">
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Địa chỉ:</div>
              <div class="col-md-8">${details.address || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Thành phố:</div>
              <div class="col-md-8">${details.city || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Tiểu bang:</div>
              <div class="col-md-8">${details.state || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">ZIP Code:</div>
              <div class="col-md-8">${details.zipCode || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Điện thoại:</div>
              <div class="col-md-8">${details.mobileAreaCode || 'N/A'}-${details.mobileNumber || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Giới tính:</div>
              <div class="col-md-8">${details.isFemale ? 'Nữ' : 'Nam'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">SSN:</div>
              <div class="col-md-8">${details.ssn || 'N/A'}</div>
            </div>
          </div>
          ` : ''}
          
          ${details.parent1 ? `
          <h5 class="mt-3">Thông tin phụ huynh</h5>
          <div class="account-detail">
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Mẹ:</div>
              <div class="col-md-8">${details.parent1.firstName || 'N/A'} ${details.parent1.lastName || 'N/A'}</div>
            </div>
            <div class="row mb-2">
              <div class="col-md-4 fw-bold">Bố:</div>
              <div class="col-md-8">${details.parent2.firstName || 'N/A'} ${details.parent2.lastName || 'N/A'}</div>
            </div>
          </div>
          ` : ''}
        </div>
      `;
      
      accountDetails.innerHTML = accountInfo;
    }
    
    function filterAccounts() {
      const searchTerm = searchInput.value.trim().toLowerCase();
      
      if (!searchTerm) {
        renderAccounts();
        return;
      }
      
      const filtered = accounts.filter(account => {
        return (
          (account.email && account.email.toLowerCase().includes(searchTerm)) ||
          (account.firstName && account.firstName.toLowerCase().includes(searchTerm)) ||
          (account.lastName && account.lastName.toLowerCase().includes(searchTerm))
        );
      });
      
      renderAccounts(filtered);
      updateStatus(`Tìm thấy ${filtered.length} kết quả cho "${searchTerm}"`, 'info');
    }
    
    function copyAccountDetails() {
      if (!selectedAccount || !selectedAccount.logFile) {
        return;
      }
      
      fetch(`/api/account/${selectedAccount.logFile}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          let text = `Email: ${data.email || 'N/A'}\n`;
          text += `Họ tên: ${data.firstName || 'N/A'} ${data.lastName || ''} ${data.suffix || ''}\n`;
          text += `Mật khẩu: ${data.password || 'N/A'}\n`;
          text += `Ngày sinh: ${data.birthMonth || 'N/A'}/${data.birthDay || 'N/A'}/${data.birthYear || 'N/A'}\n`;
          text += `Trạng thái: ${data.applicationStatus === 'SUCCESS' ? 'Thành công' : 'Thất bại'}\n`;
          
          if (data.address) {
            text += `\nĐịa chỉ: ${data.address || 'N/A'}\n`;
            text += `Thành phố: ${data.city || 'N/A'}\n`;
            text += `Tiểu bang: ${data.state || 'N/A'}\n`;
            text += `ZIP Code: ${data.zipCode || 'N/A'}\n`;
            text += `Điện thoại: ${data.mobileAreaCode || 'N/A'}-${data.mobileNumber || 'N/A'}\n`;
            text += `Giới tính: ${data.isFemale ? 'Nữ' : 'Nam'}\n`;
            text += `SSN: ${data.ssn || 'N/A'}\n`;
          }
          
          if (data.parent1) {
            text += `\nMẹ: ${data.parent1.firstName || 'N/A'} ${data.parent1.lastName || 'N/A'}\n`;
            text += `Bố: ${data.parent2.firstName || 'N/A'} ${data.parent2.lastName || 'N/A'}\n`;
          }
          
          navigator.clipboard.writeText(text);
          updateStatus('Đã sao chép thông tin chi tiết tài khoản', 'success');
        })
        .catch(error => {
          console.error('Error copying account details:', error);
          updateStatus('Lỗi khi sao chép thông tin chi tiết: ' + error.message, 'danger');
        });
    }
    
    function updateStatus(message, type = 'info') {
      statusMessage.textContent = message;
      statusBar.className = 'd-flex justify-content-between align-items-center';
      
      // Add background color based on type
      switch (type) {
        case 'success':
          statusBar.classList.add('bg-success');
          break;
        case 'danger':
          statusBar.classList.add('bg-danger');
          break;
        case 'warning':
          statusBar.classList.add('bg-warning');
          statusMessage.classList.add('text-dark');
          break;
        case 'info':
        default:
          statusBar.classList.add('bg-info');
          statusMessage.classList.add('text-dark');
          break;
      }
      
      // Auto-reset after 5 seconds
      setTimeout(() => {
        statusBar.className = 'd-flex justify-content-between align-items-center bg-dark';
        statusMessage.className = '';
        statusMessage.textContent = 'Sẵn sàng';
      }, 5000);
    }
    
    function updateLastUpdate() {
      lastUpdate.textContent = `Cập nhật lần cuối: ${moment().format('HH:mm:ss DD/MM/YYYY')}`;
    }
    
    function highlightRow(row) {
      // Remove highlight from all rows
      document.querySelectorAll('.account-row').forEach(r => {
        r.classList.remove('highlight');
      });
      
      // Add highlight to selected row
      row.classList.add('highlight');
    }
  });