'use strict';
/* =====================================================================
 * sample-data.js — Bộ dữ liệu mẫu (tính theo ngày hiện tại để luôn "sống")
 * ===================================================================== */

/** PRNG có seed để dữ liệu mẫu ổn định giữa các lần tải */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ảnh bìa minh hoạ dạng SVG (không cần Internet) */
function coverSVG(c1, c2, iconName, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="800" height="400" fill="url(#g)"/>
    <circle cx="680" cy="70" r="150" fill="#fff" fill-opacity=".18"/><circle cx="90" cy="370" r="130" fill="#fff" fill-opacity=".14"/>
    <circle cx="560" cy="330" r="46" fill="#fff" fill-opacity=".12"/>
    <g transform="translate(340 92) scale(5)" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconName]}</g>
    <text x="400" y="318" text-anchor="middle" font-family="Times New Roman, Times, serif" font-size="38" font-style="italic" fill="#fff">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function buildSampleState() {
  const st = defaultState();
  const now = new Date();
  const Y = now.getFullYear();
  const rnd = mulberry32(2026);
  const rel = n => D.iso(D.add(now, n));

  /* ---------- Hồ sơ & chu kỳ ---------- */
  st.profile = { name: 'Diep', subtitle: 'Kế hoạch 90 ngày', cycleStart: rel(-20) };

  /* ---------- Goal Planner ---------- */
  st.goals.vision = 'Một năm cân bằng: khoẻ mạnh hơn, vững vàng tài chính, hoàn thành đồ án AI chất lượng và dành nhiều thời gian cho những người mình thương.';
  st.goals.priorities = [
    'Hoàn thành đồ án tốt nghiệp đúng hạn',
    'Tập thể dục ít nhất 4 buổi mỗi tuần',
    'Tiết kiệm 20% thu nhập mỗi tháng',
    'Đọc & tái hiện 1 bài báo khoa học mỗi tháng',
    '',
  ];
  const G = [
    {
      title: 'Chạy bộ 5 km không nghỉ', area: 'health', status: 'doing', deadline: rel(45), reward: 'Đôi giày chạy mới',
      cover: ['#8FE0BF', '#2FAE84', 'heart', 'Khoẻ mạnh mỗi ngày'],
      answers: ['Sức khoẻ là nền tảng để học tập và làm việc bền bỉ.', 'Lười vào buổi sáng — chuẩn bị sẵn đồ chạy từ tối hôm trước.', 'Tràn đầy năng lượng, tự tin và ngủ ngon hơn.'],
      steps: [['Chạy bộ nhẹ 3 buổi/tuần, mỗi buổi 20 phút', 1], ['Tăng quãng đường 10% mỗi tuần', 1], ['Ăn đủ chất, ngủ trước 23:00', 1], ['Chạy thử 3 km liên tục', 0], ['Hoàn thành 5 km trong một buổi', 0]],
    },
    {
      title: 'Xây quỹ dự phòng 3 tháng chi tiêu', area: 'finance', status: 'doing', deadline: rel(80), reward: 'Chuyến đi Đà Lạt cuối tuần',
      cover: ['#F9D98F', '#E3A23B', 'wallet', 'Tự do tài chính'],
      answers: ['Để yên tâm trước những biến cố bất ngờ.', 'Chi tiêu cảm tính — áp dụng quy tắc chờ 48 giờ trước khi mua.', 'Bình tĩnh, chủ động và có nhiều lựa chọn hơn.'],
      steps: [['Ghi chép chi tiêu hằng ngày', 1], ['Lập ngân sách theo quy tắc 50/30/20', 1], ['Tự động chuyển 20% thu nhập vào tài khoản tiết kiệm', 0], ['Cắt giảm 3 khoản chi không cần thiết', 0], ['Đạt mốc quỹ dự phòng', 0]],
    },
    {
      title: 'Hoàn thành đồ án tốt nghiệp AI', area: 'career', status: 'doing', deadline: rel(60), reward: 'Bàn phím cơ mới',
      cover: ['#9CC0FF', '#4F86F0', 'briefcase', 'Đồ án AI 2026'],
      answers: ['Đây là cột mốc khép lại chặng đường đại học và mở ra cơ hội nghề nghiệp.', 'Thực nghiệm tốn thời gian — chia nhỏ mốc và chạy song song.', 'Tự hào, sẵn sàng cho công việc nghiên cứu/ứng dụng AI.'],
      steps: [['Chốt đề tài & khảo sát 15 bài báo liên quan', 1], ['Xây dựng pipeline dữ liệu & baseline', 1], ['Huấn luyện mô hình, chạy ablation study', 1], ['Viết báo cáo kỹ thuật (LaTeX)', 0], ['Bảo vệ thử trước nhóm nghiên cứu', 0]],
    },
    {
      title: 'Tái hiện 3 bài báo khoa học', area: 'growth', status: 'doing', deadline: rel(85), reward: 'Một khoá học chuyên sâu',
      cover: ['#C9BCFA', '#8B74E8', 'sprout', 'Học mỗi ngày'],
      answers: ['Hiểu sâu phương pháp thay vì chỉ đọc lướt kết quả.', 'Thiếu chi tiết cài đặt — đọc kỹ phụ lục và mã nguồn gốc.', 'Tự tin đóng góp ý tưởng nghiên cứu của riêng mình.'],
      steps: [['Chọn 3 bài báo (NeurIPS / ICLR / ACL)', 1], ['Đọc kỹ & tóm tắt phương pháp', 1], ['Cài đặt lại bài báo thứ nhất', 0], ['So sánh kết quả với bài gốc', 0], ['Viết blog chia sẻ kinh nghiệm', 0]],
    },
    {
      title: 'Kết nối sâu hơn với gia đình', area: 'relation', status: 'done', deadline: rel(-2), reward: 'Bữa tối ở nhà hàng yêu thích',
      cover: ['#F9B8C5', '#E86A82', 'users', 'Yêu thương'],
      answers: ['Gia đình là nguồn động lực lớn nhất.', 'Bận rộn — lên lịch cố định như một cuộc hẹn quan trọng.', 'Ấm áp, gắn bó và bình yên hơn.'],
      steps: [['Gọi điện cho bố mẹ mỗi tối Chủ Nhật', 1], ['Nấu một bữa ăn cùng gia đình mỗi tuần', 1], ['Không dùng điện thoại trong bữa ăn', 1], ['Tổ chức một buổi dã ngoại', 1], ['Viết thư cảm ơn cho người thân', 1]],
    },
    {
      title: 'Đọc xong 6 cuốn sách hay', area: 'growth', status: 'doing', deadline: rel(-4), reward: 'Kệ sách gỗ nhỏ',
      cover: ['#8ED8E2', '#2BA5B5', 'book', 'Sách mở lối'],
      answers: ['Đọc giúp mở rộng góc nhìn và tư duy.', 'Hay lướt mạng xã hội — đọc 20 trang trước khi ngủ.', 'Tư duy sâu sắc và giao tiếp tốt hơn.'],
      steps: [['Lập danh sách 6 cuốn sách', 1], ['Đọc “Atomic Habits”', 1], ['Đọc “Deep Work”', 0], ['Ghi chú ý tưởng hay vào sổ', 0], ['Chia sẻ review với bạn bè', 0]],
    },
  ];
  st.goals.cards = G.map((g, i) => ({
    ...blankGoal(i),
    title: g.title, area: g.area, status: g.status, deadline: g.deadline, reward: g.reward,
    image: coverSVG(...g.cover), answers: g.answers,
    steps: g.steps.map(([text, done]) => ({ text, done: !!done })),
  }));

  /* ---------- Habit Tracker: tháng trước + tháng này ---------- */
  const names = ['Dậy trước 6:00', 'Uống đủ 2 lít nước', 'Tập thể dục 30 phút', 'Đọc sách 20 trang', 'Thiền 10 phút', 'Học tiếng Anh 30 phút',
    'Code / nghiên cứu 2 giờ', 'Đọc 1 bài báo khoa học', 'Viết nhật ký', 'Không mạng xã hội sau 22:00', 'Đi bộ 8.000 bước', 'Ngủ trước 23:00'];
  const probs = [0.72, 0.9, 0.66, 0.78, 0.58, 0.74, 0.86, 0.46, 0.62, 0.52, 0.7, 0.6];
  [-1, 0].forEach(offset => {
    const d0 = new Date(Y, now.getMonth() + offset, 1);
    const y = d0.getFullYear(), m = d0.getMonth() + 1, n = D.dim(y, m);
    const last = offset === 0 ? now.getDate() : n;
    const checks = names.map((_, i) => {
      const arr = [];
      for (let d = 1; d <= last; d++) {
        const trend = offset === 0 ? 0.06 : (d / n) * 0.12 - 0.04; // tiến bộ dần theo tháng
        if (rnd() < probs[i] + trend) arr.push(d);
      }
      return arr;
    });
    st.habits.months[`${y}-${pad(m)}`] = { names: [...names], checks };
  });
  const showPrev = now.getDate() < 8; // đầu tháng → mở tháng trước để thấy biểu đồ đầy đủ
  const hv = new Date(Y, now.getMonth() - (showPrev ? 1 : 0), 1);
  st.habits.year = hv.getFullYear();
  st.habits.month = hv.getMonth() + 1;

  /* ---------- Weekly Planner: tuần này + tuần trước ---------- */
  const weekdayTpl = {
    '07:00': ['Tập thể dục buổi sáng', 'health'], '07:30': ['Ăn sáng & đọc tin', 'personal'],
    '08:00': ['Làm việc sâu: đồ án', 'work'], '08:30': ['Làm việc sâu: đồ án', 'work'], '09:00': ['Làm việc sâu: đồ án', 'work'], '09:30': ['Làm việc sâu: đồ án', 'work'],
    '10:00': ['Họp nhóm nghiên cứu', 'appt'], '10:30': ['Trả lời email', 'work'],
    '11:30': ['Nấu ăn trưa', 'home'], '12:00': ['Nghỉ trưa', 'personal'],
    '13:30': ['Đọc bài báo khoa học', 'study'], '14:00': ['Đọc bài báo khoa học', 'study'], '14:30': ['Ghi chú & tóm tắt', 'study'],
    '15:00': ['Code thực nghiệm', 'work'], '15:30': ['Code thực nghiệm', 'work'], '16:00': ['Code thực nghiệm', 'work'],
    '17:00': ['Đi bộ 30 phút', 'health'], '18:00': ['Dọn dẹp nhà cửa', 'home'], '19:00': ['Ăn tối cùng gia đình', 'personal'],
    '20:00': ['Học tiếng Anh', 'study'], '20:30': ['Học tiếng Anh', 'study'], '21:00': ['Viết nhật ký & lên kế hoạch mai', 'personal'], '21:30': ['Đọc sách thư giãn', 'personal'],
  };
  const weekendTpl = {
    '07:30': ['Chạy bộ công viên', 'health'], '08:30': ['Ăn sáng cùng gia đình', 'personal'], '09:30': ['Đi chợ & mua sắm', 'home'],
    '10:30': ['Dọn dẹp, giặt giũ', 'home'], '14:00': ['Đọc sách', 'study'], '15:00': ['Cà phê với bạn bè', 'appt'],
    '17:00': ['Yoga nhẹ', 'health'], '19:00': ['Xem phim cùng gia đình', 'personal'], '20:30': ['Tổng kết tuần & lập kế hoạch tuần mới', 'personal'],
  };
  const tasksPool = [
    ['Hoàn thiện chương 3 báo cáo', 'Chạy thí nghiệm ablation #2', 'Gửi email cho thầy hướng dẫn', 'Đọc bài báo về Graph RAG', 'Tập thể dục 30 phút', 'Mua đồ ăn cho cả tuần'],
    ['Viết phần Related Work', 'Fix bug data loader', 'Họp nhóm lúc 10:00', 'Ôn từ vựng tiếng Anh', 'Thanh toán hoá đơn điện'],
    ['Vẽ biểu đồ kết quả', 'Review code cho bạn cùng nhóm', 'Chạy bộ 3 km', 'Gọi điện cho bà', 'Đọc 20 trang sách'],
    ['Chuẩn bị slide seminar', 'Huấn luyện lại mô hình với lr mới', 'Viết blog tuần', 'Dọn dẹp bàn làm việc', 'Tưới cây'],
    ['Seminar đọc bài báo', 'Tổng hợp kết quả thực nghiệm', 'Cập nhật README cho repo', 'Tập yoga 20 phút'],
    ['Đi chợ cuối tuần', 'Dọn nhà', 'Đọc sách 1 giờ', 'Cà phê với bạn'],
    ['Gọi điện cho bố mẹ', 'Tổng kết tuần', 'Lập kế hoạch tuần mới', 'Chuẩn bị đồ cho thứ Hai'],
  ];
  const gratitude = [
    'Một buổi sáng trong lành và ly cà phê ngon.', 'Thầy hướng dẫn góp ý rất tận tình.', 'Được bạn bè giúp đỡ khi gặp khó.',
    'Sức khoẻ tốt để làm điều mình thích.', 'Bữa tối ấm cúng bên gia đình.', 'Một ngày nghỉ thật thư thái.', 'Một tuần đã cố gắng hết mình.',
  ];
  const priority = ['Hoàn thiện chương 3 báo cáo', 'Viết xong Related Work', 'Hoàn thành biểu đồ kết quả', 'Slide seminar', 'Trình bày seminar', 'Nghỉ ngơi nạp năng lượng', 'Lên kế hoạch tuần mới'];
  const thisMon = D.monday(now), todayIdx = D.wdIndex(now);
  [-7, 0].forEach(shift => {
    const ws = D.iso(D.add(thisMon, shift));
    const wk = { focus: shift === 0 ? '1. Xong chương 3 báo cáo\n2. Chạy xong ablation study\n3. Tập thể dục ≥ 4 buổi' : 'Hoàn thiện pipeline dữ liệu', note: '', days: [] };
    for (let i = 0; i < 7; i++) {
      const day = blankDay();
      const past = shift < 0 || i < todayIdx, isToday = shift === 0 && i === todayIdx;
      day.gratitude = past || isToday ? gratitude[i] : '';
      day.priority = priority[i];
      tasksPool[i].forEach((t, k) => { day.tasks[k] = { text: t, done: past ? rnd() < 0.85 : isToday ? k < 2 : false }; });
      const tpl = i >= 5 ? weekendTpl : weekdayTpl;
      Object.entries(tpl).forEach(([slot, [text, tag]]) => { day.blocks[slot] = { text, tag }; });
      wk.days.push(day);
    }
    if (shift < 0) wk.note = 'Làm việc sâu buổi sáng rất hiệu quả. Cần ngủ sớm hơn vào giữa tuần.';
    st.weekly.weeks[ws] = wk;
  });
  st.weekly.weekStart = D.iso(thisMon);

  /* ---------- Year at a Glance ---------- */
  const tet = { 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26' };
  const ev = [
    [`${Y}-01-01`, 'Tết Dương lịch', 'holiday'],
    [`${Y}-02-14`, 'Lễ Tình nhân', 'personal'],
    [`${Y}-03-08`, 'Quốc tế Phụ nữ', 'holiday'],
    [`${Y}-04-30`, 'Ngày Giải phóng miền Nam', 'holiday'],
    [`${Y}-05-01`, 'Quốc tế Lao động', 'holiday'],
    [`${Y}-06-01`, 'Quốc tế Thiếu nhi', 'holiday'],
    [`${Y}-09-02`, 'Quốc khánh', 'holiday'],
    [`${Y}-10-20`, 'Ngày Phụ nữ Việt Nam', 'holiday'],
    [`${Y}-11-20`, 'Ngày Nhà giáo Việt Nam', 'holiday'],
    [`${Y}-12-24`, 'Đêm Giáng sinh', 'personal'],
    [`${Y}-12-31`, 'Tổng kết năm', 'important'],
    [rel(-20), 'Khởi động chu kỳ 90 ngày', 'important'],
    [rel(2), 'Họp nhóm đồ án', 'work'],
    [rel(5), 'Nộp báo cáo tiến độ', 'important'],
    [rel(9), 'Seminar đọc bài báo', 'study'],
    [rel(16), 'Sinh nhật mẹ', 'personal'],
    [rel(33), 'Hạn nộp bản thảo báo cáo', 'important'],
    [rel(55), 'Bảo vệ thử đồ án', 'study'],
  ];
  if (tet[Y]) ev.push([`${Y}-${tet[Y]}`, 'Tết Nguyên Đán (Mùng 1)', 'holiday']);
  st.year.events = ev.map(([date, title, cat]) => ({ id: uid(), date, title, cat }));
  st.year.year = Y;

  /* ---------- Lịch sử tiến độ mục tiêu (cho sparkline 30 ngày) ---------- */
  const finalPct = { health: 60, finance: 40, career: 60, growth: 40, relation: 100, o: 57 };
  for (let i = 29; i >= 1; i -= 2) {
    const f = 1 - i / 34;                       // tăng dần theo thời gian
    const e = {};
    Object.entries(finalPct).forEach(([k, v]) => { e[k] = Math.max(0, Math.round(v * f + (rnd() - 0.5) * 6)); });
    st.goals.history[rel(-i)] = e;
  }

  /* ---------- Tài chính: 6 tháng giao dịch, ngân sách, hoá đơn, nợ, quỹ fan ---------- */
  const F = st.finance;
  F.opening = 8000000;
  F.period = now.getDate() < 8 ? D.iso(new Date(Y, now.getMonth() - 1, 1)).slice(0, 7) : D.today().slice(0, 7); // đầu tháng → xem tháng trước cho đầy đủ
  F.budgets = { food: 5000000, shopping: 1200000, concert: 2000000, bills: 7500000, debt: 4000000, other: 1000000 };
  const tx = (date, desc, type, cat, amount, link) => { const t = { id: uid(), date, desc, type, cat, amount }; if (link) t.link = link; F.txs.push(t); return t; };
  const monthKey = mo => D.iso(new Date(Y, now.getMonth() - mo, 1)).slice(0, 7);

  // F. Hoá đơn định kỳ
  F.bills = [
    { id: uid(), name: 'Tiền thuê nhà', kind: 'home', amount: 4500000, dueDay: 3 },
    { id: uid(), name: 'Tiền điện EVN', kind: 'power', amount: 680000, dueDay: 10 },
    { id: uid(), name: 'Tiền nước', kind: 'water', amount: 150000, dueDay: 10 },
    { id: uid(), name: 'Internet FPT', kind: 'internet', amount: 250000, dueDay: 15 },
    { id: uid(), name: 'Cước điện thoại', kind: 'phone', amount: 120000, dueDay: 20 },
    { id: uid(), name: 'Spotify + YouTube Premium', kind: 'other', amount: 139000, dueDay: 25 },
  ];
  // D. Khoản nợ
  const dPhone = { id: uid(), name: 'Trả góp điện thoại', lender: 'Công ty tài chính · 0% lãi suất', total: 18000000, initialPaid: 4500000, monthly: 1500000, due: D.iso(new Date(Y, now.getMonth() + 4, 8)), created: monthKey(5) + '-01', closed: false };
  const dFriend = { id: uid(), name: 'Vay bạn Minh mua vé concert', lender: 'Bạn Minh', total: 5000000, initialPaid: 0, monthly: 1000000, due: rel(40), created: monthKey(3) + '-12', closed: false };
  const dCard = { id: uid(), name: 'Dư nợ thẻ tín dụng', lender: 'Thẻ tín dụng ngân hàng', total: 3200000, initialPaid: 0, due: rel(12), created: monthKey(1) + '-05', closed: false };
  const dLan = { id: uid(), name: 'Mượn chị Lan', lender: 'Chị Lan', total: 2000000, initialPaid: 0, due: monthKey(4) + '-28', created: monthKey(5) + '-03', closed: true };
  F.debts = [dPhone, dFriend, dCard, dLan];
  // E. Quỹ tiết kiệm & mục tiêu fan
  const fConcert = { id: uid(), name: 'Quỹ Concert Idol 2026', kind: 'concert', target: 8000000, deadline: rel(75), note: 'Vé VIP + vé máy bay + lightstick', entries: [{ id: uid(), date: monthKey(5) + '-01', amount: 500000, note: 'Tiền lì xì còn lại', external: true }] };
  const fLive = { id: uid(), name: 'Quỹ đi Phòng trà Idol', kind: 'liveshow', target: 3000000, deadline: rel(40), note: 'Đêm nhạc cuối năm, ngồi hàng đầu', entries: [] };
  const fMerch = { id: uid(), name: 'Quỹ Album & Merch', kind: 'merch', target: 2000000, deadline: rel(12), note: 'Album mới + photobook bản giới hạn', entries: [] };
  const fEmer = { id: uid(), name: 'Quỹ khẩn cấp', kind: 'emergency', target: 20000000, deadline: '', note: 'Mục tiêu: 3 tháng chi tiêu thiết yếu', entries: [{ id: uid(), date: monthKey(5) + '-01', amount: 6000000, note: 'Số dư ban đầu', external: true }] };
  F.funds = [fConcert, fLive, fMerch, fEmer];
  const dep = (f, date, amount, note) => f.entries.push({ id: uid(), date, amount, note, external: false });

  const foods = [['Ăn sáng phở', 45000], ['Cà phê làm việc', 39000], ['Cơm trưa', 55000], ['Đi chợ cuối tuần', 420000], ['Trà sữa', 45000], ['Ăn tối cùng bạn', 280000], ['Bánh mì', 25000], ['Siêu thị', 650000]];
  const shops = [['Áo thun mới', 320000], ['Mỹ phẩm', 450000], ['Sách chuyên ngành', 185000], ['Phụ kiện điện thoại', 150000], ['Giày thể thao', 890000]];
  const others = [['Grab đi làm', 65000], ['Cắt tóc', 120000], ['Gửi xe tháng', 150000], ['Thuốc & vitamin', 210000]];
  for (let mo = 5; mo >= 0; mo--) {
    const base = new Date(Y, now.getMonth() - mo, 1);
    const y = base.getFullYear(), m = base.getMonth() + 1, n = D.dim(y, m), mk = monthKey(mo);
    const last = mo === 0 ? now.getDate() : n;
    const day = d => `${y}-${pad(m)}-${pad(Math.min(d, n))}`;
    const on = d => d <= last;
    // Thu nhập
    tx(day(1), 'Lương tháng ' + m, 'income', 'salary', 18000000);
    if (mo === 1 && on(15)) tx(day(15), 'Thưởng dự án', 'income', 'bonus', 3500000);
    if (mo === 4 && on(25)) tx(day(25), 'Dạy kèm cuối tuần', 'income', 'other', 2400000);
    if (mo === 3 && on(9)) tx(day(9), 'Bán lại album bị trùng', 'income', 'other', 300000);
    // Hoá đơn (giao dịch có liên kết → tự tick “Đã trả”)
    F.bills.forEach(bl => {
      const payDay = Math.max(1, bl.dueDay - Math.floor(rnd() * 3));
      const skip = mo === 0 && bl.kind === 'internet';           // để lại 1 hoá đơn chưa trả trong tháng này làm ví dụ
      if (!on(payDay + (mo === 0 ? 1 : 0)) || skip) return;
      const amt = bl.kind === 'power' ? 560000 + Math.round(rnd() * 26) * 10000 : bl.kind === 'water' ? 120000 + Math.round(rnd() * 6) * 10000 : bl.amount;
      tx(day(payDay), `${bl.name} T${m}`, 'expense', 'bills', amt, { kind: 'bill', id: bl.id, month: mk });
    });
    // Trả nợ
    if (on(8)) tx(day(8), 'Trả nợ: ' + dPhone.name, 'expense', 'debt', 1500000, { kind: 'debt', id: dPhone.id });
    if ((mo === 2 || mo === 1) && on(20)) tx(day(20), 'Trả nợ: ' + dFriend.name, 'expense', 'debt', 1000000, { kind: 'debt', id: dFriend.id });
    if (mo === 1 && on(25)) tx(day(25), 'Trả nợ: ' + dCard.name, 'expense', 'debt', 1200000, { kind: 'debt', id: dCard.id });
    if ((mo === 5 || mo === 4) && on(16)) tx(day(16), 'Trả nợ: ' + dLan.name, 'expense', 'debt', 1000000, { kind: 'debt', id: dLan.id });
    // Nạp quỹ ngay sau ngày lương (trừ vào số dư thực tế)
    if (on(2)) {
      dep(fConcert, day(2), 1200000, 'Tiết kiệm từ lương T' + m);
      dep(fEmer, day(2), 1000000, 'Trích 5% lương');
      if (mo <= 4) dep(fLive, day(2), 500000, 'Để dành đi phòng trà');
      if (mo <= 4) dep(fMerch, day(2), 300000, 'Để dành mua album');
    }
    // Chi tiêu fan: vé phòng trà / concert
    if (mo === 2 && on(14)) { dep(fLive, day(14), -900000, 'Vé phòng trà đêm nhạc acoustic'); tx(day(14), 'Vé phòng trà đêm nhạc acoustic', 'expense', 'concert', 900000); }
    if (mo === 3 && on(18)) { dep(fMerch, day(18), -650000, 'Album + photocard'); tx(day(18), 'Album + photocard', 'expense', 'shopping', 650000); }
    if (mo === 3 && on(13)) tx(day(13), 'Vé concert (vay bạn Minh)', 'expense', 'concert', 4800000);
    if (mo === 1 && on(6)) tx(day(6), 'Vé fanmeeting online', 'expense', 'concert', 350000);
    if (mo === 1 && on(21)) tx(day(21), 'Vé phòng trà cuối tuần', 'expense', 'concert', 950000);
    if (mo === 4 && on(22)) tx(day(22), 'Vé phòng trà cùng nhóm bạn', 'expense', 'concert', 750000);
    if (mo === 1 && on(23)) tx(day(23), 'Lightstick phiên bản mới', 'expense', 'shopping', 850000);
    if (on(18)) tx(day(18), 'Quà sinh nhật bạn', 'expense', 'other', 300000 + Math.round(rnd() * 3) * 50000);
    // Chi tiêu hằng ngày
    for (let d = 1; d <= last; d++) {
      if (rnd() < 0.62) { const f = foods[Math.floor(rnd() * foods.length)]; tx(day(d), f[0], 'expense', 'food', f[1] + Math.round(rnd() * 20) * 1000); }
      if (rnd() < 0.08) { const f = shops[Math.floor(rnd() * shops.length)]; tx(day(d), f[0], 'expense', 'shopping', f[1]); }
      if (rnd() < 0.1) { const f = others[Math.floor(rnd() * others.length)]; tx(day(d), f[0], 'expense', 'other', f[1]); }
    }
  }
  st.year.monthGoals[Y] = [
    'Lên kế hoạch năm, chọn đề tài đồ án', 'Đón Tết trọn vẹn, đọc 1 cuốn sách', 'Khảo sát tài liệu, viết proposal',
    'Xây dựng baseline, chạy bộ đều đặn', 'Hoàn thành thực nghiệm chính', 'Viết bài blog kỹ thuật đầu tiên',
    'Du lịch cùng gia đình', 'Ôn tập, học tiếng Anh tăng cường', 'Khởi động chu kỳ 90 ngày mới',
    'Hoàn thiện chương 3, chạy ablation', 'Viết báo cáo & slide bảo vệ', 'Bảo vệ đồ án, tổng kết năm',
  ];
  return st;
}
