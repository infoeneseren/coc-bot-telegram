const Database = require('./src/services/database');
const readline = require('readline');

class BotSetup {
    constructor() {
        this.db = new Database();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async setup() {
        console.log('🛠️ Clash of Clans Bot Kurulumu Başlatılıyor...\n');
        
        try {
            // Bot Token
            const botToken = await this.askQuestion('🤖 Bot Token\'ını girin: ');
            await this.db.setConfig('bot_token', botToken);
            console.log('✅ Bot token kaydedildi\n');

            // CoC API Key
            const cocApiKey = await this.askQuestion('🔑 Clash of Clans API Key\'inizi girin: ');
            await this.db.setConfig('coc_api_key', cocApiKey);
            console.log('✅ CoC API key kaydedildi\n');

            // Klan Tag
            const clanTag = await this.askQuestion('🏰 Klan Tag\'ını girin (# ile birlikte): ');
            await this.db.setConfig('clan_tag', clanTag);
            console.log('✅ Klan tag kaydedildi\n');

            // Admin IDs
            const adminIds = await this.askQuestion('👥 Admin Telegram ID\'lerini girin (virgülle ayırın): ');
            await this.db.setConfig('admin_user_ids', adminIds);
            console.log('✅ Admin ID\'leri kaydedildi\n');

            // Bildirim Chat ID (opsiyonel)
            const enableNotifications = await this.askQuestion('🔔 Savaş bildirimleri aktif edilsin mi? (y/n): ');
            if (enableNotifications.toLowerCase() === 'y' || enableNotifications.toLowerCase() === 'yes') {
                const notificationChatId = await this.askQuestion('📢 Bildirim gönderilecek Chat ID\'yi girin: ');
                await this.db.setConfig('notification_chat_id', notificationChatId);
                console.log('✅ Bildirim chat ID kaydedildi\n');
            } else {
                console.log('⏭️ Bildirim sistemi atlandı\n');
            }

            console.log('🎉 Kurulum tamamlandı!');
            console.log('💡 Şimdi `npm start` ile botu başlatabilirsiniz.\n');

            // Konfigürasyon özetini göster
            await this.showConfigSummary();

        } catch (error) {
            console.error('❌ Kurulum hatası:', error);
        } finally {
            this.rl.close();
            this.db.close();
        }
    }

    askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async showConfigSummary() {
        console.log('📋 Konfigürasyon Özeti:');
        console.log('========================');
        
        const botToken = await this.db.getConfig('bot_token');
        const clanTag = await this.db.getConfig('clan_tag');
        const cocApiKey = await this.db.getConfig('coc_api_key');
        const notificationChatId = await this.db.getConfig('notification_chat_id');
        const adminUserIds = await this.db.getConfig('admin_user_ids');

        console.log(`🤖 Bot Token: ${botToken ? '✅ Ayarlandı' : '❌ Ayarlanmadı'}`);
        console.log(`🏰 Klan Tag: ${clanTag || '❌ Ayarlanmadı'}`);
        console.log(`🔑 CoC API Key: ${cocApiKey ? '✅ Ayarlandı' : '❌ Ayarlanmadı'}`);
        console.log(`📢 Bildirim Chat ID: ${notificationChatId || '❌ Ayarlanmadı'}`);
        console.log(`👥 Admin Sayısı: ${adminUserIds ? adminUserIds.split(',').length : 0}`);
        console.log('========================\n');
    }

    async updateConfig() {
        console.log('🔧 Konfigürasyon Güncelleme Modu\n');
        
        while (true) {
            console.log('Hangi ayarı güncellemek istiyorsunuz?');
            console.log('1. Bot Token');
            console.log('2. CoC API Key');
            console.log('3. Klan Tag');
            console.log('4. Admin ID\'leri');
            console.log('5. Bildirim Chat ID');
            console.log('6. Konfigürasyonu göster');
            console.log('0. Çıkış');
            
            const choice = await this.askQuestion('\nSeçiminizi yapın (0-6): ');
            
            switch (choice) {
                case '1':
                    const botToken = await this.askQuestion('🤖 Yeni Bot Token: ');
                    await this.db.setConfig('bot_token', botToken);
                    console.log('✅ Bot token güncellendi\n');
                    break;
                    
                case '2':
                    const cocApiKey = await this.askQuestion('🔑 Yeni CoC API Key: ');
                    await this.db.setConfig('coc_api_key', cocApiKey);
                    console.log('✅ CoC API key güncellendi\n');
                    break;
                    
                case '3':
                    const clanTag = await this.askQuestion('🏰 Yeni Klan Tag: ');
                    await this.db.setConfig('clan_tag', clanTag);
                    console.log('✅ Klan tag güncellendi\n');
                    break;
                    
                case '4':
                    const adminIds = await this.askQuestion('👥 Yeni Admin ID\'leri: ');
                    await this.db.setConfig('admin_user_ids', adminIds);
                    console.log('✅ Admin ID\'leri güncellendi\n');
                    break;
                    
                case '5':
                    const notificationChatId = await this.askQuestion('📢 Yeni Bildirim Chat ID: ');
                    await this.db.setConfig('notification_chat_id', notificationChatId);
                    console.log('✅ Bildirim chat ID güncellendi\n');
                    break;
                    
                case '6':
                    await this.showConfigSummary();
                    break;
                    
                case '0':
                    console.log('👋 Konfigürasyon güncelleme tamamlandı!');
                    return;
                    
                default:
                    console.log('❌ Geçersiz seçim! Lütfen 0-6 arası bir sayı girin.\n');
            }
        }
    }
}

// Komut satırı argümanlarını kontrol et
const args = process.argv.slice(2);
const setup = new BotSetup();

if (args.includes('--update') || args.includes('-u')) {
    setup.updateConfig();
} else {
    setup.setup();
} 