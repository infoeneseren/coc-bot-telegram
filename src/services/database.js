const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        const dbPath = path.join(__dirname, '../../bot.db');
        this.db = new sqlite3.Database(dbPath);
        this.initializeTables();
    }

    initializeTables() {
        // Konfigürasyon tablosu
        this.db.run(`
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Kullanıcı eşleme tablosu (Telegram <-> CoC hesabı)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_mapping (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_user_id INTEGER NOT NULL,
                telegram_username TEXT,
                telegram_first_name TEXT,
                coc_player_tag TEXT NOT NULL,
                coc_player_name TEXT,
                is_verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                verified_at DATETIME,
                UNIQUE(telegram_user_id, coc_player_tag)
            )
        `);

        // Bildirim geçmişi tablosu
        this.db.run(`
            CREATE TABLE IF NOT EXISTS notification_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notification_type TEXT NOT NULL,
                war_tag TEXT,
                message_content TEXT,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                chat_id TEXT NOT NULL,
                UNIQUE(notification_type, war_tag)
            )
        `);

        // Bekleyen doğrulama tablosu
        this.db.run(`
            CREATE TABLE IF NOT EXISTS pending_verifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_user_id INTEGER NOT NULL UNIQUE,
                telegram_username TEXT,
                telegram_first_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                welcome_message_sent INTEGER DEFAULT 0
            )
        `);

        console.log('✅ Veritabanı tabloları hazırlandı');
    }

    // Konfigürasyon metodları
    async getConfig(key) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });
    }

    async setConfig(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, value],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Admin kontrolü
    async isAdmin(telegramUserId) {
        const adminIds = await this.getConfig('admin_user_ids');
        if (!adminIds) return false;
        return adminIds.split(',').includes(telegramUserId.toString());
    }

    // Bildirim geçmişi metodları
    async hasNotificationSent(notificationType, warTag) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id FROM notification_history WHERE notification_type = ? AND war_tag = ?',
                [notificationType, warTag],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    async addNotificationHistory(notificationType, warTag, messageContent, chatId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR IGNORE INTO notification_history (notification_type, war_tag, message_content, chat_id) VALUES (?, ?, ?, ?)',
                [notificationType, warTag, messageContent, chatId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Kullanıcı eşleme metodları
    async getUserMapping(telegramUserId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM user_mapping WHERE telegram_user_id = ? AND is_verified = 1',
                [telegramUserId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async addUserMapping(telegramUserId, telegramUsername, telegramFirstName, cocPlayerTag, cocPlayerName) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO user_mapping (telegram_user_id, telegram_username, telegram_first_name, coc_player_tag, coc_player_name, is_verified, verified_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)',
                [telegramUserId, telegramUsername, telegramFirstName, cocPlayerTag, cocPlayerName],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async isUserVerified(telegramUserId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT COUNT(*) as count FROM user_mapping WHERE telegram_user_id = ? AND is_verified = 1',
                [telegramUserId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count > 0);
                }
            );
        });
    }

    async getVerifiedPlayerTags() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT DISTINCT coc_player_tag FROM user_mapping WHERE is_verified = 1',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.coc_player_tag));
                }
            );
        });
    }

    // Oyuncu tag'ine göre doğrulanmış kullanıcıyı al
    async getVerifiedUserByPlayerTag(playerTag) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT telegram_user_id, telegram_username, telegram_first_name, coc_player_name FROM user_mapping WHERE coc_player_tag = ? AND is_verified = 1',
                [playerTag],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Doğrulanmış tüm kullanıcıları al (player tag ile)
    async getAllVerifiedUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT telegram_user_id, telegram_username, telegram_first_name, coc_player_tag, coc_player_name FROM user_mapping WHERE is_verified = 1',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Bekleyen doğrulama metodları
    async addPendingVerification(telegramUserId, telegramUsername, telegramFirstName) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO pending_verifications (telegram_user_id, telegram_username, telegram_first_name, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                [telegramUserId, telegramUsername, telegramFirstName],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async setPendingWelcomeMessageSent(telegramUserId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE pending_verifications SET welcome_message_sent = 1 WHERE telegram_user_id = ?',
                [telegramUserId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async removePendingVerification(telegramUserId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM pending_verifications WHERE telegram_user_id = ?',
                [telegramUserId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    async isPendingVerification(telegramUserId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM pending_verifications WHERE telegram_user_id = ?',
                [telegramUserId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    async hasWelcomeMessageSent(telegramUserId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT welcome_message_sent FROM pending_verifications WHERE telegram_user_id = ?',
                [telegramUserId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.welcome_message_sent === 1 : false);
                }
            );
        });
    }

    // Veritabanını kapat
    close() {
        this.db.close();
    }
}

module.exports = Database; 