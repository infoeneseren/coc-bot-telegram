class VerificationService {
    constructor(bot, database, clashOfClansClient) {
        this.bot = bot;
        this.db = database;
        this.coc = clashOfClansClient;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Yeni üye katıldığında
        this.bot.on('new_chat_members', async (ctx) => {
            await this.handleNewMember(ctx);
        });

        // Doğrulama komutu
        this.bot.command('dogrula', async (ctx) => {
            await this.handleVerification(ctx);
        });
    }

    async handleNewMember(ctx) {
        const newMembers = ctx.message.new_chat_members;
        
        for (const member of newMembers) {
            if (member.is_bot) continue; // Botları atla
            
            const userId = member.id;
            const username = member.username;
            const firstName = member.first_name;
            
            // Zaten doğrulanmış kullanıcı mı?
            const isVerified = await this.db.isUserVerified(userId);
            if (isVerified) {
                continue; // Zaten doğrulanmış, mesaj gönderme
            }
            
            // Bekleyen doğrulama listesine ekle
            await this.db.addPendingVerification(userId, username, firstName);
            
            // Hoş geldin mesajı gönder
            const welcomeMessage = this.createWelcomeMessage(firstName, userId);
            
            try {
                await ctx.telegram.sendMessage(
                    ctx.chat.id,
                    welcomeMessage,
                    { 
                        parse_mode: 'Markdown',
                        reply_to_message_id: ctx.message.message_id
                    }
                );
                
                await this.db.setPendingWelcomeMessageSent(userId);
                console.log(`✅ Hoş geldin mesajı gönderildi: ${firstName} (${userId})`);
            } catch (error) {
                console.error('❌ Hoş geldin mesajı gönderilemedi:', error);
            }
        }
    }

    createWelcomeMessage(firstName, userId) {
        return `🎉 **Hoş geldin ${firstName}!** 🎉

Clash of Clans klanımıza katıldığın için teşekkürler! 

⚠️ **ÖNEMLİ:** Bot komutlarını kullanabilmek için önce hesabını doğrulaman gerekiyor.

🔗 **Nasıl doğrularım?**
1️⃣ \`/dogrula\` komutunu kullan
2️⃣ Klandaki CoC hesabını seç
3️⃣ Doğrulama tamamlandıktan sonra tüm bot özelliklerini kullanabilirsin!

💡 **İpucu:** Birden fazla köyün varsa, hepsini eşleyebilirsin!

👤 **Kullanıcı ID:** \`${userId}\`

Herhangi bir sorun yaşarsan admin ekibimizle iletişime geçebilirsin! 🤝`;
    }

    async handleVerification(ctx) {
        const userId = ctx.from.id;
        const username = ctx.from.username;
        const firstName = ctx.from.first_name;
        
        try {
            // Kullanıcı zaten doğrulanmış mı?
            const isVerified = await this.db.isUserVerified(userId);
            if (isVerified) {
                const userMappings = await this.db.getUserMapping(userId);
                const mappingList = userMappings.map((mapping, index) => 
                    `${index + 1}. **${mapping.coc_player_name}** (\`${mapping.coc_player_tag}\`)`
                ).join('\n');
                
                ctx.replyWithMarkdown(`✅ **Zaten doğrulanmışsın!**

🏷️ **Eşlenmiş hesapların:**
${mappingList}

💡 Başka bir hesap eklemek istiyorsan tekrar \`/dogrula\` komutunu kullanabilirsin.`);
                return;
            }
            
            // Bekleyen doğrulama listesine ekle (eğer yoksa)
            await this.db.addPendingVerification(userId, username, firstName);
            
            // Klan üyelerini al
            const clanMembers = await this.getClanMembers();
            if (!clanMembers || clanMembers.length === 0) {
                ctx.reply('❌ Klan üyeleri alınamadı. Lütfen daha sonra tekrar deneyin.');
                return;
            }
            
            // Doğrulanmış oyuncuları filtrele
            const verifiedTags = await this.db.getVerifiedPlayerTags();
            const availableMembers = clanMembers.filter(member => 
                !verifiedTags.includes(member.tag)
            );
            
            if (availableMembers.length === 0) {
                ctx.replyWithMarkdown(`❌ **Doğrulama için müsait hesap bulunamadı!**

Tüm klan üyeleri zaten eşlenmiş durumda. 
Admin ekibiyle iletişime geçerek durumunu açıklayabilirsin.`);
                return;
            }
            
            // Doğrulama menüsü oluştur
            await this.showVerificationMenu(ctx, availableMembers, userId);
            
        } catch (error) {
            console.error('Doğrulama hatası:', error);
            ctx.reply('❌ Doğrulama sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        }
    }

    async getClanMembers() {
        try {
            const clanTag = await this.db.getConfig('clan_tag');
            if (!clanTag) {
                throw new Error('Klan etiketi yapılandırılmamış');
            }
            
            const clanData = await this.coc.clanByTag(clanTag);
            return clanData.memberList || [];
        } catch (error) {
            console.error('Klan üyeleri alınamadı:', error);
            return [];
        }
    }

    // Rol çevirisi
    translateRole(role) {
        const roleMap = {
            'leader': '👑 Lider',
            'coLeader': '⭐ Yrd. Lider', 
            'admin': '🛡️ Büyük',
            'member': '👤 Üye'
        };
        return roleMap[role] || role;
    }

    async showVerificationMenu(ctx, availableMembers, userId) {
        const memberButtons = [];
        
        // Her üyeyi tek satıra koy (daha iyi görünüm için)
        for (let i = 0; i < availableMembers.length; i++) {
            const member = availableMembers[i];
            const role = this.translateRole(member.role);
            
            // Button text: "İsim (Rol) - #TAG"
            const buttonText = `${member.name} (${role}) - ${member.tag}`;
            
            memberButtons.push([{
                text: buttonText,
                callback_data: `verify_${userId}_${member.tag.replace('#', '')}`
            }]);
        }
        
        // İptal butonu ekle
        memberButtons.push([{
            text: '❌ İptal',
            callback_data: `verify_cancel_${userId}`
        }]);
        
        const message = `🔍 **Hesap Doğrulama**

Aşağıdaki listeden **kendi CoC hesabını** seç:

⚠️ **DİKKAT:** Sadece gerçekten sana ait olan hesabı seç!
📱 **Toplam ${availableMembers.length} müsait hesap bulundu**

🏷️ **Hesap formatı:** İsim (Rol) - #TAG

📋 **Rol Açıklaması:**
👑 Lider • ⭐ Yrd. Lider • 🛡️ Admin • 👤 Üye`;
        
        await ctx.replyWithMarkdown(message, {
            reply_markup: {
                inline_keyboard: memberButtons
            }
        });
    }

    setupCallbackHandlers() {
        // Doğrulama callback'lerini işle
        this.bot.action(/^verify_(\d+)_([A-Z0-9]+)$/, async (ctx) => {
            await this.handleVerificationCallback(ctx);
        });
        
        // İptal callback'ini işle
        this.bot.action(/^verify_cancel_(\d+)$/, async (ctx) => {
            await this.handleCancelCallback(ctx);
        });
    }

    async handleVerificationCallback(ctx) {
        const callbackUserId = parseInt(ctx.match[1]);
        const playerTagWithoutHash = ctx.match[2];
        const playerTag = '#' + playerTagWithoutHash;
        const currentUserId = ctx.from.id;
        
        // Sadece kendi doğrulamasını yapabilir
        if (currentUserId !== callbackUserId) {
            await ctx.answerCbQuery('❌ Sadece kendi hesabını doğrulayabilirsin!');
            return;
        }
        
        try {
            // Oyuncu bilgilerini al
            const playerData = await this.coc.playerByTag(playerTag);
            if (!playerData) {
                await ctx.answerCbQuery('❌ Oyuncu bilgileri alınamadı!');
                return;
            }
            
            // Eşlemeyi kaydet
            await this.db.addUserMapping(
                currentUserId,
                ctx.from.username,
                ctx.from.first_name,
                playerTag,
                playerData.name
            );
            
            // Bekleyen doğrulamayı kaldır
            await this.db.removePendingVerification(currentUserId);
            
            const successMessage = `✅ **Doğrulama Başarılı!**

🎉 Hesabın başarıyla eşlendi:
👤 **Oyuncu:** ${playerData.name}
🏷️ **Tag:** \`${playerTag}\`
🏆 **Seviye:** ${playerData.expLevel}
🏰 **Belediye Binası:** ${playerData.townHallLevel}

Artık tüm bot komutlarını kullanabilirsin! 🚀

💡 **İpucu:** Başka hesapların da varsa, tekrar \`/dogrula\` komutunu kullanarak ekleyebilirsin.`;
            
            await ctx.editMessageText(successMessage, { parse_mode: 'Markdown' });
            await ctx.answerCbQuery('✅ Doğrulama tamamlandı!');
            
            console.log(`✅ Kullanıcı doğrulandı: ${ctx.from.first_name} (${currentUserId}) -> ${playerData.name} (${playerTag})`);
            
        } catch (error) {
            console.error('Doğrulama callback hatası:', error);
            await ctx.answerCbQuery('❌ Doğrulama sırasında hata oluştu!');
            await ctx.editMessageText('❌ Doğrulama sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        }
    }

    async handleCancelCallback(ctx) {
        const callbackUserId = parseInt(ctx.match[1]);
        const currentUserId = ctx.from.id;
        
        if (currentUserId !== callbackUserId) {
            await ctx.answerCbQuery('❌ Bu işlemi sadece sen iptal edebilirsin!');
            return;
        }
        
        await ctx.editMessageText('❌ **Doğrulama iptal edildi.**\n\nİstediğin zaman tekrar `/dogrula` komutunu kullanabilirsin.', {
            parse_mode: 'Markdown'
        });
        await ctx.answerCbQuery('İptal edildi');
    }

    // Middleware: Doğrulanmış kullanıcı kontrolü
    createVerificationMiddleware() {
        return async (ctx, next) => {
            const userId = ctx.from.id;
            
            // Admin kontrolü - adminler doğrulama olmadan komut kullanabilir
            const isAdmin = await this.db.isAdmin(userId);
            if (isAdmin) {
                return next();
            }
            
            // start, help, dogrula komutları için doğrulama gerektirmeyen
            const exemptCommands = ['start', 'help', 'dogrula', 'yardim'];
            const command = ctx.message?.text?.split(' ')[0]?.replace('/', '');
            
            if (exemptCommands.includes(command)) {
                return next();
            }
            
            // Doğrulanmış kullanıcı mı?
            const isVerified = await this.db.isUserVerified(userId);
            if (!isVerified) {
                const warningMessage = `⚠️ **Hesap Doğrulama Gerekli!**

Bu komutu kullanabilmek için önce hesabını doğrulaman gerekiyor.

🔗 **Doğrulama yapmak için:** \`/dogrula\` komutunu kullan

💡 Doğrulama işlemi sadece birkaç saniye sürer ve klandaki CoC hesabınla eşleme yapar.`;
                
                ctx.replyWithMarkdown(warningMessage);
                return; // next() çağırma, komut çalışmasın
            }
            
            return next();
        };
    }
}

module.exports = VerificationService; 