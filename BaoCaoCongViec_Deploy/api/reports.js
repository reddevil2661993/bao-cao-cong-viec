// Vercel Serverless Function cho API /api/reports
// Ho tro dong bo du lieu cho moi thiet bi (4G, Wi-Fi, Dien thoai, May tinh)

let memoryStore = [];

async function getStoredReports() {
  // 1. Kiem tra Vercel KV / Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const resp = await fetch(`${kvUrl}/get/daily_work_reports`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn("Loi doc tu Vercel KV:", e);
    }
  }

  // 2. Kiem tra Firebase Realtime Database
  const fbUrl = process.env.FIREBASE_URL;
  if (fbUrl) {
    try {
      const resp = await fetch(`${fbUrl.replace(/\/$/, '')}/reports.json`, { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return Object.values(data);
      }
    } catch (e) {
      console.warn("Loi doc tu Firebase:", e);
    }
  }

  // 3. Fallback bo nho RAM tam
  return memoryStore;
}

async function saveStoredReports(reports) {
  memoryStore = reports;

  // 1. Luu vao Vercel KV / Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/daily_work_reports`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(reports))
      });
    } catch (e) {
      console.warn("Loi ghi vao Vercel KV:", e);
    }
  }

  // 2. Luu vao Firebase Realtime Database
  const fbUrl = process.env.FIREBASE_URL;
  if (fbUrl) {
    try {
      await fetch(`${fbUrl.replace(/\/$/, '')}/reports.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reports)
      });
    } catch (e) {
      console.warn("Loi ghi vao Firebase:", e);
    }
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-firebase-url');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Tra ve toan bo danh sach bao cao
  if (req.method === 'GET') {
    try {
      const reports = await getStoredReports();
      return res.status(200).json(reports);
    } catch (err) {
      return res.status(500).json({ error: 'Loi lay du lieu bao cao', details: err.message });
    }
  }

  // POST: Cap nhat / Dong bo bao cao tu client (dien thoai 4G hoac may tinh)
  if (req.method === 'POST') {
    try {
      let currentReports = await getStoredReports();
      if (!Array.isArray(currentReports)) currentReports = [];

      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const action = payload.action || 'upsert';

      if (action === 'overwrite' || Array.isArray(payload)) {
        currentReports = Array.isArray(payload) ? payload : (payload.reports || []);
      } else if (action === 'clear_all') {
        currentReports = [];
      } else if (action === 'clear_week' && payload.employeeName && payload.week) {
        const emp = payload.employeeName;
        const wk = String(payload.week);
        currentReports = currentReports.filter(r => !(r.employeeName === emp && String(r.week) === wk));
      } else if (action === 'clear_employee' && payload.employeeName) {
        const emp = payload.employeeName;
        currentReports = currentReports.filter(r => r.employeeName !== emp);
      } else if (action === 'delete' && (payload.id || payload.reportId)) {
        const delId = payload.id || payload.reportId;
        currentReports = currentReports.filter(r => r.id !== delId);
      } else if (action === 'upsert' && payload.reports && Array.isArray(payload.reports)) {
        const map = new Map();
        currentReports.forEach(r => { if (r.id) map.set(r.id, r); });
        payload.reports.forEach(r => { if (r.id) map.set(r.id, r); });
        currentReports = Array.from(map.values());
      }

      await saveStoredReports(currentReports);

      return res.status(200).json({
        status: 'ok',
        count: currentReports.length,
        reports: currentReports
      });
    } catch (err) {
      return res.status(500).json({ error: 'Loi cap nhat bao cao', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
