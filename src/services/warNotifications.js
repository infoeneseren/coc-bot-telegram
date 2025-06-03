const cron = require('node-cron');
const { escapeHtml, parseApiDate } = require('../utils/helpers');
const clan = require('../callbacks/clan');

class WarNotificationService {
    constructor(clashOfClansClient, bot, chatId, database) {
        this.clashOfClansClient = clashOfClansClient;
        this.bot = bot;
        this.chatId = chatId; // Bildirimlerin gönderileceği grup/kanal ID'si
        this.database = database; // Veritabanı referansı
        this.notificationState = {
            lastWarState: null,
            notificationsSent: {
                warFound: false,
                fifteenMinutesStart: false, // Tek başlangıç bildirimi - 15 dakika
                warStarted: false,
                oneHourEnd: false,
                thirtyMinutesEnd: false,
                fiveMinutesEnd: false,
                warEnded: false
            },
            lastWarEndTime: null,
            currentWarId: null // Benzersiz savaş ID'si
        };
        this.isRunning = false;
        this.apiErrorCount = 0; // API hata sayacı
        this.maxApiErrors = 3; // Maksimum ardışık hata sayısı
    }

    // Benzersiz savaş ID'si oluştur
    generateWarId(response) {
        if (!response.preparationStartTime) return null;
        
        // preparationStartTime + opponent tag kombinasyonu
        const opponentTag = response.opponent?.tag || 'unknown';
        const teamSize = response.teamSize || 0;
        return `${response.preparationStartTime}_${opponentTag}_${teamSize}`;
    }

    // Bildirim sistemi başlat
    start() {
        if (this.isRunning) {
            return;
        }
        
        // Her 3 dakikada bir kontrol et (API limitlerini korumak için)
        this.cronJob = cron.schedule('*/3 * * * *', async () => {
            await this.checkWarStatus();
        }, {
            scheduled: false
        });

        this.cronJob.start();
        this.isRunning = true;
        console.log('🔔 Bildirim sistemi başlatıldı (3 dakika aralıkla)');
    }

    // Bildirim sistemi durdur
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.isRunning = false;
            console.log('🔕 Bildirim sistemi durduruldu');
        }
    }

    // Savaş durumunu kontrol et
    async checkWarStatus() {
        try {
            const clanTag = await this.database.getConfig('clan_tag');
            if (!clanTag) {
                console.error('❌ Klan tag\'i yapılandırılmamış');
                return;
            }

            const response = await this.clashOfClansClient.clanCurrentWarByTag(clanTag);
            const clanName = await clan.getClanName(this.clashOfClansClient);
            
            // API çağrısı başarılı, hata sayacını sıfırla
            this.apiErrorCount = 0;
            
            // Yeni savaş mı kontrol et
            const currentWarId = this.generateWarId(response);
            if (currentWarId && currentWarId !== this.notificationState.currentWarId) {
                console.log(`🆕 Yeni savaş tespit edildi: ${currentWarId}`);
                // Önce state'i temizle
                this.resetNotificationState();
                this.notificationState.lastWarState = null;
                // Sonra yeni war ID'yi set et
                this.notificationState.currentWarId = currentWarId;
                // Son olarak notification history'yi yükle
                await this.loadNotificationHistory(currentWarId);
                console.log('🔄 Yeni savaş için state temizlendi');
            }
            
            // Savaş durumu değişti mi kontrol et
            if (response.state !== this.notificationState.lastWarState) {
                console.log(`🔄 Savaş durumu değişti: ${this.notificationState.lastWarState} -> ${response.state}`);
                await this.handleStateChange(response, clanName);
            }

            // Savaşta ise zaman kontrolü yap
            if (response.state === 'preparation' || response.state === 'inWar') {
                await this.handleWarTimeChecks(response, clanName);
            }

            // Savaş bittiyse state'i güncelle
            if (response.state === 'warEnded' && this.notificationState.lastWarState !== 'warEnded') {
                console.log('🏁 Savaş sona erdi');
            }

            this.notificationState.lastWarState = response.state;

        } catch (error) {
            this.apiErrorCount++;
            console.error(`❌ Savaş durumu kontrolünde hata (${this.apiErrorCount}/${this.maxApiErrors}):`, error.message);
            
            // Çok fazla hata varsa sistemi geçici olarak durdur
            if (this.apiErrorCount >= this.maxApiErrors) {
                console.error('🚨 Çok fazla API hatası, bildirim sistemi geçici olarak durduruluyor...');
                setTimeout(() => {
                    this.apiErrorCount = 0;
                    console.log('🔄 API hata sayacı sıfırlandı, sistem normal çalışmaya devam ediyor');
                }, 300000); // 5 dakika bekle
            }
        }
    }

    // Bildirim geçmişini yükle
    async loadNotificationHistory(warId) {
        try {
            // Güncellenmiş bildirim tiplerini kontrol et
            const notificationTypes = [
                'warFound', 'fifteenMinutesStart', 'warStarted', 
                'oneHourEnd', 'thirtyMinutesEnd', 'fiveMinutesEnd', 'warEnded'
            ];

            for (const notificationType of notificationTypes) {
                const sent = await this.database.hasNotificationSent(notificationType, warId);
                this.notificationState.notificationsSent[notificationType] = sent;
            }

            console.log(`📋 Bildirim geçmişi yüklendi: ${warId}`);
        } catch (error) {
            console.error('❌ Bildirim geçmişi yüklenirken hata:', error);
        }
    }

    // Durum değişikliği işle
    async handleStateChange(response, clanName) {
        const safeOpponentName = escapeHtml(response.opponent?.name || 'Bilinmeyen Rakip');
        
        switch (response.state) {
            case 'preparation':
                if (!this.notificationState.notificationsSent.warFound) {
                    const message = this.createWarFoundMessage(response, clanName, safeOpponentName);
                    await this.sendNotification(message, 'warFound', this.notificationState.currentWarId);
                    this.notificationState.notificationsSent.warFound = true;
                }
                break;
                
            case 'inWar':
                if (!this.notificationState.notificationsSent.warStarted) {
                    const message = this.createWarStartedMessage(response, clanName, safeOpponentName);
                    await this.sendNotification(message, 'warStarted', this.notificationState.currentWarId);
                    this.notificationState.notificationsSent.warStarted = true;
                }
                break;
                
            case 'warEnded':
                if (!this.notificationState.notificationsSent.warEnded) {
                    const message = this.createWarEndedMessage(response, clanName, safeOpponentName);
                    await this.sendNotification(message, 'warEnded', this.notificationState.currentWarId);
                    this.notificationState.notificationsSent.warEnded = true;
                }
                break;
        }
    }

    // Zaman kontrollerini işle
    async handleWarTimeChecks(response, clanName) {
        const safeOpponentName = escapeHtml(response.opponent?.name || 'Bilinmeyen Rakip');
        
        // Savaş başlangıç zamanı kontrolü (preparation aşamasında) - Sadece 15 dakika
        if (response.state === 'preparation' && response.startTime) {
            await this.checkStartTimeWarning(
                response, 
                clanName, 
                safeOpponentName, 
                response.startTime
            );
        }
        
        // Savaş bitiş zamanı kontrolü (inWar aşamasında) - Saldırı yapmayanlarla
        if (response.state === 'inWar' && response.endTime) {
            await this.checkEndTimeWarnings(
                response, 
                clanName, 
                safeOpponentName, 
                response.endTime
            );
        }
    }

    // Savaş başlangıç zaman uyarısı (sadece 15 dakika)
    async checkStartTimeWarning(response, clanName, opponentName, targetTimeString) {
        const targetTime = parseApiDate(targetTimeString);
        if (!targetTime || isNaN(targetTime.getTime())) {
            console.warn('⚠️ Geçersiz tarih formatı:', targetTimeString);
            return;
        }

        const now = new Date();
        const timeDiff = targetTime.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeDiff / (1000 * 60));

        // Negatif süre kontrolü
        if (minutesLeft < 0) return;

        // 12-18 dakika arası (15 dakika bildirimi)
        if (minutesLeft >= 12 && minutesLeft <= 18 && !this.notificationState.notificationsSent.fifteenMinutesStart) {
            const message = this.createStartTimeWarningMessage(response, clanName, opponentName, minutesLeft);
            await this.sendNotification(message, 'fifteenMinutesStart', this.notificationState.currentWarId);
            this.notificationState.notificationsSent.fifteenMinutesStart = true;
            console.log(`⏰ 15 dakika başlangıç bildirimi gönderildi (${minutesLeft} dakika kaldı)`);
        }
    }

    // Savaş bitiş zaman uyarıları (saldırı yapmayanlarla)
    async checkEndTimeWarnings(response, clanName, opponentName, targetTimeString) {
        const targetTime = parseApiDate(targetTimeString);
        if (!targetTime || isNaN(targetTime.getTime())) {
            console.warn('⚠️ Geçersiz tarih formatı:', targetTimeString);
            return;
        }

        const now = new Date();
        const timeDiff = targetTime.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeDiff / (1000 * 60));

        // Negatif süre kontrolü
        if (minutesLeft < 0) return;

        // 45-75 dakika arası (1 saat bildirim)
        if (minutesLeft >= 45 && minutesLeft <= 75 && !this.notificationState.notificationsSent.oneHourEnd) {
            const message = await this.createEndTimeWarningMessage(response, clanName, opponentName, minutesLeft);
            await this.sendNotification(message, 'oneHourEnd', this.notificationState.currentWarId);
            this.notificationState.notificationsSent.oneHourEnd = true;
            console.log(`⏰ 1 saat bitiş bildirimi gönderildi (${minutesLeft} dakika kaldı)`);
        }

        // 25-35 dakika arası (30 dakika bildirim)
        if (minutesLeft >= 25 && minutesLeft <= 35 && !this.notificationState.notificationsSent.thirtyMinutesEnd) {
            const message = await this.createEndTimeWarningMessage(response, clanName, opponentName, minutesLeft);
            await this.sendNotification(message, 'thirtyMinutesEnd', this.notificationState.currentWarId);
            this.notificationState.notificationsSent.thirtyMinutesEnd = true;
            console.log(`⏰ 30 dakika bitiş bildirimi gönderildi (${minutesLeft} dakika kaldı)`);
        }

        // 3-7 dakika arası (5 dakika bildirim)
        if (minutesLeft >= 3 && minutesLeft <= 7 && !this.notificationState.notificationsSent.fiveMinutesEnd) {
            const message = await this.createEndTimeWarningMessage(response, clanName, opponentName, minutesLeft);
            await this.sendNotification(message, 'fiveMinutesEnd', this.notificationState.currentWarId);
            this.notificationState.notificationsSent.fiveMinutesEnd = true;
            console.log(`⏰ 5 dakika bitiş bildirimi gönderildi (${minutesLeft} dakika kaldı)`);
        }
    }

    // Saldırı yapmayan oyuncuları bul
    async getNonAttackers(warResponse) {
        try {
            if (!warResponse.clan || !warResponse.clan.members) {
                return [];
            }

            const nonAttackers = [];
            const totalAttacksPerMember = warResponse.attacksPerMember || 2;

            for (const member of warResponse.clan.members) {
                const attackCount = member.attacks ? member.attacks.length : 0;
                
                if (attackCount < totalAttacksPerMember) {
                    // Doğrulanmış kullanıcı bilgisini al
                    const verifiedUser = await this.database.getVerifiedUserByPlayerTag(member.tag);
                    
                    nonAttackers.push({
                        name: member.name,
                        tag: member.tag,
                        mapPosition: member.mapPosition,
                        attacksUsed: attackCount,
                        attacksRemaining: totalAttacksPerMember - attackCount,
                        telegramUser: verifiedUser || null
                    });
                }
            }

            // Map pozisyonuna göre sırala
            nonAttackers.sort((a, b) => a.mapPosition - b.mapPosition);
            return nonAttackers;

        } catch (error) {
            console.error('❌ Saldırı yapmayan oyuncuları alırken hata:', error);
            return [];
        }
    }

    // Savaş başlangıç zaman uyarı mesajı (15 dakika)
    createStartTimeWarningMessage(response, clanName, opponentName, minutesLeft) {
        return `⚠️ **SAVAŞ ${this.formatTimeLeft(minutesLeft).toUpperCase()} SONRA BAŞLIYOR!** ⚠️

🏰 **${clanName}** vs **${opponentName}**

📊 **Mevcut Durum:**
🔵 Takım Büyüklüğü: ${response.teamSize} vs ${response.teamSize}
🏆 Bizim yıldız: ${response.clan?.stars || 0}
⭐ Rakip yıldız: ${response.opponent?.stars || 0}

⚔️ **Hazırlıklarınızı tamamlayın!**
💡 Saldırı planlarınızı yapın ve savunma stratejilerinizi gözden geçirin!`;
    }

    // Savaş bitiş zaman uyarı mesajı (saldırı yapmayanlarla)
    async createEndTimeWarningMessage(response, clanName, opponentName, minutesLeft) {
        const warningIcon = minutesLeft <= 5 ? '🚨' : minutesLeft <= 30 ? '⚠️' : '⏰';
        const urgencyText = minutesLeft <= 5 ? 'SON' : '';
        
        let message = `${warningIcon} **SAVAŞ ${urgencyText} ${this.formatTimeLeft(minutesLeft).toUpperCase()} SONRA BİTİYOR!** ${warningIcon}

🏰 **${clanName}** vs **${opponentName}**

📊 **Mevcut Durum:**
🏆 Bizim yıldız: ${response.clan?.stars || 0}
⭐ Rakip yıldız: ${response.opponent?.stars || 0}
💥 Bizim saldırı: ${response.clan?.attacks || 0}/${response.attacksPerMember * response.teamSize}
🛡️ Rakip saldırı: ${response.opponent?.attacks || 0}/${response.attacksPerMember * response.teamSize}`;

        // Saldırı yapmayanları ekle
        const nonAttackers = await this.getNonAttackers(response);
        
        if (nonAttackers.length > 0) {
            message += `\n\n🚨 **SALDIRI YAPMAYAN ÜYELERİMİZ** (${nonAttackers.length} kişi):`;
            
            let verifiedCount = 0;
            let unverifiedCount = 0;
            
            for (const member of nonAttackers.slice(0, 15)) { // İlk 15 kişi (mesaj limiti için)
                const positionText = `#${member.mapPosition}`;
                const attackText = `${member.attacksUsed}/${member.attacksUsed + member.attacksRemaining}`;
                
                if (member.telegramUser) {
                    const telegramName = member.telegramUser.telegram_first_name || 'Bilinmeyen';
                    const username = member.telegramUser.telegram_username ? `@${member.telegramUser.telegram_username}` : '';
                    message += `\n${positionText} ${member.name} (${attackText}) - ${telegramName} ${username}`;
                    verifiedCount++;
                } else {
                    message += `\n${positionText} ${member.name} (${attackText}) - ❌ Doğrulanmamış`;
                    unverifiedCount++;
                }
            }
            
            if (nonAttackers.length > 15) {
                message += `\n... ve ${nonAttackers.length - 15} kişi daha`;
            }
            
            message += `\n\n📊 **Özet:** ✅ ${verifiedCount} doğrulanmış, ❌ ${unverifiedCount} doğrulanmamış`;
        } else {
            message += `\n\n🎉 **TÜM ÜYELERİMİZ SALDIRDI!** 🎉`;
        }

        message += `\n\n🔥 **${minutesLeft <= 5 ? 'SON DAKİKA!' : 'HALA VAKIT VAR!'} Son saldırılarınızı yapın!**`;
        
        return message;
    }

    // Kalan süreyi formatla
    formatTimeLeft(minutes) {
        if (minutes <= 0) return 'Süre doldu';
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            if (remainingMinutes > 0) {
                return `${hours} saat ${remainingMinutes} dakika`;
            } else {
                return `${hours} saat`;
            }
        } else {
            return `${remainingMinutes} dakika`;
        }
    }

    // Savaş bulundu mesajı - sadeleştirildi
    createWarFoundMessage(response, clanName, opponentName) {
        const startDate = parseApiDate(response.startTime);
        
        let timeLeftMessage = '';
        if (startDate) {
            const now = new Date();
            const timeDiff = startDate.getTime() - now.getTime();
            const minutesLeft = Math.floor(timeDiff / (1000 * 60));
            if (minutesLeft > 0) {
                timeLeftMessage = `⏰ ${this.formatTimeLeft(minutesLeft)} sonra başlayacak`;
            }
        }
        
        return `🚨 **SAVAŞ BULUNDU!** 🚨

🏰 **${clanName}** vs **${opponentName}**

📊 **Detaylar:**
🔵 Bizim takım: ${response.teamSize} vs ${response.teamSize}
🏆 Bizim yıldız: ${response.clan?.stars || 0}
⭐ Rakip yıldız: ${response.opponent?.stars || 0}

${timeLeftMessage}

💪 Hadi bakalım, savaşa hazırlanın! 🗡️`;
    }

    // Savaş başladı mesajı
    createWarStartedMessage(response, clanName, opponentName) {
        const endDate = parseApiDate(response.endTime);
        
        let timeLeftMessage = '';
        if (endDate) {
            const now = new Date();
            const timeDiff = endDate.getTime() - now.getTime();
            const minutesLeft = Math.floor(timeDiff / (1000 * 60));
            if (minutesLeft > 0) {
                timeLeftMessage = `⏰ ${this.formatTimeLeft(minutesLeft)} süreniz var!`;
            }
        }

        return `⚔️ **SAVAŞ BAŞLADI!** ⚔️

🏰 **${clanName}** vs **${opponentName}**

📊 **Mevcut Durum:**
🏆 Bizim yıldız: ${response.clan?.stars || 0}
⭐ Rakip yıldız: ${response.opponent?.stars || 0}
💥 Bizim saldırı: ${response.clan?.attacks || 0}/${response.attacksPerMember * response.teamSize}
🛡️ Rakip saldırı: ${response.opponent?.attacks || 0}/${response.attacksPerMember * response.teamSize}

${timeLeftMessage}

🔥 Saldırılarınızı yapın! Klan için! 💪`;
    }

    // Savaş bitti mesajı
    createWarEndedMessage(response, clanName, opponentName) {
        const result = this.getWarResult(response);
        
        return `🏁 **SAVAŞ BİTTİ!** 🏁

🏰 **${clanName}** vs **${opponentName}**

📊 **Final Sonuçları:**
🏆 Bizim yıldız: ${response.clan?.stars || 0}
⭐ Rakip yıldız: ${response.opponent?.stars || 0}
💥 Bizim saldırı: ${response.clan?.attacks || 0}/${response.attacksPerMember * response.teamSize}
🛡️ Rakip saldırı: ${response.opponent?.attacks || 0}/${response.attacksPerMember * response.teamSize}
💰 Hasar: ${response.clan?.destructionPercentage || 0}% vs ${response.opponent?.destructionPercentage || 0}%

${result.icon} **${result.text}**

${result.isWin ? '🎉 Tebrikler! Harika savaş!' : '💪 Bir sonrakinde daha iyisini yapacağız!'}`;
    }

    // Savaş sonucunu belirle
    getWarResult(response) {
        const ourStars = response.clan?.stars || 0;
        const theirStars = response.opponent?.stars || 0;
        
        if (ourStars > theirStars) {
            return { icon: '🏆', text: 'ZAFER!', isWin: true };
        } else if (ourStars < theirStars) {
            return { icon: '😔', text: 'Mağlubiyet', isWin: false };
        } else {
            return { icon: '🤝', text: 'Beraberlik', isWin: false };
        }
    }

    // Bildirim gönder ve veritabanına kaydet
    async sendNotification(message, notificationType, warId) {
        try {
            await this.bot.telegram.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
            
            // Veritabanına kaydet
            if (this.database && notificationType && warId) {
                await this.database.addNotificationHistory(notificationType, warId, message, this.chatId);
            }
            
            console.log(`✅ Bildirim gönderildi: ${notificationType || 'Bilinmeyen'}`);
        } catch (error) {
            console.error('❌ Bildirim gönderim hatası:', error.message);
        }
    }

    // Bildirim durumlarını sıfırla
    resetNotificationState() {
        this.notificationState.notificationsSent = {
            warFound: false,
            fifteenMinutesStart: false, // Güncellenmiş bildirim türleri
            warStarted: false,
            oneHourEnd: false,
            thirtyMinutesEnd: false,
            fiveMinutesEnd: false,
            warEnded: false
        };
    }

    // Durum bilgisi al
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastWarState: this.notificationState.lastWarState,
            notificationsSent: { ...this.notificationState.notificationsSent },
            currentWarId: this.notificationState.currentWarId,
            chatId: this.chatId
        };
    }

    // Test bildirimi gönder
    async sendTestNotification() {
        try {
            const testMessage = `🧪 **TEST BİLDİRİMİ** 🧪

🔔 Bildirim sistemi çalışıyor!

📊 **Sistem Durumu:**
⚡ Durum: ${this.isRunning ? 'Aktif' : 'Pasif'}
🆔 Chat ID: ${this.chatId}
🕐 Test Zamanı: ${new Date().toLocaleString('tr-TR')}
🔄 API Hata Sayısı: ${this.apiErrorCount}/${this.maxApiErrors}

✅ Eğer bu mesajı görebiliyorsanız, bildirim sistemi düzgün çalışıyor!`;

            await this.bot.telegram.sendMessage(this.chatId, testMessage, { parse_mode: 'Markdown' });
            console.log('✅ Test bildirimi başarıyla gönderildi');
            return true;
        } catch (error) {
            console.error('❌ Test bildirimi gönderilirken hata:', error.message);
            return false;
        }
    }

    // Detaylı sistem durumu
    getDetailedStatus() {
        return {
            isRunning: this.isRunning,
            apiErrorCount: this.apiErrorCount,
            maxApiErrors: this.maxApiErrors,
            lastWarState: this.notificationState.lastWarState,
            currentWarId: this.notificationState.currentWarId,
            notificationsSent: { ...this.notificationState.notificationsSent },
            chatId: this.chatId,
            cronSchedule: '*/3 * * * *', // Her 3 dakika
            lastCheck: new Date().toLocaleString('tr-TR')
        };
    }

    // Bildirim sistemini manuel olarak tetikle (debug için)
    async forceCheck() {
        console.log('🔧 Manuel savaş durumu kontrolü başlatılıyor...');
        await this.checkWarStatus();
        console.log('🔧 Manuel kontrol tamamlandı');
    }
}

module.exports = WarNotificationService; 