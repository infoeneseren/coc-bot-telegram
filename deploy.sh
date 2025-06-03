#!/bin/bash

# CoC Telegram Bot Deployment Script

echo "🚀 CoC Telegram Bot deployment başlıyor..."

# Bot'u durdur
echo "⏹️  Bot durduruluyor..."
sudo systemctl stop telegram-bot 2>/dev/null || echo "Bot zaten durdurulmuş"

# Güncel kodu çek
echo "📥 Güncel kod çekiliyor..."
git pull origin main

# Dependencies'leri güncelle
echo "📦 Dependencies güncelleniyor..."
npm install --production

# Database dosyasına doğru izinleri ver
echo "🔐 Database izinleri ayarlanıyor..."
touch bot.db
chmod 664 bot.db
chown ubuntu:ubuntu bot.db

# Systemd service dosyasını kopyala
echo "⚙️  Systemd service güncelleniniyor..."
sudo cp telegram-bot.service /etc/systemd/system/
sudo systemctl daemon-reload

# Bot'u başlat
echo "▶️  Bot başlatılıyor..."
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot

# Status kontrol
echo "📊 Bot durumu kontrol ediliyor..."
sleep 2
sudo systemctl status telegram-bot --no-pager

# Log'ları takip et
echo "📝 Son log'lar:"
sudo journalctl -u telegram-bot --no-pager -n 20

echo "✅ Deployment tamamlandı!"
echo "📋 Komutlar:"
echo "  - Status: sudo systemctl status telegram-bot"
echo "  - Logs: sudo journalctl -f -u telegram-bot"
echo "  - Restart: sudo systemctl restart telegram-bot" 