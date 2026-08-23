/**
 * backup.js - Hệ thống backup tự động mỗi 12 giờ
 * 
 * Backup bao gồm:
 *   - MongoDB dump (toàn bộ database)
 *   - File uploads (hình ảnh, tài liệu)
 *   - File .env (cấu hình)
 * 
 * Lưu vào: /backup/YYYY-MM-DD_HH-mm-ss/
 * Giữ tối đa 14 bản (7 ngày × 2 lần/ngày)
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backup');
const MAX_BACKUPS = 14; // Giữ tối đa 14 bản backup

// ── Tạo thư mục backup nếu chưa có ──────────────────────────────────────────
function ensureBackupDir(targetDir) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
}

// ── Copy thư mục đệ quy (cho uploads) ────────────────────────────────────────
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Xóa backup cũ nếu vượt quá MAX_BACKUPS ────────────────────────────────────
function cleanOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
    .sort(); // Sort theo tên = sort theo thời gian (vì dùng timestamp)

  const toDelete = backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS));
  for (const dir of toDelete) {
    const fullPath = path.join(BACKUP_DIR, dir);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`[Backup] 🗑️  Xóa backup cũ: ${dir}`);
  }
}

// ── Lấy thông tin kết nối MongoDB từ .env ────────────────────────────────────
function parseMongoUri(uri) {
  try {
    const url = new URL(uri);
    return {
      host: url.hostname || '127.0.0.1',
      port: url.port || '27017',
      dbName: url.pathname.replace('/', '') || 'webgov_daklak',
      username: url.username || '',
      password: url.password || '',
      authSource: url.searchParams.get('authSource') || 'admin'
    };
  } catch {
    return { host: '127.0.0.1', port: '27017', dbName: 'webgov_daklak', username: '', password: '', authSource: 'admin' };
  }
}

// ── HÀM CHÍNH: Thực hiện backup ──────────────────────────────────────────────
async function runBackup() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  
  const backupName = `backup_${timestamp}`;
  const targetDir = path.join(BACKUP_DIR, backupName);

  console.log(`\n[Backup] ⏳ Bắt đầu backup: ${backupName}`);
  const startTime = Date.now();

  try {
    ensureBackupDir(targetDir);

    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/webgov_daklak';
    const mongo = parseMongoUri(MONGO_URI);
    const dbDumpDir = path.join(targetDir, 'mongodb');

    // ── 1. MongoDB Dump ──────────────────────────────────────────────────────
    console.log(`[Backup] 📦 Đang dump MongoDB: ${mongo.dbName}...`);
    
    let mongodumpCmd;
    if (mongo.username && mongo.password) {
      // Có authentication
      mongodumpCmd = `mongodump --host ${mongo.host} --port ${mongo.port} --db ${mongo.dbName} --username ${mongo.username} --password "${mongo.password}" --authenticationDatabase ${mongo.authSource} --out "${dbDumpDir}"`;
    } else {
      mongodumpCmd = `mongodump --host ${mongo.host} --port ${mongo.port} --db ${mongo.dbName} --out "${dbDumpDir}"`;
    }

    try {
      const { stdout, stderr } = await execAsync(mongodumpCmd);
      if (stdout) console.log(`[Backup]    mongodump stdout: ${stdout}`);
      console.log(`[Backup] ✅ MongoDB dump hoàn tất → ${dbDumpDir}`);
    } catch (mongoErr) {
      // mongodump có thể không có trong PATH → fallback JSON export
      console.log(`[Backup] ⚠️  mongodump không khả dụng, dùng JSON export thay thế...`);
      await jsonExportFallback(mongo.dbName, path.join(targetDir, 'mongodb_json'));
    }

    // ── 2. Backup thư mục uploads ────────────────────────────────────────────
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const uploadsBackupDir = path.join(targetDir, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      console.log(`[Backup] 📁 Đang sao chép uploads...`);
      copyDirSync(uploadsDir, uploadsBackupDir);
      console.log(`[Backup] ✅ Uploads đã backup`);
    }

    // ── 3. Backup file .env ──────────────────────────────────────────────────
    const envFile = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envFile)) {
      fs.copyFileSync(envFile, path.join(targetDir, '.env.bak'));
      console.log(`[Backup] ✅ .env đã backup`);
    }

    // ── 4. Ghi metadata ─────────────────────────────────────────────────────
    const meta = {
      backupName,
      timestamp: now.toISOString(),
      mongoUri: MONGO_URI.replace(/:[^:@]+@/, ':***@'), // Ẩn password
      database: mongo.dbName,
      durationMs: Date.now() - startTime
    };
    fs.writeFileSync(path.join(targetDir, 'backup_info.json'), JSON.stringify(meta, null, 2));

    // ── 5. Xóa backup cũ ────────────────────────────────────────────────────
    cleanOldBackups();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Backup] 🎉 Backup hoàn tất trong ${duration}s → ${targetDir}\n`);
    return { success: true, path: targetDir, duration };

  } catch (err) {
    console.error(`[Backup] ❌ Lỗi backup: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── FALLBACK: Export JSON từng collection khi không có mongodump ──────────────
async function jsonExportFallback(dbName, outputDir) {
  const mongoose = require('mongoose');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const col of collections) {
    const colName = col.name;
    const docs = await db.collection(colName).find({}).toArray();
    const filePath = path.join(outputDir, `${colName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`[Backup]    📄 ${colName}: ${docs.length} documents`);
  }
  console.log(`[Backup] ✅ JSON export hoàn tất → ${outputDir}`);
}

// ── Lấy danh sách backup hiện có ─────────────────────────────────────────────
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
    .sort()
    .reverse()
    .map(name => {
      const infoPath = path.join(BACKUP_DIR, name, 'backup_info.json');
      let info = {};
      try { info = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch {}
      const size = getFolderSize(path.join(BACKUP_DIR, name));
      return { name, ...info, sizeMB: (size / 1024 / 1024).toFixed(1) };
    });
}

function getFolderSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) total += getFolderSize(fp);
    else total += fs.statSync(fp).size;
  }
  return total;
}

module.exports = { runBackup, listBackups, BACKUP_DIR };
