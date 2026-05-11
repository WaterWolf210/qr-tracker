const express = require('express');
const Database = require('better-sqlite3');
const geoip = require('geoip-lite');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();
const PORT = 3000;
const MEU_IP = '192.168.1.215';

const db = new Database('tracking.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_id     TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    ip        TEXT,
    country   TEXT,
    city      TEXT,
    device    TEXT,
    platform  TEXT
  )
`);

const insertScan = db.prepare(`
  INSERT INTO scans (qr_id, timestamp, ip, country, city, device, platform)
  VALUES (@qr_id, @timestamp, @ip, @country, @city, @device, @platform)
`);

const getStats = db.prepare('SELECT * FROM scans ORDER BY timestamp DESC');

function detectDevice(userAgent) {
  if (!userAgent) return 'Desconhecido';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac/i.test(userAgent)) return 'Mac';
  return 'Outro';
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/qr/:id', (req, res) => {
  const qrId = req.params.id;
  const destino = req.query.destino || 'https://google.com';
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const geo = geoip.lookup(ip);

  insertScan.run({
    qr_id:     qrId,
    timestamp: new Date().toISOString(),
    ip:        ip,
    country:   geo ? geo.country : 'Desconhecido',
    city:      geo ? geo.city : 'Desconhecida',
    device:    detectDevice(req.headers['user-agent']),
    platform:  req.headers['user-agent'] || ''
  });

  res.redirect(302, destino);
});

app.get('/api/stats', (req, res) => {
  res.json(getStats.all());
});

app.get('/api/gerar-qr', async (req, res) => {
  const id = req.query.id;
  const destino = req.query.destino;
  if (!id || !destino) {
    return res.status(400).json({ erro: 'Parametros em falta' });
  }
  const url = 'http://' + MEU_IP + ':' + PORT + '/qr/' + id + '?destino=' + encodeURIComponent(destino);
  try {
    const qr = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    res.json({ qr: qr, url: url });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar QR code' });
  }
});

app.listen(PORT, () => {
  console.log('Servidor em http://localhost:' + PORT);
  console.log('Dashboard: http://localhost:' + PORT + '/dashboard.html');
});