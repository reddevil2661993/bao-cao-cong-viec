/**
 * HỆ THỐNG BÁO CÁO CÔNG VIỆC HÀNG NGÀY & TỔNG HỢP TIẾN ĐỘ
 * Core Application Logic (Phiên bản 3.0: Đăng Nhập, Phân Quyền & Thống Kê Điểm Danh Ngày)
 */

// Key lưu trữ localStorage
const STORAGE_KEY = 'DAILY_WORK_REPORTS_V2';
const USERS_STORAGE_KEY = 'DAILY_WORK_USERS_V1';
const AUTH_USER_KEY = 'DAILY_WORK_AUTH_CURRENT_USER';

// Danh sách loại công việc chuẩn
const JOB_TYPES = [
  "Tiến độ DP LCD",
  "Tiến độ GP",
  "Tiến độ tháo GP",
  "Lắp đặt",
  "Bảo trì",
  "Khảo sát",
  "Hỗ trợ",
  "Hỗ trợ/ Khác",
  "Làm file",
  "Kiểm kê / Kiểm kho",
  "Thu hồi",
  "Chụp hình đẹp",
  "Hoạt động công ty",
  "Quản lý",
  "Nghỉ quy định",
  "Nghỉ phép",
  "Nghỉ lễ"
];

// Biến trạng thái ứng dụng
let appState = {
  reports: [],
  users: [],
  currentUser: null, // User đang đăng nhập {id, username, fullName, position, role}
  currentAdminTab: 'reports', // 'reports' | 'daily_tracker' | 'user_manager'
  empFilterWeek: 'all',
  selectedTrackerDate: '', // Ngày đang chọn để thống kê xem ai chưa báo cáo
  accessedViaDirectLink: false, // Cờ nhận biết đang truy cập bằng đường link báo cáo riêng
  pendingAction: null, // Hành động tự động kèm link ('plan' | 'report' | 'today')
  filters: {
    week: 'all',
    employee: 'all',
    jobType: 'all',
    rateStatus: 'all',
    search: ''
  },
  editingReportId: null,
  updatingReportId: null,
  charts: {
    empChart: null,
    jobChart: null
  }
};

/**
 * ========================================================
 * 1. QUẢN LÝ TÀI KHOẢN & ĐĂNG NHẬP (AUTHENTICATION)
 * ========================================================
 */

/**
 * Chuyển đổi tên tiếng Việt có dấu thành username không dấu viết liền
 */
function toUsername(str) {
  if (!str) return '';
  return str.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Khởi tạo danh sách tài khoản mặc định nếu chưa có
 */
function initUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      appState.users = JSON.parse(raw);
    } else {
      // Tạo danh sách tài khoản ban đầu từ dữ liệu nhân viên
      const defaultUsers = [
        {
          id: 'usr-admin',
          username: 'admin',
          password: 'admin123',
          fullName: 'Quản Trị Viên (Admin)',
          position: 'Quản lý / Trưởng bộ phận',
          role: 'admin',
          status: 'active',
          createdAt: '2026-11-06'
        }
      ];

      // Thêm các nhân viên thực tế có sẵn trong hệ thống
      const defaultEmps = [
        { name: "Nguyễn Ngọc Tuân", pos: "Trưởng nhóm" },
        { name: "Dương Hồng Hải", pos: "Phó nhóm" },
        { name: "Nguyễn Trần Anh Vũ", pos: "Chuyên viên" },
        { name: "Đoàn Văn Lương", pos: "Chuyên viên" },
        { name: "Nguyễn Trung Thành", pos: "Chuyên viên" },
        { name: "Triệu Đình Việt", pos: "Chuyên viên" },
        { name: "Trần Gia Hào", pos: "Nhân viên" },
        { name: "Trần Hoài Nam", pos: "Nhân viên" },
        { name: "Nguyễn Viết Hoàng", pos: "Nhân viên" },
        { name: "Phạm Minh Phúc", pos: "Nhân viên" },
        { name: "Ngô Châu Quang Cương", pos: "Nhân viên" },
        { name: "Hoàng Tiến Đạt", pos: "Nhân viên" },
        { name: "Nguyễn Trường Vũ", pos: "Nhân viên" },
        { name: "Nguyễn Hữu Nghĩa", pos: "Nhân viên" },
        { name: "Lê Trọng", pos: "Nhân viên" },
        { name: "Phan Tấn Quang", pos: "Nhân viên" },
        { name: "Nguyễn Ngọc Hậu", pos: "Nhân viên" },
        { name: "Lê Nguyễn Trọng Khang", pos: "Nhân viên" },
        { name: "Nguyễn Duy Khang", pos: "Thử Việc" },
        { name: "Trần Xuân Trường", pos: "Nhân viên" }
      ];

      defaultEmps.forEach((emp, idx) => {
        defaultUsers.push({
          id: 'usr-emp-' + (idx + 1),
          username: toUsername(emp.name),
          password: '123456',
          fullName: emp.name,
          position: emp.pos,
          role: 'employee',
          status: 'active',
          createdAt: '2026-11-06'
        });
      });

      appState.users = defaultUsers;
      saveUsers();
    }
  } catch (e) {
    console.error("Lỗi khởi tạo tài khoản:", e);
    appState.users = [];
  }
}

function saveUsers() {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(appState.users));
  } catch (e) {
    console.error("Lỗi lưu tài khoản:", e);
  }
}

/**
 * Kiểm tra phiên đăng nhập hiện tại
 * Hỗ trợ tự động nhận diện và đăng nhập trực tiếp qua URL: ?user=... hoặc ?nv=...
 */
function checkAuthSession() {
  try {
    // 1. Kiểm tra tham số trên URL (?user=... hoặc ?nv=... hoặc ?nhanvien=... hoặc ?u=...)
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user') || urlParams.get('nv') || urlParams.get('nhanvien') || urlParams.get('u');

    if (userParam) {
      const cleanParam = decodeURIComponent(userParam).trim();
      const targetUser = appState.users.find(u => 
        u.username.toLowerCase() === cleanParam.toLowerCase() || 
        toUsername(u.fullName) === toUsername(cleanParam) ||
        u.id.toLowerCase() === cleanParam.toLowerCase() ||
        u.fullName.toLowerCase() === cleanParam.toLowerCase()
      );

      if (targetUser) {
        if (targetUser.status === 'blocked') {
          alert(`⚠️ Tài khoản "${targetUser.fullName}" (@${targetUser.username}) đã bị khóa bởi Quản trị viên!\nVui lòng liên hệ Quản lý để được hỗ trợ.`);
          appState.currentUser = null;
          localStorage.removeItem(AUTH_USER_KEY);
          return;
        }

        // Tự động gán người dùng hiện tại và lưu phiên
        appState.currentUser = targetUser;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(targetUser));
        appState.accessedViaDirectLink = true;

        const actionParam = urlParams.get('action');
        if (actionParam) {
          appState.pendingAction = actionParam;
        }
        return;
      } else {
        console.warn("Không tìm thấy tài khoản nhân viên theo link:", userParam);
      }
    }

    // 2. Nếu không có URL param, kiểm tra session lưu trong localStorage
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      appState.currentUser = JSON.parse(raw);
    } else {
      appState.currentUser = null;
    }
  } catch (e) {
    console.error("Lỗi kiểm tra phiên đăng nhập:", e);
    appState.currentUser = null;
  }
}

/**
 * Xử lý đăng nhập
 */
function handleLogin(e) {
  if (e) e.preventDefault();

  const userField = document.getElementById('login-username').value.trim();
  const passField = document.getElementById('login-password').value.trim();
  const errorMsg = document.getElementById('login-error');

  if (!userField || !passField) {
    errorMsg.textContent = "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!";
    errorMsg.classList.remove('hidden');
    return;
  }

  // Tìm kiếm tài khoản
  const user = appState.users.find(u => 
    u.username.toLowerCase() === userField.toLowerCase() && u.password === passField
  );

  if (!user) {
    errorMsg.textContent = "Tên đăng nhập hoặc mật khẩu không chính xác!";
    errorMsg.classList.remove('hidden');
    return;
  }

  if (user.status === 'blocked') {
    errorMsg.textContent = "Tài khoản của bạn đã bị khóa bởi Quản trị viên!";
    errorMsg.classList.remove('hidden');
    return;
  }

  // Đăng nhập thành công
  errorMsg.classList.add('hidden');
  appState.currentUser = user;
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

  // Reset form
  document.getElementById('login-form').reset();

  renderApp();
}

/**
 * Đăng nhập nhanh 1-click (tiện cho test và demo)
 */
function quickLogin(username, password) {
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
  handleLogin();
}

/**
 * Đăng xuất
 */
function handleLogout() {
  if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?")) {
    appState.currentUser = null;
    appState.accessedViaDirectLink = false;
    localStorage.removeItem(AUTH_USER_KEY);
    renderApp();
  }
}

/**
 * ========================================================
 * 1.1. ĐƯỜNG LINK BÁO CÁO RIÊNG CHO NHÂN VIÊN & CLIPBOARD
 * ========================================================
 */

// Key lưu trữ Base URL tùy chỉnh (nếu chạy qua LAN / Web Domain)
const CUSTOM_BASE_URL_KEY = 'DAILY_WORK_CUSTOM_BASE_URL';
const DEFAULT_LAN_BASE_URL = 'http://192.168.0.173:8888/index.html';

/**
 * Hiển thị Toast thông báo nhanh (không làm gián đoạn thao tác)
 */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none max-w-md';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-800 text-white border-emerald-600' :
             type === 'info' ? 'bg-blue-800 text-white border-blue-600' :
             type === 'warning' ? 'bg-amber-800 text-white border-amber-600' :
             'bg-rose-800 text-white border-rose-600';
  const icon = type === 'success' ? 'fa-circle-check text-emerald-300' :
               type === 'info' ? 'fa-circle-info text-blue-300' :
               type === 'warning' ? 'fa-triangle-exclamation text-amber-300' :
               'fa-circle-xmark text-rose-300';

  toast.className = `toast-item ${bg} pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-xs flex items-start gap-3 transition-all duration-300`;
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base mt-0.5 shrink-0"></i>
    <div class="flex-1 font-medium leading-relaxed">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
    <button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white shrink-0 ml-1">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

/**
 * Hàm sao chép văn bản vào bộ nhớ tạm (hỗ trợ cả Clipboard API & fallback)
 */
function copyTextToClipboard(text, successMessage) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage, 'success');
    }).catch(err => {
      fallbackCopyText(text, successMessage);
    });
  } else {
    fallbackCopyText(text, successMessage);
  }
}

function fallbackCopyText(text, successMessage) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast(successMessage, 'success');
    } else {
      prompt("Sao chép nội dung bằng phím Ctrl + C:", text);
    }
  } catch (err) {
    prompt("Sao chép nội dung bằng phím Ctrl + C:", text);
  }
  document.body.removeChild(textArea);
}

/**
 * Lấy URL gốc hiện tại của ứng dụng
 * Tự động chuyển đổi giao thức file:/// sang HTTP Web/LAN để Zalo không báo lỗi invalidurl
 */
function getBaseReportUrl() {
  const custom = localStorage.getItem(CUSTOM_BASE_URL_KEY);
  if (custom && custom.trim()) {
    return custom.trim();
  }
  // Nếu đang mở file:// hoặc localhost/127.0.0.1, tự động dùng địa chỉ Web LAN chuẩn để gửi Zalo không bị lỗi invalidurl
  if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return DEFAULT_LAN_BASE_URL;
  }
  return window.location.href.split('?')[0].split('#')[0];
}

/**
 * Sinh ra đường link báo cáo riêng biệt cho từng nhân viên
 */
function getEmployeeDirectLink(username, action = '') {
  const baseUrl = getBaseReportUrl();
  let url = `${baseUrl}?user=${encodeURIComponent(username)}`;
  if (action) {
    url += `&action=${encodeURIComponent(action)}`;
  }
  return url;
}

/**
 * Sao chép link báo cáo riêng của 1 nhân viên
 */
function copyEmployeeReportLink(username, fullName) {
  const link = getEmployeeDirectLink(username);
  copyTextToClipboard(
    link,
    `✅ Đã sao chép link báo cáo của "${fullName}"!\nBạn có thể gửi trực tiếp link này qua Zalo cho nhân viên.`
  );
}

/**
 * Sao chép mẫu tin nhắn Zalo kèm đường link báo cáo riêng
 */
function copyZaloMessageWithLink(username, fullName) {
  const link = getEmployeeDirectLink(username);
  const msg = `👋 Chào anh/chị ${fullName},

Đây là đường link báo cáo công việc hàng ngày dành riêng cho bạn gửi cho Quản lý:
👉 ${link}

📌 HƯỚNG DẪN BÁO CÁO:
1. Bấm trực tiếp vào link trên (hệ thống tự động liên kết tài khoản "${fullName}").
2. Đầu tuần: Bấm "Lập Kế Hoạch Tuần" để đăng ký các công việc trong tuần.
3. Hàng ngày: Bấm "Cập nhật tiến độ" để điền số lượng và chi tiết công việc thực tế đã làm.
💡 Gợi ý: Bạn nên lưu link này vào mục "Cloud của tôi" trên Zalo hoặc Ghim lên màn hình điện thoại để mở nhanh mỗi ngày!`;

  copyTextToClipboard(
    msg,
    `✅ Đã sao chép mẫu tin nhắn Zalo kèm link riêng cho "${fullName}"!\nChỉ cần dán (Ctrl + V) vào hộp chat Zalo.`
  );
}

/**
 * Sao chép tin nhắn nhắc nhở nộp báo cáo ngày kèm link riêng
 */
function copyReminderForUser(username, fullName) {
  const checkDate = document.getElementById('tracker-date-input')?.value.trim() || appState.selectedTrackerDate;
  const link = getEmployeeDirectLink(username);

  const msg = `📢 [NHẮC BÁO CÁO CÔNG VIỆC NGÀY ${checkDate}]
Chào bạn ${fullName},
Hệ thống quản lý ghi nhận bạn chưa gửi báo cáo tiến độ công việc hôm nay (${checkDate}).
Vui lòng bấm vào đường link riêng của bạn dưới đây để gửi báo cáo nhanh cho Quản lý:
👉 ${link}
(Tài khoản của bạn đã được liên kết tự động, không cần đăng nhập lại)
Xin cảm ơn!`;

  copyTextToClipboard(
    msg,
    `✅ Đã sao chép tin nhắn nhắc nhở kèm link riêng cho "${fullName}"!\nBạn có thể dán (Ctrl + V) gửi ngay qua Zalo.`
  );
}

/**
 * Sao chép danh sách toàn bộ đường link của tất cả nhân viên
 */
function copyAllEmployeeLinks() {
  const activeEmployees = appState.users.filter(u => u.role === 'employee' && u.status === 'active');
  if (activeEmployees.length === 0) {
    alert("Chưa có tài khoản nhân viên nào trong hệ thống!");
    return;
  }

  const todayStr = new Date().toLocaleDateString('vi-VN');
  let text = `📋 DANH SÁCH ĐƯỜNG LINK BÁO CÁO CÔNG VIỆC RIÊNG CỦA NHÂN VIÊN\n`;
  text += `Cập nhật ngày: ${todayStr} • Số lượng: ${activeEmployees.length} nhân sự\n`;
  text += `==================================================\n\n`;

  activeEmployees.forEach((u, idx) => {
    const link = getEmployeeDirectLink(u.username);
    text += `${idx + 1}. ${u.fullName} (${u.position})\n`;
    text += `   👉 Link: ${link}\n\n`;
  });

  text += `==================================================\n`;
  text += `📌 GHI CHÚ:\n`;
  text += `- Mỗi nhân viên bấm vào link riêng của mình để vào thẳng cổng báo cáo cho Quản lý.\n`;
  text += `- Tên nhân viên tự động gắn cố định, không sợ nhầm lẫn.\n`;
  text += `- Nhân viên có thể lưu vào Zalo Cloud hoặc Trình duyệt điện thoại để mở nhanh hàng ngày.`;

  copyTextToClipboard(
    text,
    `✅ Đã sao chép danh sách đường link của toàn bộ ${activeEmployees.length} nhân viên!\nBạn có thể dán lưu trữ hoặc gửi vào nhóm làm việc.`
  );
}

/**
 * Nhân viên tự sao chép link báo cáo của chính mình để lưu lại
 */
function copyMyCurrentDirectLink() {
  if (!appState.currentUser) return;
  const link = getEmployeeDirectLink(appState.currentUser.username);
  copyTextToClipboard(
    link,
    `✅ Đã sao chép đường link báo cáo riêng của bạn!\nBạn có thể dán lưu vào mục "Cloud của tôi" trên Zalo hoặc Dấu trang trình duyệt.`
  );
}

/**
 * Modal cấu hình Base URL
 */
function openConfigUrlModal() {
  const input = document.getElementById('config-base-url-input');
  const custom = localStorage.getItem(CUSTOM_BASE_URL_KEY) || '';
  if (input) input.value = custom;
  updateConfigPreview();
  document.getElementById('config-url-modal').classList.remove('hidden');
}

function closeConfigUrlModal() {
  document.getElementById('config-url-modal').classList.add('hidden');
}

function updateConfigPreview() {
  const input = document.getElementById('config-base-url-input');
  const preview = document.getElementById('config-preview-link');
  if (!preview) return;

  const val = input ? input.value.trim() : '';
  const base = val || getBaseReportUrl();
  preview.textContent = `${base}?user=duonghonghai`;
}

function setPresetConfigUrl(type) {
  const input = document.getElementById('config-base-url-input');
  if (!input) return;
  if (type === 'lan') {
    input.value = DEFAULT_LAN_BASE_URL;
  } else if (type === 'file') {
    input.value = window.location.href.split('?')[0].split('#')[0];
  }
  updateConfigPreview();
}

function saveConfigUrl() {
  const input = document.getElementById('config-base-url-input');
  const val = input ? input.value.trim() : '';
  if (val) {
    localStorage.setItem(CUSTOM_BASE_URL_KEY, val);
    showToast("✅ Đã lưu cấu hình địa chỉ gốc Web/LAN thành công!", "success");
  } else {
    localStorage.removeItem(CUSTOM_BASE_URL_KEY);
    showToast("✅ Đã chuyển về sử dụng địa chỉ trình duyệt mặc định!", "info");
  }
  closeConfigUrlModal();
  renderUsersView();
}

function resetConfigUrl() {
  localStorage.removeItem(CUSTOM_BASE_URL_KEY);
  const input = document.getElementById('config-base-url-input');
  if (input) input.value = '';
  updateConfigPreview();
  showToast("Đã khôi phục địa chỉ mặc định!", "info");
}

/**
 * ========================================================
 * 1.2. CON TRỎ KÉO MỞ RỘNG CỘT & ĐIỀU KHIỂN CUỘN BẢNG
 * ========================================================
 */

/**
 * Gắn con trỏ kéo ↔ vào các mép cột (th) để người dùng kéo giãn / thu nhỏ độ rộng
 */
function initTableColumnResizers() {
  document.querySelectorAll('.excel-table').forEach(table => {
    const ths = table.querySelectorAll('thead th');
    ths.forEach(th => {
      if (th.querySelector('.col-resizer')) return;

      const resizer = document.createElement('div');
      resizer.className = 'col-resizer';
      resizer.title = 'Kéo chuột qua lại để mở rộng / thu nhỏ cột';
      th.appendChild(resizer);

      let startX = 0;
      let startWidth = 0;

      resizer.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();

        startX = e.pageX;
        startWidth = th.offsetWidth;
        resizer.classList.add('is-resizing');

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        function onMouseMove(e) {
          const diff = e.pageX - startX;
          const newWidth = Math.max(35, startWidth + diff);
          th.style.width = newWidth + 'px';
          th.style.minWidth = newWidth + 'px';
        }

        function onMouseUp() {
          resizer.classList.remove('is-resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  });
}

/**
 * Điều khiển thanh trượt kéo qua lại để mở rộng xem các cột chưa hiển thị hết
 */
function handleTableRangeScroll(containerId, value) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const maxScroll = container.scrollWidth - container.clientWidth;
  if (maxScroll > 0) {
    container.scrollLeft = (value / 100) * maxScroll;
  }
}

function scrollTableLeft(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.scrollBy({ left: -250, behavior: 'smooth' });
  }
}

function scrollTableRight(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.scrollBy({ left: 250, behavior: 'smooth' });
  }
}

function syncTableRangeScroll(containerId, rangeId) {
  const container = document.getElementById(containerId);
  const range = document.getElementById(rangeId);
  if (!container || !range) return;

  container.addEventListener('scroll', () => {
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll > 0) {
      range.value = Math.round((container.scrollLeft / maxScroll) * 100);
    } else {
      range.value = 0;
    }
  });
}

/**
 * ========================================================
 * 2. KHỞI TẠO DỮ LIỆU BÁO CÁO & ỨNG DỤNG
 * ========================================================
 */
function initApp() {
  initUsers();
  loadData();
  checkAuthSession();
  initTrackerDate();
  populateDropdowns();
  renderApp();
  setupEventListeners();

  // Xử lý tự động mở hành động khi vào bằng link đặc biệt (?action=plan hoặc ?action=report)
  if (appState.pendingAction) {
    const act = appState.pendingAction;
    appState.pendingAction = null;
    setTimeout(() => {
      if (act === 'plan' && typeof openMultiPlanModal === 'function') {
        openMultiPlanModal();
      } else if (act === 'report' && typeof openReportModal === 'function') {
        openReportModal();
      }
    }, 400);
  }

  // Khởi tạo con trỏ kéo mở rộng cột (col-resize)
  setTimeout(initTableColumnResizers, 100);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      appState.reports = JSON.parse(raw);
    } else {
      const oldV1 = localStorage.getItem('DAILY_WORK_REPORTS_V1');
      if (oldV1) {
        appState.reports = JSON.parse(oldV1);
      } else if (window.INITIAL_REPORTS && Array.isArray(window.INITIAL_REPORTS)) {
        appState.reports = [...window.INITIAL_REPORTS];
      } else {
        appState.reports = [];
      }
      saveData();
    }
  } catch (e) {
    console.error("Lỗi nạp dữ liệu:", e);
    appState.reports = window.INITIAL_REPORTS || [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.reports));
  } catch (e) {
    console.error("Lỗi lưu dữ liệu:", e);
    alert("Không thể lưu vào bộ nhớ trình duyệt (dung lượng đầy). Vui lòng xuất dữ liệu ra file Excel!");
  }
}

/**
 * Khởi tạo ngày theo dõi điểm danh (Mặc định hôm nay hoặc ngày gần nhất trong data)
 */
function initTrackerDate() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  appState.selectedTrackerDate = `${dd}/${mm}/${yyyy}`;
}

function getUniqueWeeks() {
  const weeks = new Set();
  appState.reports.forEach(r => {
    if (r.week !== undefined && r.week !== null && r.week.toString().trim()) {
      weeks.add(r.week.toString().trim());
    }
  });
  return Array.from(weeks).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return nb - na;
    return b.localeCompare(a);
  });
}

function populateDropdowns() {
  const weeks = getUniqueWeeks();

  // Danh sách nhân viên lấy từ User Store
  const employeeUsers = appState.users.filter(u => u.role === 'employee' && u.status === 'active');

  // Filter nhân viên cho Quản lý
  const filterEmp = document.getElementById('filter-employee');
  if (filterEmp) {
    filterEmp.innerHTML = '<option value="all">Tất cả nhân viên</option>' + 
      employeeUsers.map(u => `<option value="${escapeHtml(u.fullName)}">${escapeHtml(u.fullName)}</option>`).join('');
  }

  // Filter tuần cho Quản lý
  const filterWeek = document.getElementById('filter-week');
  if (filterWeek) {
    filterWeek.innerHTML = '<option value="all">Tất cả các tuần</option>' + 
      weeks.map(w => `<option value="${escapeHtml(w)}">Tuần ${escapeHtml(w)}</option>`).join('');
  }

  // Filter tuần cho Nhân viên
  const empFilterWeek = document.getElementById('emp-filter-week');
  if (empFilterWeek) {
    empFilterWeek.innerHTML = '<option value="all">Tất cả các tuần</option>' + 
      weeks.map(w => `<option value="${escapeHtml(w)}" ${w === appState.empFilterWeek ? 'selected' : ''}>Tuần ${escapeHtml(w)}</option>`).join('');
  }

  // Filter loại công việc
  const filterJob = document.getElementById('filter-job-type');
  if (filterJob) {
    filterJob.innerHTML = '<option value="all">Tất cả loại công việc</option>' + 
      JOB_TYPES.map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join('');
  }

  // Form select loại công việc
  const formJobType = document.getElementById('form-job-type');
  if (formJobType) {
    formJobType.innerHTML = JOB_TYPES.map(j => 
      `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`
    ).join('');
  }

  // Quick login dropdown trên màn hình login
  const quickEmpSelect = document.getElementById('quick-emp-select');
  if (quickEmpSelect) {
    quickEmpSelect.innerHTML = '<option value="">-- Chọn nhanh tài khoản nhân viên để thử --</option>' + 
      employeeUsers.map(u => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.fullName)} (${escapeHtml(u.position)})</option>`).join('');
  }

  // Danh sách các ngày gần đây có dữ liệu để Quản lý kiểm tra nhanh
  const uniqueDates = Array.from(new Set(appState.reports.map(r => r.date).filter(Boolean))).slice(0, 35);
  const trackerQuick = document.getElementById('tracker-quick-dates');
  if (trackerQuick) {
    trackerQuick.innerHTML = '<option value="">-- Chọn ngày có dữ liệu --</option>' + 
      uniqueDates.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }
}

/**
 * ========================================================
 * 3. ĐIỀU PHỐI GIAO DIỆN CHÍNH (VIEW ROUTING)
 * ========================================================
 */
function renderApp() {
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  // Chưa đăng nhập -> Hiện màn hình đăng nhập
  if (!appState.currentUser) {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
    populateDropdowns();
    return;
  }

  // Đã đăng nhập -> Hiện ứng dụng chính
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  const user = appState.currentUser;
  const isAdmin = user.role === 'admin';

  // Hiển thị thông tin người dùng ở Header
  document.getElementById('header-user-avatar').textContent = (user.fullName || '?').charAt(0).toUpperCase();
  document.getElementById('header-user-name').textContent = user.fullName;
  document.getElementById('header-user-role-badge').textContent = isAdmin ? 'Quản trị viên' : user.position;
  document.getElementById('header-user-role-badge').className = isAdmin 
    ? 'text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300'
    : 'text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';

  // Phân quyền thanh điều hướng
  const managerNavGroup = document.getElementById('manager-nav-group');
  const employeeNavBtn = document.getElementById('btn-nav-employee');

  if (isAdmin) {
    // Admin có toàn quyền xem các tab Quản lý
    managerNavGroup.style.display = 'flex';
    employeeNavBtn.style.display = 'inline-flex';
    document.getElementById('header-admin-tools').style.display = 'flex';

    // Điều hướng theo tab Admin hiện tại
    renderAdminTabs();
  } else {
    // Nhân viên chỉ được xem cổng Nhân viên của chính mình!
    managerNavGroup.style.display = 'none';
    employeeNavBtn.style.display = 'none';
    document.getElementById('header-admin-tools').style.display = 'none';

    // Bắt buộc mở giao diện Nhân viên
    document.getElementById('manager-view').style.display = 'none';
    document.getElementById('admin-tracker-view').style.display = 'none';
    document.getElementById('admin-users-view').style.display = 'none';
    document.getElementById('employee-view').style.display = 'block';

    renderEmployeeView();
  }
}

/**
 * Chuyển tab trong phân hệ Admin
 */
function switchAdminTab(tabName) {
  if (appState.currentUser?.role !== 'admin') {
    alert("Bạn không có quyền truy cập chức năng này!");
    return;
  }
  appState.currentAdminTab = tabName;
  renderAdminTabs();
}

function renderAdminTabs() {
  const tab = appState.currentAdminTab;

  // Ẩn tất cả views
  document.getElementById('manager-view').style.display = 'none';
  document.getElementById('admin-tracker-view').style.display = 'none';
  document.getElementById('admin-users-view').style.display = 'none';
  document.getElementById('employee-view').style.display = 'none';

  // Cập nhật nút active
  const btnReports = document.getElementById('btn-tab-reports');
  const btnTracker = document.getElementById('btn-tab-tracker');
  const btnUsers = document.getElementById('btn-tab-users');
  const btnEmployee = document.getElementById('btn-nav-employee');

  const baseCls = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5';
  const activeCls = 'px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-700 text-white shadow-sm flex items-center gap-1.5';
  const inactiveCls = 'px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition';

  btnReports.className = tab === 'reports' ? activeCls : inactiveCls;
  btnTracker.className = tab === 'daily_tracker' ? activeCls : inactiveCls;
  btnUsers.className = tab === 'user_manager' ? activeCls : inactiveCls;
  btnEmployee.className = tab === 'employee_view' ? activeCls : inactiveCls;

  if (tab === 'reports') {
    document.getElementById('manager-view').style.display = 'block';
    renderManagerView();
  } else if (tab === 'daily_tracker') {
    document.getElementById('admin-tracker-view').style.display = 'block';
    renderDailyTrackerView();
  } else if (tab === 'user_manager') {
    document.getElementById('admin-users-view').style.display = 'block';
    renderUsersView();
  } else if (tab === 'employee_view') {
    document.getElementById('employee-view').style.display = 'block';
    renderEmployeeView();
  }
}

/**
 * ========================================================
 * 4. PHÂN HỆ QUẢN LÝ: THỐNG KÊ NGÀY & AI CHƯA BÁO CÁO (MỚI)
 * ========================================================
 */
function renderDailyTrackerView() {
  const trackerInput = document.getElementById('tracker-date-input');
  if (trackerInput && !trackerInput.value) {
    trackerInput.value = appState.selectedTrackerDate;
  }
  const checkDate = trackerInput ? trackerInput.value.trim() : appState.selectedTrackerDate;

  // Lấy toàn bộ nhân viên hoạt động
  const activeEmployees = appState.users.filter(u => u.role === 'employee' && u.status === 'active');
  const totalEmployeesCount = activeEmployees.length;

  // Lọc các báo cáo của ngày này (so khớp chuỗi ngày)
  const dayReports = appState.reports.filter(r => {
    if (!r.date) return false;
    const rDate = r.date.trim();
    // Khớp chính xác hoặc khớp dải ngày ví dụ "18 19/07/2026"
    return rDate === checkDate || rDate.includes(checkDate);
  });

  // Tìm danh sách tên các nhân viên ĐÃ báo cáo trong ngày
  const reportedMap = new Map();
  dayReports.forEach(r => {
    if (r.employeeName) {
      if (!reportedMap.has(r.employeeName)) {
        reportedMap.set(r.employeeName, []);
      }
      reportedMap.get(r.employeeName).push(r);
    }
  });

  // Chia làm 2 nhóm: Đã báo cáo & Chưa báo cáo
  const reportedList = [];
  const unreportedList = [];

  activeEmployees.forEach(u => {
    if (reportedMap.has(u.fullName)) {
      reportedList.push({
        user: u,
        reports: reportedMap.get(u.fullName)
      });
    } else {
      unreportedList.push(u);
    }
  });

  // Cập nhật số liệu KPI ngày
  document.getElementById('tracker-total-emps').textContent = totalEmployeesCount;
  document.getElementById('tracker-reported-count').textContent = reportedList.length;
  document.getElementById('tracker-unreported-count').textContent = unreportedList.length;

  const rate = totalEmployeesCount > 0 ? Math.round((reportedList.length / totalEmployeesCount) * 100) : 0;
  document.getElementById('tracker-rate-percent').textContent = `${rate}%`;

  // Render Danh sách CHƯA BÁO CÁO (Highlight cảnh báo đỏ)
  const unrepBody = document.getElementById('tracker-unreported-body');
  document.getElementById('tracker-unreported-badge').textContent = `${unreportedList.length} nhân sự`;

  if (unreportedList.length === 0) {
    unrepBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 text-center text-emerald-600 bg-emerald-50/50">
          <i class="fa-solid fa-circle-check text-3xl mb-2 block text-emerald-500"></i>
          <strong>Tuyệt vời!</strong> Toàn bộ ${totalEmployeesCount} nhân viên đã nộp báo cáo đầy đủ trong ngày ${checkDate}.
        </td>
      </tr>
    `;
  } else {
    unrepBody.innerHTML = unreportedList.map((u, idx) => `
      <tr class="hover:bg-rose-50/40 transition">
        <td class="cell-center text-xs font-semibold text-slate-400">${idx + 1}</td>
        <td class="font-bold text-slate-900 whitespace-nowrap">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
              ${u.fullName.charAt(0)}
            </span>
            <span>${escapeHtml(u.fullName)}</span>
          </div>
        </td>
        <td class="text-xs text-slate-600">${escapeHtml(u.position)}</td>
        <td class="text-xs font-mono text-slate-500">@${escapeHtml(u.username)}</td>
        <td class="cell-center whitespace-nowrap">
          <span class="badge-unreported px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <i class="fa-solid fa-triangle-exclamation"></i> Chưa có báo cáo
          </span>
        </td>
        <td class="cell-center whitespace-nowrap">
          <button onclick="copyReminderForUser('${u.username}', '${escapeHtml(u.fullName)}')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center gap-1.5 shadow-sm transition w-full" title="Copy tin nhắn nhắc nhở kèm link riêng gửi cho ${escapeHtml(u.fullName)}">
            <i class="fa-solid fa-paper-plane text-rose-600"></i>
            <span>Nhắc Zalo + Link</span>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // Render Danh sách ĐÃ BÁO CÁO
  const repBody = document.getElementById('tracker-reported-body');
  document.getElementById('tracker-reported-badge').textContent = `${reportedList.length} nhân sự`;

  if (reportedList.length === 0) {
    repBody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400">
          Chưa có nhân viên nào gửi báo cáo trong ngày ${checkDate}.
        </td>
      </tr>
    `;
  } else {
    repBody.innerHTML = reportedList.map((item, idx) => {
      const u = item.user;
      const reps = item.reports;
      const jobBadges = reps.map(r => getJobBadgeHtml(r.jobType)).join(' ');

      // Tổng địa điểm & thiết bị thực tế
      let actualLocSum = 0;
      let actualQtySum = 0;
      reps.forEach(r => {
        const l = parseInt(r.actualLocations, 10);
        if (!isNaN(l)) actualLocSum += l;
        const q = parseInt(r.actualQuantity, 10);
        if (!isNaN(q)) actualQtySum += q;
      });

      return `
        <tr class="hover:bg-emerald-50/30 transition">
          <td class="cell-center text-xs font-semibold text-slate-400">${idx + 1}</td>
          <td class="font-bold text-slate-900 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                ${u.fullName.charAt(0)}
              </span>
              <span>${escapeHtml(u.fullName)}</span>
            </div>
          </td>
          <td class="text-xs text-slate-600">${escapeHtml(u.position)}</td>
          <td>${jobBadges}</td>
          <td class="cell-center font-bold text-emerald-800">${actualLocSum} ĐĐ / ${actualQtySum} SL</td>
          <td class="cell-center whitespace-nowrap">
            <span class="badge-reported px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
              <i class="fa-solid fa-check"></i> ${reps.length} đầu việc
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Đổi ngày kiểm tra điểm danh
 */
function handleTrackerDateChange(dateVal) {
  appState.selectedTrackerDate = dateVal;
  renderDailyTrackerView();
}

/**
 * Sao chép danh sách nhân viên chưa báo cáo vào Clipboard để Quản lý nhắn Zalo/Telegram
 */
function copyUnreportedToClipboard() {
  const checkDate = document.getElementById('tracker-date-input').value.trim() || appState.selectedTrackerDate;
  const activeEmployees = appState.users.filter(u => u.role === 'employee' && u.status === 'active');
  const dayReports = appState.reports.filter(r => r.date && (r.date.trim() === checkDate || r.date.includes(checkDate)));
  const reportedSet = new Set(dayReports.map(r => r.employeeName));

  const unrep = activeEmployees.filter(u => !reportedSet.has(u.fullName));

  if (unrep.length === 0) {
    alert(`Tất cả nhân viên đã báo cáo đầy đủ trong ngày ${checkDate}!`);
    return;
  }

  let text = `📢 DANH SÁCH NHẮC NHỞ BÁO CÁO CÔNG VIỆC NGÀY ${checkDate}\n`;
  text += `Hệ thống ghi nhận còn ${unrep.length} nhân sự chưa gửi báo cáo ngày:\n\n`;
  unrep.forEach((u, i) => {
    const link = getEmployeeDirectLink(u.username);
    text += `${i + 1}. ${u.fullName} (${u.position})\n   👉 Link báo cáo riêng: ${link}\n\n`;
  });
  text += `👉 Đề nghị các anh/em bấm trực tiếp vào đường link riêng tương ứng ở trên để cập nhật tiến độ công việc hôm nay gửi Quản lý!`;

  copyTextToClipboard(text, `✅ Đã sao chép danh sách ${unrep.length} nhân viên chưa báo cáo kèm link riêng! Bạn có thể dán (Ctrl + V) vào nhóm Zalo.`);
}

/**
 * ========================================================
 * 5. PHÂN HỆ QUẢN TRỊ: QUẢN LÝ TÀI KHOẢN NHÂN VIÊN (MỚI)
 * ========================================================
 */
function renderUsersView() {
  const tbody = document.getElementById('users-table-body');
  document.getElementById('users-count-badge').textContent = `${appState.users.length} tài khoản`;

  tbody.innerHTML = appState.users.map((u, idx) => {
    const isAdmin = u.role === 'admin';
    const isCurrentUser = appState.currentUser?.username === u.username;

    const roleBadge = isAdmin
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Quản trị viên (Admin)</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Nhân viên</span>`;

    const statusBadge = u.status === 'active'
      ? `<span class="text-emerald-600 text-xs font-semibold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Hoạt động</span>`
      : `<span class="text-rose-600 text-xs font-semibold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Đã khóa</span>`;

    const directLink = getEmployeeDirectLink(u.username);
    const linkColHtml = !isAdmin ? `
      <div class="inline-flex items-center gap-1.5">
        <button onclick="copyEmployeeReportLink('${u.username}', '${escapeHtml(u.fullName)}')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 shadow-sm transition" title="Sao chép link báo cáo riêng gửi cho ${escapeHtml(u.fullName)}">
          <i class="fa-solid fa-link text-indigo-600"></i>
          <span>Copy Link</span>
        </button>
        <button onclick="copyZaloMessageWithLink('${u.username}', '${escapeHtml(u.fullName)}')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-sm transition" title="Sao chép mẫu tin nhắn Zalo kèm link cho ${escapeHtml(u.fullName)}">
          <i class="fa-solid fa-comment-dots text-emerald-600"></i>
          <span>Mẫu Zalo</span>
        </button>
        <a href="${directLink}" target="_blank" class="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition" title="Mở thử cổng báo cáo của ${escapeHtml(u.fullName)} trong tab mới">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    ` : `<span class="text-xs text-slate-400 italic">Tài khoản Quản lý</span>`;

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="cell-center text-xs font-semibold text-slate-400">${idx + 1}</td>
        <td class="font-mono font-bold text-blue-900">${escapeHtml(u.username)}</td>
        <td class="font-semibold text-slate-900">${escapeHtml(u.fullName)}</td>
        <td class="text-xs text-slate-600">${escapeHtml(u.position)}</td>
        <td class="cell-center">${roleBadge}</td>
        <td class="cell-center">${statusBadge}</td>
        <td class="cell-center whitespace-nowrap">${linkColHtml}</td>
        <td class="cell-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="promptChangePassword('${u.id}')" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition" title="Đổi mật khẩu">
              <i class="fa-solid fa-key"></i>
            </button>
            ${!isAdmin && !isCurrentUser ? `
              <button onclick="toggleUserStatus('${u.id}')" class="p-1.5 ${u.status === 'active' ? 'text-amber-600 hover:bg-amber-100' : 'text-emerald-600 hover:bg-emerald-100'} rounded transition" title="${u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}">
                <i class="fa-solid ${u.status === 'active' ? 'fa-user-slash' : 'fa-user-check'}"></i>
              </button>
              <button onclick="deleteUser('${u.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 rounded transition" title="Xóa tài khoản">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : '<span class="text-xs text-slate-300 italic">Mặc định</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openCreateUserModal() {
  document.getElementById('create-user-form').reset();
  document.getElementById('create-user-modal').classList.remove('hidden');
}

function closeCreateUserModal() {
  document.getElementById('create-user-modal').classList.add('hidden');
}

function handleCreateUser(e) {
  e.preventDefault();

  const username = document.getElementById('new-username').value.trim().toLowerCase();
  const password = document.getElementById('new-password').value.trim();
  const fullName = document.getElementById('new-fullname').value.trim();
  const position = document.getElementById('new-position').value.trim();
  const role = document.getElementById('new-role').value;

  if (!username || !password || !fullName) {
    alert("Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Họ tên!");
    return;
  }

  // Kiểm tra trùng username
  if (appState.users.some(u => u.username.toLowerCase() === username)) {
    alert(`Tên đăng nhập "${username}" đã tồn tại trong hệ thống. Vui lòng chọn tên khác!`);
    return;
  }

  const newUser = {
    id: 'usr-' + Date.now(),
    username: username,
    password: password,
    fullName: fullName,
    position: position || 'Nhân viên',
    role: role,
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10)
  };

  appState.users.push(newUser);
  saveUsers();
  populateDropdowns();
  renderUsersView();
  closeCreateUserModal();

  alert(`Đã tạo thành công tài khoản cho "${fullName}" với tên đăng nhập: ${username}`);
}

function promptChangePassword(userId) {
  const user = appState.users.find(u => u.id === userId);
  if (!user) return;

  const newPass = prompt(`Nhập mật khẩu mới cho tài khoản "${user.username}" (${user.fullName}):`);
  if (newPass && newPass.trim()) {
    user.password = newPass.trim();
    saveUsers();
    alert(`Đã đổi mật khẩu thành công cho tài khoản "${user.username}"!`);
  }
}

function toggleUserStatus(userId) {
  const user = appState.users.find(u => u.id === userId);
  if (!user) return;
  user.status = user.status === 'active' ? 'blocked' : 'active';
  saveUsers();
  renderUsersView();
}

function deleteUser(userId) {
  const user = appState.users.find(u => u.id === userId);
  if (!user) return;
  if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${user.username}" (${user.fullName})?`)) {
    appState.users = appState.users.filter(u => u.id !== userId);
    saveUsers();
    populateDropdowns();
    renderUsersView();
  }
}

/**
 * ========================================================
 * 6. PHÂN HỆ NHÂN VIÊN: KẾ HOẠCH TUẦN & THỰC TẾ NGÀY
 * ========================================================
 */
let multiPlanRowCounter = 0;

function changeAdminViewingEmployee(empName) {
  appState.currentEmployee = empName;
  renderEmployeeView();
}

/**
 * ========================================================
 * XỬ LÝ NGÀY THÁNG, LỊCH & KIỂM TRA TÍNH HỢP LỆ (VALIDATION)
 * ========================================================
 */

const VI_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Chuyển đổi định dạng ngày bất kỳ thành YYYY-MM-DD để gán vào input type="date" */
function toISODateString(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    // Dạng dải ngày như 07-08/11/2026 hoặc 18 19/07/2026
    if (trimmed.includes('/') && (trimmed.includes('-') || trimmed.includes(' '))) {
      const parts = trimmed.split('/');
      const dPart = parts[0].replace('-', ' ').trim().split(/\s+/)[0];
      const m = parts[1];
      const y = parts[2];
      return `${y}-${String(m).padStart(2, '0')}-${String(dPart).padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } else if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/** Chuyển đổi YYYY-MM-DD thành định dạng hiển thị DD/MM/YYYY */
function toDisplayDateString(isoOrStr) {
  if (!isoOrStr) return '';
  const trimmed = String(isoOrStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

/** Lấy tên thứ trong tuần (Thứ Hai, Thứ Ba...) */
function getWeekdayName(dateVal) {
  const iso = toISODateString(dateVal);
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return VI_WEEKDAYS[dt.getDay()] || '';
}

/** Tính ngày Thứ 2 và Chủ Nhật của một số tuần trong năm (ISO-8601) */
function getDateRangeOfWeek(weekNo, year = new Date().getFullYear()) {
  const targetYear = year || new Date().getFullYear();
  // 4 Tháng 1 luôn thuộc tuần 1 theo chuẩn ISO
  const jan4 = new Date(targetYear, 0, 4);
  const day = jan4.getDay() || 7; // 1 = Thứ 2, 7 = CN
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() + (weekNo - 1) * 7 - (day - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

/**
 * Kiểm tra tính hợp lệ của ngày làm việc:
 * 1. Không được là ngày trong quá khứ (< hôm nay lúc 00:00:00)
 * 2. Phải thuộc đúng tuần làm việc đã chọn
 */
function validateWorkDate(dateInput, targetWeek) {
  if (!dateInput) {
    return { valid: false, errorType: 'empty', message: 'Chưa chọn ngày làm việc trên lịch!' };
  }

  const isoStr = toISODateString(dateInput);
  if (!isoStr) {
    return { valid: false, errorType: 'invalid', message: 'Định dạng ngày không hợp lệ!' };
  }

  const [y, m, day] = isoStr.split('-').map(Number);
  const workDate = new Date(y, m - 1, day, 0, 0, 0, 0);

  if (isNaN(workDate.getTime())) {
    return { valid: false, errorType: 'invalid', message: 'Ngày không hợp lệ!' };
  }

  // 1. Kiểm tra ngày trong quá khứ
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPast = workDate.getTime() < today.getTime();

  // 2. Kiểm tra ngày có thuộc tuần đã chọn không
  let isWrongWeek = false;
  let actualWeek = null;
  let expectedWeek = null;
  if (targetWeek !== undefined && targetWeek !== null && targetWeek !== '') {
    expectedWeek = parseInt(targetWeek, 10);
    actualWeek = getWeekNumber(workDate);
    if (!isNaN(expectedWeek) && actualWeek !== expectedWeek) {
      isWrongWeek = true;
    }
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const dateDisplay = `${dd}/${mm}/${y}`;
  const todayDisplay = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  if (isPast && isWrongWeek) {
    return {
      valid: false,
      errorType: 'past_and_wrong_week',
      message: `Ngày ${dateDisplay} vừa trong quá khứ (< ${todayDisplay}), vừa không thuộc Tuần ${expectedWeek} (thực tế Tuần ${actualWeek})!`
    };
  }

  if (isPast) {
    return {
      valid: false,
      errorType: 'past',
      message: `Ngày trong quá khứ (${dateDisplay} < hôm nay ${todayDisplay})! Không thể lập kế hoạch.`
    };
  }

  if (isWrongWeek) {
    return {
      valid: false,
      errorType: 'wrong_week',
      message: `Ngày ${dateDisplay} không đúng ngày trong Tuần ${expectedWeek} (thực tế thuộc Tuần ${actualWeek})!`
    };
  }

  return { valid: true, errorType: null, message: '' };
}

/**
 * ========================================================
 * MODAL LẬP KẾ HOẠCH TUẦN ĐA DÒNG (BÁO CÁO 1 LẦN NHIỀU NGÀY)
 * ========================================================
 */
function openMultiPlanModal() {
  const user = appState.currentUser;
  if (!user) return;

  const isEmp = user.role === 'employee';
  const empName = isEmp ? user.fullName : (appState.currentEmployee || user.fullName);
  const empUser = appState.users.find(u => u.fullName === empName);
  const empPos = empUser ? empUser.position : (isEmp ? user.position : 'Nhân viên');

  // Gán thông tin nhân viên
  document.getElementById('multi-plan-emp-name').textContent = empName;
  document.getElementById('multi-plan-emp-pos').textContent = empPos;

  // Gợi ý tuần: Nếu hôm nay là Thứ 6/7/CN thì gợi ý tuần sau, ngược lại gợi ý tuần này
  const today = new Date();
  const curWeek = getWeekNumber(today);
  const dayOfWeek = today.getDay(); // 0 = CN, 5 = T6, 6 = T7

  // Mặc định chọn tuần hiện tại hoặc tuần sau
  let defaultWeek = curWeek;
  if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
    defaultWeek = curWeek + 1; // Cuối tuần thường lên kế hoạch cho tuần tới
  }

  document.getElementById('multi-plan-week').value = defaultWeek;
  updateMultiPlanWeekRangeDisplay();

  // Tạo sẵn các ngày làm việc chuẩn
  document.getElementById('multi-plan-table-body').innerHTML = '';
  multiPlanRowCounter = 0;
  generateStandardWeekRows();

  document.getElementById('multi-plan-modal').classList.remove('hidden');
}

function closeMultiPlanModal() {
  document.getElementById('multi-plan-modal').classList.add('hidden');
}

/** Cập nhật nhãn hiển thị dải ngày của tuần trên modal kế hoạch */
function updateMultiPlanWeekRangeDisplay() {
  const weekInput = document.getElementById('multi-plan-week');
  const rangeText = document.getElementById('multi-plan-week-range-text');
  if (!weekInput || !rangeText) return;

  const targetWeek = parseInt(weekInput.value, 10);
  if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 53) {
    rangeText.textContent = '--/-- ➔ --/--';
    return;
  }

  const { monday, sunday } = getDateRangeOfWeek(targetWeek);
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  rangeText.textContent = `${fmt(monday)} ➔ ${fmt(sunday)}/${monday.getFullYear()}`;

  // Đổi trạng thái nút bấm nhanh tuần
  const today = new Date();
  const curWeek = getWeekNumber(today);
  const btnCur = document.getElementById('btn-mp-cur-week');
  const btnNext = document.getElementById('btn-mp-next-week');

  if (btnCur) {
    if (targetWeek === curWeek) {
      btnCur.className = 'px-2.5 py-1 text-xs font-bold rounded bg-sky-100 text-sky-800 border border-sky-300';
    } else {
      btnCur.className = 'px-2.5 py-1 text-xs font-bold rounded text-slate-600 hover:bg-slate-100';
    }
  }

  if (btnNext) {
    if (targetWeek === curWeek + 1) {
      btnNext.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 text-white shadow-sm flex items-center gap-1';
    } else {
      btnNext.className = 'px-2.5 py-1 text-xs font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1';
    }
  }
}

/** Chọn nhanh Tuần này hoặc Tuần sau */
function setMultiPlanWeek(mode) {
  const today = new Date();
  const curWeek = getWeekNumber(today);
  const targetWeek = mode === 'next' ? (curWeek + 1) : curWeek;

  const weekInput = document.getElementById('multi-plan-week');
  if (weekInput) {
    weekInput.value = targetWeek;
    updateMultiPlanWeekRangeDisplay();
    generateStandardWeekRows();
  }
}

/** Xử lý khi người dùng đổi số tuần ở ô nhập liệu */
function handleMultiPlanWeekChange() {
  updateMultiPlanWeekRangeDisplay();
  // Tự động kiểm tra lại tất cả các dòng hiện có xem ngày có thuộc tuần mới không
  const rows = document.querySelectorAll('#multi-plan-table-body tr');
  rows.forEach(tr => {
    const dateInput = tr.querySelector('.mp-date');
    if (dateInput) validateMultiPlanRow(dateInput);
  });
  checkMultiPlanGlobalErrors();
}

/**
 * Thêm 1 dòng kế hoạch vào bảng với ô chọn ngày trên lịch
 */
function addMultiPlanRow(defaultDate = '', defaultJob = 'Tiến độ DP LCD', loc = '', qty = '', detail = '') {
  multiPlanRowCounter++;
  const rowId = `mp-row-${multiPlanRowCounter}`;
  const tbody = document.getElementById('multi-plan-table-body');

  const isoDate = toISODateString(defaultDate);
  const todayIso = toISODateString(new Date());

  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.className = 'hover:bg-sky-50/30 transition border-b border-slate-100';
  tr.innerHTML = `
    <td class="cell-center font-bold text-xs text-slate-400 mp-stt pt-3 align-top">1</td>
    
    <!-- Cột Ngày làm việc: Chọn ngày trên lịch + hiển thị thứ & cảnh báo -->
    <td class="p-2 align-top">
      <div class="space-y-1">
        <div class="relative flex items-center">
          <input type="date" 
                 class="mp-date w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none shadow-sm transition cursor-pointer" 
                 value="${escapeHtml(isoDate)}" 
                 min="${todayIso}"
                 onclick="try{ if(!this.value){ this.showPicker && this.showPicker(); } }catch(e){}"
                 onchange="validateMultiPlanRow(this)"
                 oninput="validateMultiPlanRow(this)">
        </div>
        <div class="mp-date-label text-[11px] font-semibold text-slate-500 flex items-center justify-between">
          <span class="lbl-weekday">--</span>
          <span class="lbl-week font-mono text-[10px] text-sky-700 bg-sky-50 px-1 rounded"></span>
        </div>
        <div class="mp-date-error hidden text-[11px] font-bold text-rose-600 flex items-start gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 mt-1">
          <i class="fa-solid fa-triangle-exclamation mt-0.5 text-rose-500 shrink-0"></i>
          <span class="err-text"></span>
        </div>
      </div>
    </td>

    <!-- Loại công việc -->
    <td class="p-2 align-top">
      <select class="mp-job w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none text-slate-700 shadow-sm">
        ${JOB_TYPES.map(j => `<option value="${escapeHtml(j)}" ${j === defaultJob ? 'selected' : ''}>${escapeHtml(j)}</option>`).join('')}
      </select>
    </td>

    <!-- Số lượng địa điểm -->
    <td class="p-2 align-top">
      <input type="number" class="mp-loc w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-center font-bold focus:ring-2 focus:ring-sky-500 outline-none text-sky-900 shadow-sm" placeholder="ĐĐ" value="${escapeHtml(loc)}">
    </td>

    <!-- Số lượng thiết bị / tấm -->
    <td class="p-2 align-top">
      <input type="text" class="mp-qty w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-center font-bold focus:ring-2 focus:ring-sky-500 outline-none text-sky-900 shadow-sm" placeholder="SL" value="${escapeHtml(qty)}">
    </td>

    <!-- Chi tiết nội dung -->
    <td class="p-2 align-top">
      <input type="text" class="mp-detail w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-sky-500 outline-none text-slate-700 shadow-sm" placeholder="Nội dung kế hoạch (tên chung cư, trường học, shop...)" value="${escapeHtml(detail)}">
    </td>

    <!-- Xóa dòng -->
    <td class="cell-center pt-2.5 align-top">
      <button type="button" onclick="removeMultiPlanRow('${rowId}')" class="text-rose-400 hover:text-rose-600 p-1.5 transition" title="Xóa dòng này">
        <i class="fa-solid fa-trash-can text-sm"></i>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  updateMultiPlanRowIndexes();

  // Kiểm tra tính hợp lệ ban đầu của dòng mới tạo
  const dateInput = tr.querySelector('.mp-date');
  if (dateInput) {
    validateMultiPlanRow(dateInput);
  }
}

function removeMultiPlanRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
    updateMultiPlanRowIndexes();
    checkMultiPlanGlobalErrors();
  }
}

function updateMultiPlanRowIndexes() {
  const rows = document.querySelectorAll('#multi-plan-table-body tr');
  rows.forEach((tr, idx) => {
    const sttCell = tr.querySelector('.mp-stt');
    if (sttCell) sttCell.textContent = idx + 1;
  });
  const status = document.getElementById('multi-plan-count-status');
  if (status) {
    status.textContent = `Đang có ${rows.length} đầu việc trong kế hoạch`;
  }
}

/**
 * Kiểm tra tính hợp lệ của ngày trong 1 dòng cụ thể:
 * Đổi màu viền đỏ, hiển thị icon & thông báo lỗi nếu ngày trong quá khứ hoặc sai tuần
 */
function validateMultiPlanRow(inputElem) {
  const tr = inputElem.closest('tr');
  if (!tr) return true;

  const rawDate = inputElem.value.trim();
  const weekVal = document.getElementById('multi-plan-week').value.trim();
  const targetWeek = weekVal ? parseInt(weekVal, 10) : undefined;

  const labelElem = tr.querySelector('.mp-date-label');
  const weekdaySpan = tr.querySelector('.lbl-weekday');
  const weekSpan = tr.querySelector('.lbl-week');
  const errorBox = tr.querySelector('.mp-date-error');
  const errText = tr.querySelector('.err-text');

  if (!rawDate) {
    inputElem.classList.add('border-rose-500', 'bg-rose-50/50', 'ring-1', 'ring-rose-500');
    inputElem.classList.remove('border-slate-300', 'bg-white');
    if (weekdaySpan) weekdaySpan.innerHTML = '<span class="text-rose-500 font-bold">Chưa chọn ngày trên lịch</span>';
    if (weekSpan) weekSpan.textContent = '';
    if (errorBox) {
      errorBox.classList.remove('hidden');
      if (errText) errText.textContent = 'Vui lòng chọn ngày làm việc trên lịch!';
    }
    checkMultiPlanGlobalErrors();
    return false;
  }

  const weekday = getWeekdayName(rawDate);
  const displayDate = toDisplayDateString(rawDate);
  const [y, m, d] = rawDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateWeek = getWeekNumber(dateObj);

  const res = validateWorkDate(rawDate, targetWeek);

  if (!res.valid) {
    // Có lỗi (Quá khứ hoặc sai tuần)
    inputElem.classList.add('border-rose-500', 'bg-rose-50/50', 'ring-1', 'ring-rose-500');
    inputElem.classList.remove('border-slate-300', 'bg-white');
    tr.classList.add('bg-rose-50/20');

    if (weekdaySpan) {
      weekdaySpan.innerHTML = `<span class="text-rose-600 font-bold">${weekday} (${displayDate})</span>`;
    }
    if (weekSpan) {
      weekSpan.className = 'font-mono text-[10px] text-rose-700 bg-rose-100 px-1 rounded font-bold';
      weekSpan.textContent = `Tuần ${dateWeek}`;
    }

    if (errorBox) {
      errorBox.classList.remove('hidden');
      if (errText) errText.textContent = res.message;
    }
    checkMultiPlanGlobalErrors();
    return false;
  } else {
    // Ngày hợp lệ
    inputElem.classList.remove('border-rose-500', 'bg-rose-50/50', 'ring-1', 'ring-rose-500');
    inputElem.classList.add('border-slate-300', 'bg-white');
    tr.classList.remove('bg-rose-50/20');

    if (weekdaySpan) {
      weekdaySpan.innerHTML = `<span class="text-emerald-700 font-bold"><i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i>${weekday} (${displayDate})</span>`;
    }
    if (weekSpan) {
      weekSpan.className = 'font-mono text-[10px] text-sky-700 bg-sky-50 px-1 rounded font-bold';
      weekSpan.textContent = `Tuần ${dateWeek}`;
    }

    if (errorBox) {
      errorBox.classList.add('hidden');
    }
    checkMultiPlanGlobalErrors();
    return true;
  }
}

/** Kiểm tra toàn bảng kế hoạch và hiển thị banner cảnh báo tổng hợp */
function checkMultiPlanGlobalErrors() {
  const rows = document.querySelectorAll('#multi-plan-table-body tr');
  const alertBox = document.getElementById('multi-plan-alert-box');
  const alertMsg = document.getElementById('multi-plan-alert-msg');
  if (!alertBox || !alertMsg) return;

  const weekVal = document.getElementById('multi-plan-week')?.value.trim();
  const targetWeek = weekVal ? parseInt(weekVal, 10) : undefined;

  let errorCount = 0;
  let hasPastError = false;
  let hasWeekError = false;

  rows.forEach(tr => {
    const dateInput = tr.querySelector('.mp-date');
    if (!dateInput) return;
    const val = dateInput.value.trim();
    if (!val) {
      errorCount++;
    } else {
      const res = validateWorkDate(val, targetWeek);
      if (!res.valid) {
        errorCount++;
        if (res.errorType === 'past' || res.errorType === 'past_and_wrong_week') hasPastError = true;
        if (res.errorType === 'wrong_week' || res.errorType === 'past_and_wrong_week') hasWeekError = true;
      }
    }
  });

  if (errorCount > 0) {
    alertBox.classList.remove('hidden');
    let detailMsg = '';
    if (hasPastError && hasWeekError) {
      detailMsg = 'Có ngày trong quá khứ và ngày không đúng tuần làm việc.';
    } else if (hasPastError) {
      detailMsg = 'Có ngày nằm trong quá khứ (không thể lên kế hoạch cho ngày đã qua).';
    } else if (hasWeekError) {
      detailMsg = `Có ngày không thuộc Tuần ${targetWeek}.`;
    } else {
      detailMsg = 'Chưa chọn đủ ngày trên lịch.';
    }
    alertMsg.textContent = `⚠️ Phát hiện ${errorCount} dòng có ngày không hợp lệ! ${detailMsg} Vui lòng sửa lại các dòng màu đỏ. Hệ thống sẽ không cho lưu nếu ngày bị sai.`;
  } else {
    alertBox.classList.add('hidden');
  }
}

/** Tự động sửa ngày sai bằng cách chuyển sang tuần sau hoặc tạo lại ngày */
function fixInvalidMultiPlanDates() {
  setMultiPlanWeek('next');
}

/**
 * Tự động sinh nhanh 6 ngày làm việc trong tuần (Thứ 2 đến Thứ 7)
 * Tính đúng các ngày trong tuần được chọn
 */
function generateStandardWeekRows() {
  const weekInput = document.getElementById('multi-plan-week');
  let targetWeek = parseInt(weekInput.value, 10);
  const today = new Date();
  if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 53) {
    targetWeek = getWeekNumber(today);
    weekInput.value = targetWeek;
  }

  const tbody = document.getElementById('multi-plan-table-body');
  tbody.innerHTML = '';
  multiPlanRowCounter = 0;

  const currentYear = today.getFullYear();
  const { monday } = getDateRangeOfWeek(targetWeek, currentYear);

  // Danh mục 6 công việc phổ biến trong tuần từ Thứ 2 đến Thứ 7
  const defaultSchedule = [
    { offset: 0, job: "Tiến độ DP LCD", detail: "Kế hoạch chạy chương trình Thứ Hai" },
    { offset: 1, job: "Tiến độ GP", detail: "Dán GP theo tuyến phân công" },
    { offset: 2, job: "Lắp đặt", detail: "Lắp đặt / Reno theo lịch" },
    { offset: 3, job: "Bảo trì", detail: "Bảo trì và kiểm tra hệ thống" },
    { offset: 4, job: "Hỗ trợ", detail: "Làm file, kiểm kho, họp tổng kết" },
    { offset: 5, job: "Tiến độ DP LCD", detail: "Chạy chương trình Thứ Bảy / Cuối tuần" }
  ];

  defaultSchedule.forEach(item => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + item.offset);
    const isoDate = toISODateString(d);
    addMultiPlanRow(isoDate, item.job, "", "", item.detail);
  });

  updateMultiPlanWeekRangeDisplay();
  checkMultiPlanGlobalErrors();
}

/**
 * LƯU TOÀN BỘ KẾ HOẠCH TUẦN (KIỂM TRA CHẶT CHẼ NGÀY BÁO CÁO TRƯỚC KHI LƯU)
 * Nếu ngày bị sai (trong quá khứ hoặc sai tuần) => Hiển thị cảnh báo & KHÔNG CHO LƯU
 */
function saveMultiPlanWeek() {
  const weekInput = document.getElementById('multi-plan-week');
  const week = weekInput.value.trim();
  if (!week) {
    alert("Vui lòng nhập số tuần làm việc (VD: 44)!");
    weekInput.focus();
    return;
  }
  const targetWeek = parseInt(week, 10);

  const user = appState.currentUser;
  const isEmp = user.role === 'employee';
  // Luôn khóa chính xác theo tên tài khoản đang đăng nhập
  const empName = isEmp ? user.fullName : (appState.currentEmployee || user.fullName);
  const empUser = appState.users.find(u => u.fullName === empName);
  const empPos = empUser ? empUser.position : (isEmp ? user.position : 'Nhân viên');

  const rows = document.querySelectorAll('#multi-plan-table-body tr');
  if (rows.length === 0) {
    alert("Vui lòng nhập ít nhất 1 đầu việc kế hoạch trong tuần!");
    return;
  }

  const errors = [];
  const validItems = [];
  let firstErrorRow = null;

  rows.forEach((tr, i) => {
    const stt = i + 1;
    const dateInput = tr.querySelector('.mp-date');
    const rawDate = dateInput?.value.trim();
    const jobType = tr.querySelector('.mp-job')?.value.trim();
    const planLoc = tr.querySelector('.mp-loc')?.value.trim();
    const planQty = tr.querySelector('.mp-qty')?.value.trim();
    const planDetail = tr.querySelector('.mp-detail')?.value.trim();

    // Bỏ qua nếu dòng hoàn toàn trống
    if (!rawDate && !planDetail && !planQty && !planLoc) return;

    // 1. Kiểm tra ngày chưa chọn
    if (!rawDate) {
      errors.push(`• Dòng ${stt}: Chưa chọn ngày làm việc trên lịch!`);
      if (dateInput) validateMultiPlanRow(dateInput);
      if (!firstErrorRow) firstErrorRow = tr;
      return;
    }

    // 2. Kiểm tra ngày trong quá khứ hoặc không đúng ngày trong tuần
    const validation = validateWorkDate(rawDate, targetWeek);
    if (!validation.valid) {
      errors.push(`• Dòng ${stt} (${toDisplayDateString(rawDate)}): ${validation.message}`);
      if (dateInput) validateMultiPlanRow(dateInput);
      if (!firstErrorRow) firstErrorRow = tr;
      return;
    }

    // Ngày hợp lệ => Lưu trữ theo định dạng chuẩn DD/MM/YYYY
    const displayDate = toDisplayDateString(rawDate);

    validItems.push({
      id: 'rep-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 4),
      week: String(targetWeek),
      date: displayDate,
      employeeName: empName, // Tự động gắn tên tài khoản đang đăng nhập
      position: empPos,
      jobType: jobType || 'Tiến độ DP LCD',
      planLocations: planLoc || '',
      planQuantity: planQty || '',
      planDetail: planDetail || '',
      actualLocations: '',
      actualQuantity: '',
      actualDetail: '',
      notes: '',
      completionRate: '',
      evaluation: ''
    });
  });

  // NẾU CÓ BẤT KỲ LỖI NGÀY NÀO => HIỂN THỊ CẢNH BÁO RÕ RÀNG VÀ KHÔNG CHO LƯU
  if (errors.length > 0) {
    const errorAlert = `⚠️ KHÔNG THỂ LƯU KẾ HOẠCH!\n\nPhát hiện ${errors.length} dòng có ngày làm việc bị sai:\n\n${errors.join('\n')}\n\n👉 Yêu cầu:\n1. Ngày làm việc phải từ hôm nay trở đi (không được là ngày trong quá khứ).\n2. Ngày làm việc phải đúng các ngày thuộc Tuần ${targetWeek}.\n\nVui lòng kiểm tra và sửa lại các dòng có ô màu đỏ trước khi lưu!`;
    alert(errorAlert);

    checkMultiPlanGlobalErrors();

    if (firstErrorRow) {
      firstErrorRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErrorRow.querySelector('.mp-date')?.focus();
    }
    return; // DỪNG LẠI, KHÔNG CHO LƯU
  }

  if (validItems.length === 0) {
    alert("Vui lòng nhập ít nhất 1 đầu việc kế hoạch trong tuần!");
    return;
  }

  // Thêm tất cả vào danh sách báo cáo
  appState.reports = [...validItems, ...appState.reports];
  saveData();
  populateDropdowns();
  renderApp();
  closeMultiPlanModal();
  showToast(`✅ Đã lưu thành công ${validItems.length} đầu việc vào kế hoạch Tuần ${targetWeek}!`, "success");

  alert(`🎉 Thành công!\n\nĐã lưu toàn bộ ${validItems.length} đầu việc cho Tuần ${targetWeek} của nhân viên "${empName}".\n\nHàng ngày, bạn chỉ cần bấm nút "Cập nhật thực tế" trên từng dòng để báo cáo kết quả!`);
}

function renderEmployeeView() {
  const user = appState.currentUser;
  const isEmployee = user.role === 'employee';

  // Nếu là nhân viên, tên cố định theo tài khoản đang đăng nhập
  const empName = isEmployee ? user.fullName : (appState.currentEmployee || user.fullName);
  const empRole = isEmployee ? user.position : 'Quản trị viên';

  // Hiển thị banner thông báo khi vào bằng Link Báo Cáo Riêng
  const directLinkBanner = document.getElementById('emp-direct-link-banner');
  const bannerName = document.getElementById('emp-banner-name');
  if (directLinkBanner) {
    if (appState.accessedViaDirectLink || isEmployee) {
      directLinkBanner.style.display = 'flex';
      if (bannerName) bannerName.textContent = empName;
    } else {
      directLinkBanner.style.display = 'none';
    }
  }

  // Hiển thị thanh chuyển nhân viên cho Admin khi xem Cổng Nhân viên
  const adminBanner = document.getElementById('admin-emp-switch-banner');
  const adminSelect = document.getElementById('admin-view-emp-select');
  if (adminBanner && adminSelect) {
    if (!isEmployee) {
      adminBanner.style.display = 'flex';
      const employeeUsers = appState.users.filter(u => u.role === 'employee' && u.status === 'active');
      adminSelect.innerHTML = employeeUsers.map(u => 
        `<option value="${escapeHtml(u.fullName)}" ${u.fullName === empName ? 'selected' : ''}>${escapeHtml(u.fullName)} (${escapeHtml(u.position)})</option>`
      ).join('');
    } else {
      adminBanner.style.display = 'none';
    }
  }

  document.getElementById('emp-portal-name').textContent = empName;
  document.getElementById('emp-portal-role').textContent = empRole;

  // Lọc chỉ các báo cáo của nhân viên này
  let myReports = appState.reports.filter(r => r.employeeName === empName);

  if (appState.empFilterWeek !== 'all') {
    myReports = myReports.filter(r => (r.week || '').toString() === appState.empFilterWeek);
  }

  // Thống kê cá nhân
  const myTotal = myReports.length;
  let doneCount = 0;
  let pendingCount = 0;
  let myTotalQty = 0;

  myReports.forEach(r => {
    const hasActual = (r.actualQuantity && r.actualQuantity.toString().trim() !== '') || 
                      (r.actualDetail && r.actualDetail.toString().trim() !== '');
    if (hasActual) {
      doneCount++;
      const aQty = parseInt(r.actualQuantity, 10);
      if (!isNaN(aQty)) myTotalQty += aQty;
    } else {
      pendingCount++;
    }
  });

  document.getElementById('emp-stat-total').textContent = myTotal;
  document.getElementById('emp-stat-done').textContent = doneCount;
  document.getElementById('emp-stat-pending').textContent = pendingCount;
  document.getElementById('emp-stat-qty').textContent = myTotalQty.toLocaleString('vi-VN');

  const countBadge = document.getElementById('emp-records-count');
  if (countBadge) {
    countBadge.textContent = `${myReports.length} đầu việc`;
  }

  // Render bảng danh sách công việc của Nhân viên (KHÔNG CÓ TỈ LỆ VÀ ĐÁNH GIÁ QUẢN LÝ)
  const tbody = document.getElementById('employee-table-body');
  if (myReports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-12 text-center text-slate-400">
          <i class="fa-regular fa-calendar-xmark text-4xl mb-3 text-slate-300 block"></i>
          Chưa có kế hoạch nào trong tuần này. Hãy bấm nút <strong>"1. Lập Kế Hoạch Tuần"</strong> ở trên để lên kế hoạch công việc!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = myReports.map((r, idx) => {
    const jobBadge = getJobBadgeHtml(r.jobType);
    const hasActual = (r.actualQuantity && r.actualQuantity.toString().trim() !== '') || 
                      (r.actualDetail && r.actualDetail.toString().trim() !== '');

    const statusBadge = hasActual 
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check"></i> Đã thực hiện</span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"><i class="fa-solid fa-clock"></i> Chờ thực tế</span>`;

    const actualLocHtml = (r.actualLocations && r.actualLocations.toString().trim() !== '') 
      ? escapeHtml(r.actualLocations) 
      : '<span class="text-slate-400">-</span>';

    const actualQtyHtml = (r.actualQuantity && r.actualQuantity.toString().trim() !== '') 
      ? escapeHtml(r.actualQuantity) 
      : '<span class="text-slate-400">-</span>';

    const actualDetailHtml = (r.actualDetail && r.actualDetail.toString().trim() !== '') 
      ? escapeHtml(r.actualDetail) 
      : '<span class="text-slate-400 italic text-xs">Chưa cập nhật thực tế</span>';

    return `
      <tr class="transition hover:bg-slate-50/80 ${hasActual ? '' : 'bg-amber-50/20'}" data-id="${r.id}">
        <td class="cell-center text-xs font-semibold text-slate-400">${idx + 1}</td>
        <td class="cell-center font-bold text-blue-900">${escapeHtml(r.week || '-')}</td>
        <td class="font-medium text-slate-800 whitespace-nowrap">${escapeHtml(r.date || '-')}</td>
        <td class="cell-job">${jobBadge}</td>
        
        <!-- Nhóm Kế hoạch dự kiến tuần -->
        <td class="cell-center bg-sky-50/50 text-sky-900 font-semibold">${escapeHtml(r.planLocations || '-')}</td>
        <td class="cell-center bg-sky-50/50 text-sky-900 font-bold">${escapeHtml(r.planQuantity || '-')}</td>
        <td class="cell-detail-large bg-sky-50/30 text-slate-700 font-medium">${escapeHtml(r.planDetail || '-')}</td>

        <!-- Nhóm Tiến độ thực tế ngày -->
        <td class="cell-center bg-emerald-50/50 text-emerald-900 font-semibold">${actualLocHtml}</td>
        <td class="cell-center bg-emerald-50/50 text-emerald-900 font-bold">${actualQtyHtml}</td>
        <td class="cell-detail-large bg-emerald-50/30 text-slate-700 font-medium">${actualDetailHtml}</td>

        <!-- Ghi chú sự cố -->
        <td class="cell-multiline text-xs text-amber-900 bg-amber-50/30">${escapeHtml(r.notes || '')}</td>

        <!-- Trạng thái cập nhật -->
        <td class="cell-center whitespace-nowrap">${statusBadge}</td>

        <!-- Thao tác: Cập nhật thực tế ngày / Sửa kế hoạch / Xóa -->
        <td class="cell-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="openUpdateActualModal('${r.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-sm" title="Cập nhật tiến độ thực tế ngày">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>${hasActual ? 'Sửa thực tế' : 'Cập nhật'}</span>
            </button>
            <button onclick="editReport('${r.id}')" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Sửa toàn bộ kế hoạch">
              <i class="fa-solid fa-gear"></i>
            </button>
            <button onclick="deleteReport('${r.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition" title="Xóa">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  setTimeout(initTableColumnResizers, 50);
}

function filterEmployeeWeek(weekVal) {
  appState.empFilterWeek = weekVal;
  renderEmployeeView();
}

function openPlanModal() {
  openReportModal(null, 'plan_only');
}

function openUpdateActualModal(reportId) {
  appState.updatingReportId = reportId;
  const rep = appState.reports.find(r => r.id === reportId);
  if (!rep) return;

  document.getElementById('update-modal-sub').textContent = 
    `Nhân viên: ${rep.employeeName} • Tuần ${rep.week || '-'} • Ngày: ${rep.date || '-'} • Công việc: ${rep.jobType}`;

  document.getElementById('update-plan-summary').textContent = 
    `Kế hoạch: ${rep.planLocations || 0} Địa điểm / ${rep.planQuantity || 0} SL`;

  document.getElementById('update-plan-detail-view').textContent = 
    rep.planDetail || '(Không có chi tiết kế hoạch)';

  document.getElementById('update-actual-loc').value = rep.actualLocations || '';
  document.getElementById('update-actual-qty').value = rep.actualQuantity || '';
  document.getElementById('update-actual-detail').value = rep.actualDetail || '';
  document.getElementById('update-notes').value = rep.notes || '';

  if (!rep.actualLocations && !rep.actualQuantity) {
    document.getElementById('update-actual-loc').value = rep.planLocations || '';
    document.getElementById('update-actual-qty').value = rep.planQuantity || '';
    document.getElementById('update-actual-detail').value = rep.planDetail || '';
  }

  document.getElementById('update-actual-modal').classList.remove('hidden');
}

function closeUpdateActualModal() {
  document.getElementById('update-actual-modal').classList.add('hidden');
  appState.updatingReportId = null;
}

function copyPlanToModalActual() {
  const rep = appState.reports.find(r => r.id === appState.updatingReportId);
  if (!rep) return;
  document.getElementById('update-actual-loc').value = rep.planLocations || '';
  document.getElementById('update-actual-qty').value = rep.planQuantity || '';
  document.getElementById('update-actual-detail').value = rep.planDetail || '';
}

function saveActualProgressOnly() {
  if (!appState.updatingReportId) return;

  const actualLocations = document.getElementById('update-actual-loc').value.trim();
  const actualQuantity = document.getElementById('update-actual-qty').value.trim();
  const actualDetail = document.getElementById('update-actual-detail').value.trim();
  const notes = document.getElementById('update-notes').value.trim();

  const idx = appState.reports.findIndex(r => r.id === appState.updatingReportId);
  if (idx !== -1) {
    const rep = appState.reports[idx];
    rep.actualLocations = actualLocations;
    rep.actualQuantity = actualQuantity;
    rep.actualDetail = actualDetail;
    rep.notes = notes;

    const planQ = parseFloat(rep.planQuantity);
    const actQ = parseFloat(actualQuantity);
    if (!isNaN(planQ) && planQ > 0 && !isNaN(actQ)) {
      rep.completionRate = ((actQ / planQ) * 100).toFixed(1);
    } else if (actualQuantity === '' && actualDetail === '') {
      rep.completionRate = '';
    }

    saveData();
    renderApp();
    closeUpdateActualModal();
    showToast("✅ Đã cập nhật tiến độ thực tế thành công!", "success");
  }
}

/**
 * ========================================================
 * 7. FORM TẠO MỚI / CHỈNH SỬA TOÀN DIỆN
 * ========================================================
 */
function openReportModal(reportId = null, mode = 'full') {
  appState.editingReportId = reportId;
  const modal = document.getElementById('report-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('report-form');
  const actualBox = document.getElementById('form-actual-box');
  const evalGroup = document.getElementById('form-eval-group');

  form.reset();

  const user = appState.currentUser;
  const isAdmin = user.role === 'admin';
  evalGroup.style.display = isAdmin ? 'block' : 'none';

  // Khóa tên nhân viên nếu là tài khoản nhân viên
  const nameInput = document.getElementById('form-employee-name');
  const posInput = document.getElementById('form-position');

  if (!isAdmin) {
    nameInput.value = user.fullName;
    nameInput.readOnly = true;
    nameInput.classList.add('bg-slate-200');
    posInput.value = user.position;
    posInput.readOnly = true;
    posInput.classList.add('bg-slate-200');
  } else {
    nameInput.readOnly = false;
    nameInput.classList.remove('bg-slate-200');
    posInput.readOnly = false;
    posInput.classList.remove('bg-slate-200');
  }

  if (reportId) {
    title.innerHTML = '<i class="fa-solid fa-pen-to-square text-blue-600 mr-2"></i>Chỉnh sửa thông tin công việc';
    actualBox.style.display = 'block';

    const rep = appState.reports.find(r => r.id === reportId);
    if (rep) {
      document.getElementById('form-week').value = rep.week || '';
      document.getElementById('form-date').value = toISODateString(rep.date || '');
      document.getElementById('form-employee-name').value = rep.employeeName || '';
      document.getElementById('form-position').value = rep.position || '';
      document.getElementById('form-job-type').value = rep.jobType || 'Tiến độ DP LCD';
      document.getElementById('form-plan-loc').value = rep.planLocations || '';
      document.getElementById('form-plan-qty').value = rep.planQuantity || '';
      document.getElementById('form-plan-detail').value = rep.planDetail || '';
      document.getElementById('form-actual-loc').value = rep.actualLocations || '';
      document.getElementById('form-actual-qty').value = rep.actualQuantity || '';
      document.getElementById('form-actual-detail').value = rep.actualDetail || '';
      document.getElementById('form-completion-rate').value = rep.completionRate || '';
      document.getElementById('form-notes').value = rep.notes || '';
      document.getElementById('form-evaluation').value = rep.evaluation || '';

      handleFormDateChange(document.getElementById('form-date').value);
    }
  } else {
    const today = new Date();
    document.getElementById('form-date').value = toISODateString(today);
    const weekNum = getWeekNumber(today);
    document.getElementById('form-week').value = weekNum;

    handleFormDateChange(document.getElementById('form-date').value);

    if (mode === 'plan_only') {
      title.innerHTML = '<i class="fa-solid fa-calendar-plus text-sky-600 mr-2"></i>Lập Kế Hoạch Dự Kiến Tuần Mới';
      actualBox.style.display = 'none';
    } else {
      title.innerHTML = '<i class="fa-solid fa-plus-circle text-emerald-600 mr-2"></i>Tạo Báo Cáo Công Việc';
      actualBox.style.display = 'block';
    }
  }

  modal.classList.remove('hidden');
}

/** Xử lý sự kiện khi chọn ngày trên lịch trong form tạo/sửa báo cáo */
function handleFormDateChange(val) {
  const statusElem = document.getElementById('form-date-status');
  const dateInput = document.getElementById('form-date');
  const weekInput = document.getElementById('form-week');
  if (!statusElem || !dateInput) return;

  if (!val) {
    statusElem.innerHTML = '<span class="text-rose-500 font-bold">⚠️ Vui lòng chọn ngày làm việc trên lịch</span>';
    dateInput.classList.add('border-rose-500', 'bg-rose-50/50');
    return;
  }

  const weekday = getWeekdayName(val);
  const displayDate = toDisplayDateString(val);
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const week = getWeekNumber(dt);

  // Tự động gán số tuần theo ngày nếu chưa có hoặc đang tạo mới
  if (weekInput && (!weekInput.value || !appState.editingReportId)) {
    weekInput.value = week;
  }

  const currentTargetWeek = weekInput ? parseInt(weekInput.value, 10) : week;
  const validation = validateWorkDate(val, currentTargetWeek);

  if (!validation.valid) {
    dateInput.classList.add('border-rose-500', 'bg-rose-50/50', 'ring-1', 'ring-rose-500');
    dateInput.classList.remove('border-slate-300', 'bg-white');
    statusElem.innerHTML = `
      <span class="text-rose-600 font-bold flex items-center gap-1">
        <i class="fa-solid fa-triangle-exclamation"></i>
        ${weekday} (${displayDate}): ${validation.message}
      </span>
    `;
  } else {
    dateInput.classList.remove('border-rose-500', 'bg-rose-50/50', 'ring-1', 'ring-rose-500');
    dateInput.classList.add('border-slate-300', 'bg-white');
    statusElem.innerHTML = `
      <span class="text-emerald-700 font-semibold flex items-center gap-1">
        <i class="fa-solid fa-circle-check text-emerald-500"></i>
        ${weekday}, ngày ${displayDate} (Thuộc Tuần ${week})
      </span>
    `;
  }
}

function closeReportModal() {
  document.getElementById('report-modal').classList.add('hidden');
  appState.editingReportId = null;
}

function copyPlanToActual() {
  document.getElementById('form-actual-loc').value = document.getElementById('form-plan-loc').value;
  document.getElementById('form-actual-qty').value = document.getElementById('form-plan-qty').value;
  document.getElementById('form-actual-detail').value = document.getElementById('form-plan-detail').value;
}

function handleSaveReport(e) {
  e.preventDefault();

  const user = appState.currentUser;
  const isAdmin = user && user.role === 'admin';

  const week = document.getElementById('form-week').value.trim();
  const rawDate = document.getElementById('form-date').value.trim();

  // Kiểm tra ngày làm việc bắt buộc chọn trên lịch
  if (!rawDate) {
    alert("Vui lòng chọn ngày làm việc trên lịch!");
    document.getElementById('form-date').focus();
    return;
  }

  const targetWeek = week ? parseInt(week, 10) : undefined;
  const validation = validateWorkDate(rawDate, targetWeek);

  // NẾU NGÀY BỊ SAI (NGÀY TRONG QUÁ KHỨ HOẶC SAI TUẦN) => BÁO LỖI VÀ KHÔNG CHO LƯU
  if (!validation.valid) {
    alert(`⚠️ KHÔNG THỂ LƯU CÔNG VIỆC!\n\n${validation.message}\n\n👉 Yêu cầu:\n1. Ngày làm việc phải từ hôm nay trở đi (không được là ngày trong quá khứ).\n2. Ngày làm việc phải đúng các ngày thuộc Tuần ${targetWeek}.\n\nVui lòng chọn lại ngày trên lịch!`);
    document.getElementById('form-date').focus();
    return;
  }

  const date = toDisplayDateString(rawDate);

  // Nếu là nhân viên, tự động gắn cố định tên tài khoản đang đăng nhập
  const employeeName = (!isAdmin && user) ? user.fullName : document.getElementById('form-employee-name').value.trim();
  const position = (!isAdmin && user) ? user.position : document.getElementById('form-position').value.trim();
  const jobType = document.getElementById('form-job-type').value.trim();
  const planLocations = document.getElementById('form-plan-loc').value.trim();
  const planQuantity = document.getElementById('form-plan-qty').value.trim();
  const planDetail = document.getElementById('form-plan-detail').value.trim();
  const actualLocations = document.getElementById('form-actual-loc').value.trim();
  const actualQuantity = document.getElementById('form-actual-qty').value.trim();
  const actualDetail = document.getElementById('form-actual-detail').value.trim();
  const notes = document.getElementById('form-notes').value.trim();
  const evaluation = document.getElementById('form-evaluation').value.trim();

  if (!employeeName) {
    alert("Vui lòng nhập hoặc chọn Họ tên nhân viên!");
    return;
  }

  let completionRate = '';
  const pQ = parseFloat(planQuantity);
  const aQ = parseFloat(actualQuantity);
  if (!isNaN(pQ) && pQ > 0 && !isNaN(aQ)) {
    completionRate = ((aQ / pQ) * 100).toFixed(1);
  }

  if (appState.editingReportId) {
    const idx = appState.reports.findIndex(r => r.id === appState.editingReportId);
    if (idx !== -1) {
      appState.reports[idx] = {
        ...appState.reports[idx],
        week, date, employeeName, position, jobType,
        planLocations, planQuantity, planDetail,
        actualLocations, actualQuantity, actualDetail,
        notes, completionRate, evaluation
      };
    }
  } else {
    const newReport = {
      id: 'rep-' + Date.now(),
      week, date, employeeName, position, jobType,
      planLocations, planQuantity, planDetail,
      actualLocations, actualQuantity, actualDetail,
      notes, completionRate, evaluation
    };
    appState.reports.unshift(newReport);
  }

  saveData();
  populateDropdowns();
  closeReportModal();
  renderApp();
}

function deleteReport(reportId) {
  const rep = appState.reports.find(r => r.id === reportId);
  const confirmMsg = rep 
    ? `Bạn có chắc chắn muốn xóa đầu việc "${rep.jobType}" (${rep.date}) của ${rep.employeeName}?`
    : "Bạn có chắc chắn muốn xóa mục này?";

  if (confirm(confirmMsg)) {
    appState.reports = appState.reports.filter(r => r.id !== reportId);
    saveData();
    populateDropdowns();
    renderApp();
  }
}

function editReport(reportId) {
  openReportModal(reportId, 'full');
}

/**
 * ========================================================
 * 8. PHÂN HỆ QUẢN LÝ TỔNG HỢP (DÀNH CHO ADMIN)
 * ========================================================
 */
function renderManagerView() {
  const filtered = getFilteredReports();
  renderManagerKPIs(filtered);
  renderManagerTable(filtered);
  renderCharts(filtered);
}

function getFilteredReports() {
  return appState.reports.filter(r => {
    if (appState.filters.week !== 'all' && (r.week || '').toString() !== appState.filters.week) {
      return false;
    }
    if (appState.filters.employee !== 'all' && r.employeeName !== appState.filters.employee) {
      return false;
    }
    if (appState.filters.jobType !== 'all') {
      const job = (r.jobType || '').trim().toLowerCase();
      const filterJob = appState.filters.jobType.trim().toLowerCase();
      if (!job.includes(filterJob) && !filterJob.includes(job)) {
        return false;
      }
    }
    if (appState.filters.rateStatus !== 'all') {
      const rate = parseFloat(r.completionRate);
      if (appState.filters.rateStatus === 'complete' && (isNaN(rate) || rate < 100)) return false;
      if (appState.filters.rateStatus === 'partial' && (isNaN(rate) || rate < 50 || rate >= 100)) return false;
      if (appState.filters.rateStatus === 'low' && (isNaN(rate) || rate <= 0 || rate >= 50)) return false;
      if (appState.filters.rateStatus === 'zero' && (rate > 0 || (r.completionRate === '' && !r.notes))) return false;
    }
    if (appState.filters.search) {
      const term = appState.filters.search.toLowerCase();
      const haystack = [
        r.employeeName,
        r.position,
        r.jobType,
        r.planDetail,
        r.actualDetail,
        r.notes,
        r.date,
        r.week,
        r.evaluation
      ].filter(Boolean).join(' ').toLowerCase();

      if (!haystack.includes(term)) {
        return false;
      }
    }
    return true;
  });
}

function renderManagerKPIs(reports) {
  const totalReports = reports.length;
  const uniqueEmps = new Set(reports.map(r => r.employeeName).filter(Boolean)).size;

  let sumRate = 0;
  let countRate = 0;
  let totalPlanLoc = 0;
  let totalActualLoc = 0;
  let totalPlanQty = 0;
  let totalActualQty = 0;

  reports.forEach(r => {
    const rate = parseFloat(r.completionRate);
    if (!isNaN(rate)) {
      sumRate += rate;
      countRate++;
    }
    const pLoc = parseInt(r.planLocations, 10);
    if (!isNaN(pLoc)) totalPlanLoc += pLoc;

    const aLoc = parseInt(r.actualLocations, 10);
    if (!isNaN(aLoc)) totalActualLoc += aLoc;

    const pQty = parseInt(r.planQuantity, 10);
    if (!isNaN(pQty)) totalPlanQty += pQty;

    const aQty = parseInt(r.actualQuantity, 10);
    if (!isNaN(aQty)) totalActualQty += aQty;
  });

  const avgRate = countRate > 0 ? (sumRate / countRate).toFixed(1) : 0;

  document.getElementById('kpi-total-reports').textContent = totalReports.toLocaleString('vi-VN');
  document.getElementById('kpi-total-employees').textContent = uniqueEmps;
  document.getElementById('kpi-avg-rate').textContent = `${avgRate}%`;
  document.getElementById('kpi-locations-stat').textContent = `${totalActualLoc.toLocaleString('vi-VN')} / ${totalPlanLoc.toLocaleString('vi-VN')}`;
  document.getElementById('kpi-quantity-stat').textContent = `${totalActualQty.toLocaleString('vi-VN')} / ${totalPlanQty.toLocaleString('vi-VN')}`;

  const avgBadge = document.getElementById('kpi-avg-rate');
  if (avgRate >= 95) {
    avgBadge.className = 'text-2xl font-bold text-emerald-600';
  } else if (avgRate >= 80) {
    avgBadge.className = 'text-2xl font-bold text-amber-500';
  } else {
    avgBadge.className = 'text-2xl font-bold text-rose-600';
  }
}

function renderManagerTable(reports) {
  const tbody = document.getElementById('manager-table-body');
  const countBadge = document.getElementById('table-records-count');
  if (countBadge) {
    countBadge.textContent = `${reports.length} báo cáo`;
  }

  if (reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="15" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-inbox text-4xl mb-3 text-slate-300 block"></i>
          Không tìm thấy dữ liệu báo cáo nào phù hợp với bộ lọc hiện tại.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reports.map((r, idx) => {
    const rateBadgeHtml = getRateBadgeHtml(r.completionRate);
    const jobBadgeHtml = getJobBadgeHtml(r.jobType);
    const evalText = r.evaluation ? escapeHtml(r.evaluation) : '<span class="text-slate-400 italic text-xs">+ Nhập đánh giá</span>';

    return `
      <tr class="transition hover:bg-blue-50/40" data-id="${r.id}">
        <td class="cell-center font-medium text-slate-500 text-xs">${idx + 1}</td>
        <td class="cell-center font-bold text-blue-900 text-xs">${escapeHtml(r.week || '-')}</td>
        <td class="font-medium text-slate-700 whitespace-nowrap cell-center text-xs">${escapeHtml(r.date || '-')}</td>
        <td class="cell-emp">
          <div class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold uppercase shrink-0">
              ${(r.employeeName || '?').charAt(0)}
            </span>
            <span class="whitespace-nowrap font-semibold text-slate-900 text-xs">${escapeHtml(r.employeeName || '-')}</span>
          </div>
        </td>
        <td class="text-xs text-slate-600 whitespace-nowrap cell-center px-2.5">${escapeHtml(r.position || '-')}</td>
        <td class="cell-job">${jobBadgeHtml}</td>
        
        <td class="cell-center font-semibold bg-sky-50/50 text-sky-800 text-xs">${escapeHtml(r.planLocations || '-')}</td>
        <td class="cell-center font-bold bg-sky-50/50 text-sky-900 text-xs">${escapeHtml(r.planQuantity || '-')}</td>
        <td class="cell-detail-large bg-sky-50/30 text-slate-700 font-medium">${escapeHtml(r.planDetail || '-')}</td>

        <td class="cell-center font-semibold bg-emerald-50/50 text-emerald-800 text-xs">${escapeHtml(r.actualLocations || '-')}</td>
        <td class="cell-center font-bold bg-emerald-50/50 text-emerald-900 text-xs">${escapeHtml(r.actualQuantity || '-')}</td>
        <td class="cell-detail-large bg-emerald-50/30 text-slate-700 font-medium">${(r.actualDetail && r.actualDetail.trim() !== '') ? escapeHtml(r.actualDetail) : '<span class="text-slate-400 italic text-xs">-</span>'}</td>

        <td class="cell-multiline text-amber-900 bg-amber-50/30">${escapeHtml(r.notes || '')}</td>
        <td class="cell-center whitespace-nowrap">${rateBadgeHtml}</td>

        <td class="eval-input-wrap">
          <button onclick="openEvaluationModal('${r.id}')" class="eval-cell-btn text-left" title="Bấm để đánh giá báo cáo này">
            <span class="whitespace-nowrap text-xs">${evalText}</span>
            <i class="fa-solid fa-pen text-slate-400 text-xs ml-1 flex-shrink-0"></i>
          </button>
        </td>

        <td class="cell-center whitespace-nowrap no-print">
          <div class="flex items-center justify-center gap-1">
            <button onclick="editReport('${r.id}')" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition" title="Chỉnh sửa">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button onclick="deleteReport('${r.id}')" class="p-1.5 text-rose-500 hover:bg-rose-100 rounded transition" title="Xóa">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  setTimeout(initTableColumnResizers, 50);
}

function getRateBadgeHtml(rate) {
  if (rate === '' || rate === null || rate === undefined) {
    return `<span class="text-slate-400 text-xs">-</span>`;
  }
  const num = parseFloat(rate);
  if (isNaN(num)) {
    return `<span class="rate-badge rate-zero">${escapeHtml(rate)}</span>`;
  }
  if (num >= 100) {
    return `<span class="rate-badge rate-high"><i class="fa-solid fa-check"></i> ${num}%</span>`;
  } else if (num >= 80) {
    return `<span class="rate-badge rate-mid"><i class="fa-solid fa-clock"></i> ${num}%</span>`;
  } else if (num > 0) {
    return `<span class="rate-badge rate-low"><i class="fa-solid fa-triangle-exclamation"></i> ${num}%</span>`;
  } else {
    return `<span class="rate-badge rate-zero"><i class="fa-solid fa-xmark"></i> 0%</span>`;
  }
}

function getJobBadgeHtml(job) {
  if (!job) return `<span class="badge-job badge-default">Khác</span>`;
  const j = job.trim();
  const lower = j.toLowerCase();

  let cls = 'badge-default';
  let icon = 'fa-briefcase';

  if (lower.includes('dp lcd') || lower.includes('lcd')) {
    cls = 'badge-dp-lcd';
    icon = 'fa-tv';
  } else if (lower.includes('tháo gp')) {
    cls = 'badge-thao-gp';
    icon = 'fa-scissors';
  } else if (lower.includes('tiến độ gp') || lower.includes('dán gp') || lower.includes('tiến đô gp')) {
    cls = 'badge-gp';
    icon = 'fa-scroll';
  } else if (lower.includes('lắp đặt')) {
    cls = 'badge-lap-dat';
    icon = 'fa-wrench';
  } else if (lower.includes('bảo trì')) {
    cls = 'badge-bao-tri';
    icon = 'fa-screwdriver-wrench';
  } else if (lower.includes('hỗ trợ')) {
    cls = 'badge-ho-tro';
    icon = 'fa-handshake-angle';
  } else if (lower.includes('làm file') || lower.includes('sort')) {
    cls = 'badge-lam-file';
    icon = 'fa-file-lines';
  } else if (lower.includes('nghỉ')) {
    cls = 'badge-nghi';
    icon = 'fa-bed';
  }

  return `<span class="badge-job ${cls}"><i class="fa-solid ${icon} mr-1 text-[10px]"></i>${escapeHtml(j)}</span>`;
}

function renderCharts(reports) {
  if (typeof Chart === 'undefined') return;

  const empMap = {};
  reports.forEach(r => {
    if (!r.employeeName) return;
    const name = r.employeeName;
    if (!empMap[name]) {
      empMap[name] = { total: 0, count: 0 };
    }
    const rate = parseFloat(r.completionRate);
    if (!isNaN(rate)) {
      empMap[name].total += rate;
      empMap[name].count++;
    }
  });

  const empLabels = Object.keys(empMap).slice(0, 10);
  const empData = empLabels.map(name => {
    const item = empMap[name];
    return item.count > 0 ? Math.round(item.total / item.count) : 0;
  });

  const ctxEmp = document.getElementById('chart-employee-rate');
  if (ctxEmp) {
    if (appState.charts.empChart) appState.charts.empChart.destroy();
    appState.charts.empChart = new Chart(ctxEmp, {
      type: 'bar',
      data: {
        labels: empLabels,
        datasets: [{
          label: 'Tỉ lệ hoàn thành TB (%)',
          data: empData,
          backgroundColor: empData.map(v => v >= 95 ? '#10b981' : v >= 80 ? '#f59e0b' : '#ef4444'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 120, ticks: { callback: v => v + '%' } } }
      }
    });
  }

  const jobMap = {};
  reports.forEach(r => {
    let job = (r.jobType || 'Khác').trim();
    if (job.toLowerCase().includes('dp lcd')) job = 'Tiến độ DP LCD';
    else if (job.toLowerCase().includes('tháo gp')) job = 'Tháo GP';
    else if (job.toLowerCase().includes('gp')) job = 'Dán GP';
    else if (job.toLowerCase().includes('lắp đặt')) job = 'Lắp đặt';
    else if (job.toLowerCase().includes('bảo trì')) job = 'Bảo trì';
    else if (job.toLowerCase().includes('hỗ trợ')) job = 'Hỗ trợ';
    else if (job.toLowerCase().includes('nghỉ')) job = 'Nghỉ';

    jobMap[job] = (jobMap[job] || 0) + 1;
  });

  const jobLabels = Object.keys(jobMap);
  const jobData = jobLabels.map(k => jobMap[k]);

  const ctxJob = document.getElementById('chart-job-distribution');
  if (ctxJob) {
    if (appState.charts.jobChart) appState.charts.jobChart.destroy();
    appState.charts.jobChart = new Chart(ctxJob, {
      type: 'doughnut',
      data: {
        labels: jobLabels,
        datasets: [{
          data: jobData,
          backgroundColor: [
            '#8b5cf6', '#3b82f6', '#f97316', '#ef4444', '#10b981', '#06b6d4', '#94a3b8', '#ec4899'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
      }
    });
  }
}

let evalTargetReportId = null;

function openEvaluationModal(reportId) {
  evalTargetReportId = reportId;
  const rep = appState.reports.find(r => r.id === reportId);
  if (!rep) return;

  document.getElementById('eval-emp-name').textContent = rep.employeeName;
  document.getElementById('eval-report-info').textContent = `Tuần ${rep.week || '-'} • Ngày ${rep.date} • ${rep.jobType}`;
  document.getElementById('eval-report-progress').textContent = `Kế hoạch: ${rep.planQuantity || 0} -> Thực tế: ${rep.actualQuantity || 0}`;
  document.getElementById('eval-comment-input').value = rep.evaluation || '';

  document.getElementById('eval-modal').classList.remove('hidden');
}

function closeEvaluationModal() {
  document.getElementById('eval-modal').classList.add('hidden');
  evalTargetReportId = null;
}

function setQuickEval(text) {
  document.getElementById('eval-comment-input').value = text;
}

function saveEvaluation() {
  if (!evalTargetReportId) return;
  const comment = document.getElementById('eval-comment-input').value.trim();

  const rep = appState.reports.find(r => r.id === evalTargetReportId);
  if (rep) {
    rep.evaluation = comment;
    saveData();
    renderApp();
  }
  closeEvaluationModal();
}

/**
 * ========================================================
 * 9. XUẤT VÀ NHẬP DỮ LIỆU EXCEL / CSV & XÓA TOÀN BỘ
 * ========================================================
 */
async function exportToExcel() {
  const reports = getFilteredReports();
  if (reports.length === 0) {
    alert("Không có dữ liệu báo cáo nào để xuất!");
    return;
  }

  // 1. Sử dụng thư viện ExcelJS để xuất định dạng chuẩn có kẻ ô, màu sắc, highlight theo ảnh mẫu
  if (typeof ExcelJS !== 'undefined') {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Hệ Thống Báo Cáo Công Việc';
      workbook.lastModifiedBy = appState.currentUser ? appState.currentUser.fullName : 'Admin';
      workbook.created = new Date();
      workbook.modified = new Date();

      const ws = workbook.addWorksheet('Báo Cáo Tiến Độ', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 2, showGridLines: true }]
      });

      // Độ rộng các cột
      ws.columns = [
        { key: 'stt', width: 6 },            // A
        { key: 'week', width: 10 },           // B
        { key: 'date', width: 14 },           // C
        { key: 'employeeName', width: 18 },   // D (nhỏ gọn)
        { key: 'position', width: 14 },       // E
        { key: 'jobType', width: 16 },        // F (nhỏ gọn: Công việc)
        { key: 'planLoc', width: 12 },        // G
        { key: 'planQty', width: 11 },        // H
        { key: 'planDetail', width: 45 },     // I (rộng hơn)
        { key: 'actualLoc', width: 12 },      // J
        { key: 'actualQty', width: 11 },      // K
        { key: 'actualDetail', width: 45 },   // L (rộng hơn)
        { key: 'notes', width: 25 },          // M
        { key: 'completionRate', width: 16 }, // N
        { key: 'evaluation', width: 22 }      // O
      ];

      // Dòng Header 1
      const row1 = ws.addRow([
        'STT',
        'TUẦN',
        'NGÀY',
        'HỌ TÊN',
        'CHỨC VỤ',
        'CÔNG VIỆC',
        'KẾ HOẠCH DỰ KIẾN', '', '',
        'TIẾN ĐỘ THỰC TẾ', '', '',
        'GHI CHÚ & LÝ DO',
        'TỈ LỆ HOÀN THÀNH',
        'ĐÁNH GIÁ CỦA QUẢN LÝ'
      ]);

      // Dòng Header 2
      const row2 = ws.addRow([
        '',
        '',
        '',
        '',
        '',
        '',
        'SL ĐĐ', 'Số lượng', 'Chi tiết',
        'SL ĐĐ', 'Số lượng', 'Chi tiết',
        '',
        '',
        ''
      ]);

      row1.height = 28;
      row2.height = 24;

      // Merge các ô tiêu đề
      ws.mergeCells('A1:A2');
      ws.mergeCells('B1:B2');
      ws.mergeCells('C1:C2');
      ws.mergeCells('D1:D2');
      ws.mergeCells('E1:E2');
      ws.mergeCells('F1:F2');
      ws.mergeCells('G1:I1'); // Kế hoạch dự kiến
      ws.mergeCells('J1:L1'); // Tiến độ thực tế
      ws.mergeCells('M1:M2');
      ws.mergeCells('N1:N2');
      ws.mergeCells('O1:O2');

      const borderThinSlate = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      // Áp dụng định dạng và màu sắc cho 2 hàng tiêu đề
      for (let r = 1; r <= 2; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= 15; c++) {
          const cell = row.getCell(c);
          cell.border = borderThinSlate;

          // Tiêu đề các cột chung (A, B, C, D, E, F, M, N, O)
          if (c <= 6 || c >= 13) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' }
            };
            cell.font = {
              name: 'Segoe UI',
              size: 10,
              bold: true,
              color: { argb: 'FF1E293B' }
            };
            cell.alignment = {
              horizontal: 'center',
              vertical: 'middle',
              wrapText: true
            };
          }
          // Nhóm tiêu đề Kế hoạch dự kiến (Cột 7, 8, 9 - Xanh lam Pastel)
          else if (c >= 7 && c <= 9) {
            if (r === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0F2FE' }
              };
              cell.font = {
                name: 'Segoe UI',
                size: 11,
                bold: true,
                color: { argb: 'FF0369A1' }
              };
              cell.border = {
                top: { style: 'medium', color: { argb: 'FF38BDF8' } },
                left: { style: 'thin', color: { argb: 'FF38BDF8' } },
                bottom: { style: 'thin', color: { argb: 'FF38BDF8' } },
                right: { style: 'thin', color: { argb: 'FF38BDF8' } }
              };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F9FF' }
              };
              cell.font = {
                name: 'Segoe UI',
                size: 9.5,
                bold: true,
                color: { argb: 'FF0284C7' }
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFBAE6FD' } },
                left: { style: 'thin', color: { argb: 'FFBAE6FD' } },
                bottom: { style: 'medium', color: { argb: 'FF0284C7' } },
                right: { style: 'thin', color: { argb: 'FFBAE6FD' } }
              };
            }
            cell.alignment = {
              horizontal: 'center',
              vertical: 'middle',
              wrapText: true
            };
          }
          // Nhóm tiêu đề Tiến độ thực tế (Cột 10, 11, 12 - Xanh lá Pastel)
          else if (c >= 10 && c <= 12) {
            if (r === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFDCFCE7' }
              };
              cell.font = {
                name: 'Segoe UI',
                size: 11,
                bold: true,
                color: { argb: 'FF15803D' }
              };
              cell.border = {
                top: { style: 'medium', color: { argb: 'FF4ADE80' } },
                left: { style: 'thin', color: { argb: 'FF4ADE80' } },
                bottom: { style: 'thin', color: { argb: 'FF4ADE80' } },
                right: { style: 'thin', color: { argb: 'FF4ADE80' } }
              };
            } else {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0FDF4' }
              };
              cell.font = {
                name: 'Segoe UI',
                size: 9.5,
                bold: true,
                color: { argb: 'FF16A34A' }
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FFBBF7D0' } },
                left: { style: 'thin', color: { argb: 'FFBBF7D0' } },
                bottom: { style: 'medium', color: { argb: 'FF16A34A' } },
                right: { style: 'thin', color: { argb: 'FFBBF7D0' } }
              };
            }
            cell.alignment = {
              horizontal: 'center',
              vertical: 'middle',
              wrapText: true
            };
          }
        }
      }

      // 2. Điền dữ liệu các hàng báo cáo
      const cellBorderLight = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      reports.forEach((r, idx) => {
        const planL = (r.planLocations !== undefined && r.planLocations !== '') ? (Number(r.planLocations) || r.planLocations) : '';
        const planQ = (r.planQuantity !== undefined && r.planQuantity !== '') ? (Number(r.planQuantity) || r.planQuantity) : '';
        const actL = (r.actualLocations !== undefined && r.actualLocations !== '') ? (Number(r.actualLocations) || r.actualLocations) : '';
        const actQ = (r.actualQuantity !== undefined && r.actualQuantity !== '') ? (Number(r.actualQuantity) || r.actualQuantity) : '';

        // Tỉ lệ hoàn thành & Highlight ô
        const rateVal = r.completionRate;
        const rateNum = parseFloat(rateVal);
        let rateDisplay = '-';
        let rateBg = 'FFF8FAFC';
        let rateFg = 'FF64748B';
        let rateBorder = 'FFE2E8F0';

        if (rateVal !== '' && rateVal !== null && rateVal !== undefined && !isNaN(rateNum)) {
          rateDisplay = `${rateNum}%`;
          if (rateNum >= 100) {
            rateBg = 'FFDCFCE7'; // Xanh lá hoàn thành
            rateFg = 'FF15803D';
            rateBorder = 'FF86EFAC';
          } else if (rateNum >= 80) {
            rateBg = 'FFFEF9C3'; // Vàng đạt tốt
            rateFg = 'FFA16207';
            rateBorder = 'FFFDE047';
          } else if (rateNum > 0) {
            rateBg = 'FFFEE2E2'; // Đỏ nhạt tiến độ chậm
            rateFg = 'FFB91C1C';
            rateBorder = 'FFFCA5A5';
          } else {
            rateDisplay = '0%';
            rateBg = 'FFFEE2E2';
            rateFg = 'FFB91C1C';
            rateBorder = 'FFFCA5A5';
          }
        }

        // Màu badge loại công việc
        const jLower = (r.jobType || '').toLowerCase();
        let jobBg = 'FFF8FAFC';
        let jobFg = 'FF334155';
        if (jLower.includes('dp lcd') || jLower.includes('lcd')) {
          jobBg = 'FFEDE9FE'; jobFg = 'FF6D28D9'; // Tím
        } else if (jLower.includes('tháo gp')) {
          jobBg = 'FFFEE2E2'; jobFg = 'FFBE123C'; // Đỏ nhạt
        } else if (jLower.includes('tiến độ gp') || jLower.includes('dán gp') || jLower.includes('tiến đô gp')) {
          jobBg = 'FFFFEDD5'; jobFg = 'FFC2410C'; // Cam
        } else if (jLower.includes('lắp đặt')) {
          jobBg = 'FFDBEAFE'; jobFg = 'FF1D4ED8'; // Xanh dương
        } else if (jLower.includes('bảo trì')) {
          jobBg = 'FFFCE7F3'; jobFg = 'FFBE185D'; // Hồng
        } else if (jLower.includes('hỗ trợ')) {
          jobBg = 'FFCCFBF1'; jobFg = 'FF0F766E'; // Xanh ngọc
        } else if (jLower.includes('làm file') || jLower.includes('sort')) {
          jobBg = 'FFE0E7FF'; jobFg = 'FF4338CA'; // Chàm
        } else if (jLower.includes('nghỉ')) {
          jobBg = 'FFF1F5F9'; jobFg = 'FF64748B'; // Xám
        }

        const dataRow = ws.addRow([
          idx + 1,
          r.week || '',
          r.date || '',
          r.employeeName || '',
          r.position || '',
          r.jobType || '',
          planL,
          planQ,
          r.planDetail || '',
          actL,
          actQ,
          r.actualDetail || '',
          r.notes || '',
          rateDisplay,
          r.evaluation || ''
        ]);

        // Tính chiều cao dòng tự động co giãn theo nội dung chi tiết
        const maxLen = Math.max((r.planDetail || '').length, (r.actualDetail || '').length, (r.notes || '').length);
        const lineBreaks = Math.max(
          ((r.planDetail || '').match(/\n/g) || []).length + 1,
          ((r.actualDetail || '').match(/\n/g) || []).length + 1,
          ((r.notes || '').match(/\n/g) || []).length + 1
        );
        dataRow.height = Math.min(120, Math.max(26, lineBreaks * 18, Math.ceil(maxLen / 36) * 16));

        // Format chi tiết từng ô
        for (let c = 1; c <= 15; c++) {
          const cell = dataRow.getCell(c);
          cell.border = cellBorderLight;
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };

          if (c === 1) { // STT
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          } else if (c === 2) { // Tuần
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
          } else if (c === 3) { // Ngày
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (c === 4) { // Họ tên
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          } else if (c === 5) { // Chức vụ
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
          } else if (c === 6) { // Chi tiết công việc
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: jobFg } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: jobBg } };
          } else if (c === 7) { // Kế hoạch - SL ĐĐ
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF0369A1' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FCFF' } };
          } else if (c === 8) { // Kế hoạch - SL
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0C4A6E' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
          } else if (c === 9) { // Kế hoạch - Chi tiết
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FCFF' } };
          } else if (c === 10) { // Thực tế - SL ĐĐ
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF15803D' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FDF9' } };
          } else if (c === 11) { // Thực tế - SL
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          } else if (c === 12) { // Thực tế - Chi tiết
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FDF9' } };
          } else if (c === 13) { // Ghi chú & lý do
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF475569' } };
          } else if (c === 14) { // Tỉ lệ hoàn thành (Highlight nổi bật)
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: rateFg } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rateBg } };
            cell.border = {
              top: { style: 'thin', color: { argb: rateBorder } },
              left: { style: 'thin', color: { argb: rateBorder } },
              bottom: { style: 'thin', color: { argb: rateBorder } },
              right: { style: 'thin', color: { argb: rateBorder } }
            };
          } else if (c === 15) { // Đánh giá của quản lý
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF334155' } };
          }
        }
      });

      // 3. Dòng Tổng cộng ở cuối bảng
      let totalPlanLoc = 0, totalPlanQty = 0, totalActLoc = 0, totalActQty = 0;
      let totalRates = 0, countRates = 0;
      reports.forEach(r => {
        const pl = parseInt(r.planLocations, 10);
        if (!isNaN(pl)) totalPlanLoc += pl;
        const pq = parseInt(r.planQuantity, 10);
        if (!isNaN(pq)) totalPlanQty += pq;
        const al = parseInt(r.actualLocations, 10);
        if (!isNaN(al)) totalActLoc += al;
        const aq = parseInt(r.actualQuantity, 10);
        if (!isNaN(aq)) totalActQty += aq;
        const cr = parseFloat(r.completionRate);
        if (!isNaN(cr)) { totalRates += cr; countRates++; }
      });

      const avgRate = countRates > 0 ? (totalRates / countRates).toFixed(1) + '%' : '-';
      const summaryRow = ws.addRow([
        'TỔNG CỘNG', '', '', '', '', '',
        totalPlanLoc,
        totalPlanQty,
        '',
        totalActLoc,
        totalActQty,
        '',
        '',
        avgRate,
        ''
      ]);
      summaryRow.height = 26;

      const totalRowIdx = reports.length + 3;
      ws.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);

      const summaryBorder = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'double', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      for (let c = 1; c <= 15; c++) {
        const cell = summaryRow.getCell(c);
        cell.border = summaryBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // 4. Xuất tải file về trình duyệt
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `Bao_Cao_Cong_Viec_${todayStr}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 200);

      return;
    } catch (err) {
      console.error("Lỗi xuất Excel qua ExcelJS, chuyển sang fallback XLSX:", err);
    }
  }

  // Phương án dự phòng (fallback) qua SheetJS nếu ExcelJS không khả dụng
  if (typeof XLSX === 'undefined') {
    alert("Thư viện xuất Excel chưa sẵn sàng. Vui lòng tải lại trang!");
    return;
  }

  const headerRow1 = [
    "", "", "", "", "", "",
    "Kế hoạch dự kiến", "", "",
    "Tiến độ thực tế", "", "",
    "", "", ""
  ];

  const headerRow2 = [
    "STT", "Tuần", "Ngày", "Họ tên", "Chức vụ", "Công việc",
    "SL ĐĐ", "Số lượng", "Chi tiết",
    "SL ĐĐ", "Số lượng", "Chi tiết",
    "Ghi chú", "Tỉ lệ hoàn thành", "Đánh giá"
  ];

  const dataRows = reports.map((r, idx) => [
    idx + 1,
    r.week || "",
    r.date || "",
    r.employeeName || "",
    r.position || "",
    r.jobType || "",
    r.planLocations || "",
    r.planQuantity || "",
    r.planDetail || "",
    r.actualLocations || "",
    r.actualQuantity || "",
    r.actualDetail || "",
    r.notes || "",
    r.completionRate ? (parseFloat(r.completionRate) / 100) : "",
    r.evaluation || ""
  ]);

  const wsData = [headerRow1, headerRow2, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!merges'] = [
    { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },
    { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } }
  ];

  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 15 }, { wch: 22 }, { wch: 14 }, { wch: 18 },
    { wch: 12 }, { wch: 10 }, { wch: 30 },
    { wch: 12 }, { wch: 10 }, { wch: 30 },
    { wch: 25 }, { wch: 15 }, { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BaoCaoCongViec");

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `Bao_Cao_Cong_Viec_${todayStr}.xlsx`);
}

function exportToCSV() {
  const reports = getFilteredReports();
  if (reports.length === 0) {
    alert("Không có dữ liệu để xuất!");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent += ",,,,,Kế hoạch dự kiến,,,Tiến độ thực tế,,,,,\n";
  csvContent += "Tuần,Ngày,Họ tên,Chức vụ,Chi tiết công việc,Số lượng địa điểm,Số lượng,Chi tiết,Số lượng địa điểm,Số lượng,Chi tiết,Ghi chú,Tỉ lệ hoàn thành,Đánh giá\n";

  reports.forEach(r => {
    const row = [
      escapeCsv(r.week),
      escapeCsv(r.date),
      escapeCsv(r.employeeName),
      escapeCsv(r.position),
      escapeCsv(r.jobType),
      escapeCsv(r.planLocations),
      escapeCsv(r.planQuantity),
      escapeCsv(r.planDetail),
      escapeCsv(r.actualLocations),
      escapeCsv(r.actualQuantity),
      escapeCsv(r.actualDetail),
      escapeCsv(r.notes),
      escapeCsv(r.completionRate ? (parseFloat(r.completionRate) / 100).toString() : ""),
      escapeCsv(r.evaluation)
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Bao_Cao_Cong_Viec_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = val.toString().replace(/"/g, '""');
  return `"${str}"`;
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (json.length < 2) {
        alert("File không có đủ dữ liệu!");
        return;
      }

      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(3, json.length); i++) {
        const rowStr = JSON.stringify(json[i]);
        if (rowStr.includes("Họ tên") || rowStr.includes("Tuần") || rowStr.includes("Ngày")) {
          headerRowIdx = i;
          break;
        }
      }

      const imported = [];
      for (let r = headerRowIdx + 1; r < json.length; r++) {
        const row = json[r];
        if (!row || row.length === 0) continue;

        // Bỏ qua dòng TỔNG CỘNG ở cuối file nếu có
        const rowStr = JSON.stringify(row).toUpperCase();
        if (rowStr.includes("TỔNG CỘNG") || rowStr.includes("TONG CONG")) continue;

        // Tự động nhận diện cột STT nếu file xuất có cột STT đầu tiên
        let offset = 0;
        const headerStr = json[headerRowIdx] ? JSON.stringify(json[headerRowIdx]).toUpperCase() : '';
        if (headerStr.includes('"STT"') || (!isNaN(parseInt(row[0])) && row.length >= 14 && (String(row[1]).includes('Tuần') || !isNaN(parseInt(row[1])) || String(row[1]).startsWith('W')))) {
          offset = 1;
        }

        const week = row[offset + 0] ? String(row[offset + 0]).trim() : '';
        const date = row[offset + 1] ? String(row[offset + 1]).trim() : '';
        const employeeName = row[offset + 2] ? String(row[offset + 2]).trim() : '';
        const position = row[offset + 3] ? String(row[offset + 3]).trim() : '';
        const jobType = row[offset + 4] ? String(row[offset + 4]).trim() : '';

        if (!employeeName && !jobType && !date) continue;

        let cRate = row[offset + 12];
        let rateNum = '';
        if (cRate !== undefined && cRate !== null) {
          const cStr = String(cRate).replace('%', '').replace(',', '.').trim();
          const dVal = parseFloat(cStr);
          if (!isNaN(dVal)) {
            rateNum = dVal <= 1.0 ? Math.round(dVal * 1000) / 10 : Math.round(dVal * 10) / 10;
          }
        }

        imported.push({
          id: 'rep-' + Date.now() + '-' + r,
          week: week,
          date: date,
          employeeName: employeeName,
          position: position,
          jobType: jobType || 'Khác',
          planLocations: row[offset + 5] !== undefined ? String(row[offset + 5]).trim() : '',
          planQuantity: row[offset + 6] !== undefined ? String(row[offset + 6]).trim() : '',
          planDetail: row[offset + 7] !== undefined ? String(row[offset + 7]).trim() : '',
          actualLocations: row[offset + 8] !== undefined ? String(row[offset + 8]).trim() : '',
          actualQuantity: row[offset + 9] !== undefined ? String(row[offset + 9]).trim() : '',
          actualDetail: row[offset + 10] !== undefined ? String(row[offset + 10]).trim() : '',
          notes: row[offset + 11] !== undefined ? String(row[offset + 11]).trim() : '',
          completionRate: rateNum,
          evaluation: row[offset + 13] !== undefined ? String(row[offset + 13]).trim() : ''
        });
      }

      if (imported.length > 0) {
        if (confirm(`Đã tìm thấy ${imported.length} báo cáo từ file. Bạn muốn THÊM vào dữ liệu hiện tại hay GHI ĐÈ? (OK: Thêm vào, Cancel: Bỏ qua)`)) {
          appState.reports = [...imported, ...appState.reports];
          saveData();
          populateDropdowns();
          renderApp();
          alert(`Thành công! Đã nhập thêm ${imported.length} báo cáo.`);
        }
      } else {
        alert("Không tìm thấy dòng báo cáo hợp lệ nào trong file.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi khi đọc file Excel/CSV: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function resetDefaultData() {
  if (confirm("Khôi phục danh sách báo cáo mẫu ban đầu? Các thay đổi sẽ bị ghi đè.")) {
    if (window.INITIAL_REPORTS && Array.isArray(window.INITIAL_REPORTS)) {
      appState.reports = [...window.INITIAL_REPORTS];
      saveData();
      populateDropdowns();
      renderApp();
      alert("Đã khôi phục thành công toàn bộ dữ liệu mẫu!");
    }
  }
}

function clearAllReports() {
  if (confirm("⚠️ CẢNH BÁO XÓA DỮ LIỆU:\n\nBạn có chắc chắn muốn XÓA TOÀN BỘ tất cả báo cáo hiện có trong hệ thống không?\n\n- Sau khi xóa, danh sách sẽ trở về trạng thái trống hoàn toàn để bạn bắt đầu nhập mới.\n- Bạn vẫn có thể nạp lại 288 báo cáo mẫu bất kỳ lúc nào nếu cần.")) {
    appState.reports = [];
    saveData();
    populateDropdowns();
    renderApp();
    alert("Đã xóa toàn bộ báo cáo thành công! Hệ thống hiện đang trống để bạn bắt đầu nhập kế hoạch mới.");
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function setupEventListeners() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const repForm = document.getElementById('report-form');
  if (repForm) repForm.addEventListener('submit', handleSaveReport);

  const createUserForm = document.getElementById('create-user-form');
  if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);

  const fileInput = document.getElementById('import-file-input');
  if (fileInput) fileInput.addEventListener('change', handleFileImport);

  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.filters.search = e.target.value.trim();
      renderManagerView();
    });
  }

  const trackerInput = document.getElementById('tracker-date-input');
  if (trackerInput) {
    trackerInput.addEventListener('change', (e) => {
      handleTrackerDateChange(e.target.value);
    });
  }

  document.getElementById('filter-week').addEventListener('change', (e) => {
    appState.filters.week = e.target.value;
    renderManagerView();
  });
  document.getElementById('filter-employee').addEventListener('change', (e) => {
    appState.filters.employee = e.target.value;
    renderManagerView();
  });
  document.getElementById('filter-job-type').addEventListener('change', (e) => {
    appState.filters.jobType = e.target.value;
    renderManagerView();
  });
  document.getElementById('filter-rate-status').addEventListener('change', (e) => {
    appState.filters.rateStatus = e.target.value;
    renderManagerView();
  });
}

function resetFilters() {
  appState.filters = {
    week: 'all',
    employee: 'all',
    jobType: 'all',
    rateStatus: 'all',
    search: ''
  };
  document.getElementById('filter-week').value = 'all';
  document.getElementById('filter-employee').value = 'all';
  document.getElementById('filter-job-type').value = 'all';
  document.getElementById('filter-rate-status').value = 'all';
  document.getElementById('filter-search').value = '';
  renderManagerView();
}

document.addEventListener('DOMContentLoaded', initApp);
