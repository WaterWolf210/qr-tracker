const express = require('express');
const Database = require('better-sqlite3');
const geoip = require('geoip-lite');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();
const PORT = 3000;
const BASE_URL = 'https://qr-tracker-5jm5.onrender.com';

const db = new Database('tracking.db');

db.exec('CREATE TABLE IF NOT EXISTS scans (id INTEGER PRIMARY KEY AUTOINCREMENT, qr_id TEXT NOT NULL, timestamp TEXT NOT NULL, ip TEXT, country TEXT, city TEXT, device TEXT, platform TEXT)');

const insertScan = db.prepare('INSERT INTO scans (qr_id, timestamp, ip, country, city, device, platform) VALUES (@qr_id, @timestamp, @ip, @country, @city, @device, @platform)');

const getStats = db.prepare('SELECT * FROM scans ORDER BY timestamp DESC');

function detectDevice(ua) {
  if (!ua) return 'Desconhecido';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  return 'Outro';
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/qr/:id', function(req, res) {
  var ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  var geo = geoip.lookup(ip);
  insertScan.run({
    qr_id: req.params.id,
    timestamp: new Date().toISOString(),
    ip: ip,
    country: geo ? geo.country : 'Desconhecido',
    city: geo ? geo.city : 'Desconhecida',
    device: detectDevice(req.headers['user-agent']),
    platform: req.headers['user-agent'] || ''
  });
  res.redirect(302, req.query.destino || 'https://google.com');
});

app.get('/api/stats', function(req, res) {
  res.json(getStats.all());
});

app.get('/api/gerar-qr', function(req, res) {
  var id = req.query.id;
  var destino = req.query.destino;
  if (!id || !destino) {
    return res.status(400).json({ erro: 'Parametros em falta' });
  }
  var url = BASE_URL + '/qr/' + id + '?destino=' + encodeURIComponent(destino);
  QRCode.toDataURL(url, { width: 400, margin: 2 }, function(err, qr) {
    if (err) return res.status(500).json({ erro: 'Erro ao gerar QR code' });
    res.json({ qr: qr, url: url });
  });
});

app.listen(PORT, function() {
  console.log('Servidor em http://localhost:' + PORT);
});