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
        try {
            for (const newMember of ctx.message.new_chat_members) {
                // Bot kendisi eklendiyse işlem yapma
                if (newMember.is_bot) continue;
                
                const userId = newMember.id;
                const firstName = newMember.first_name || 'Kullanıcı';
                const username = newMember.username || null;
                
                // Doğrulanmış kullanıcı mı kontrol et
                const isVerified = await this.db.isUserVerified(userId);
                
                if (isVerified) {
                    // Doğrulanmış kullanıcı - hoş geldin mesajı
                    const welcomeMessage = `🎉 **Hoş geldin ${firstName}!** 

✅ Doğrulanmış bir klan üyesi olarak gruba katıldığın için teşekkürler!

🤖 Artık tüm bot komutlarını kullanabilirsin. İyi oyunlar! 🔥`;

                    await ctx.replyWithMarkdown(welcomeMessage);
                    console.log(`✅ Doğrulanmış kullanıcı gruba katıldı: ${firstName} (${userId})`);
                } else {
                    // Doğrulanmamış kullanıcı - bota yönlendir
                    const verificationNeededMessage = `👋 **Merhaba ${firstName}!**

⚠️ **Dikkat!** Bu gruba katılabilmek için önce hesabını doğrulaman gerekiyor.

🤖 **Lütfen önce bota mesaj at:**
👇 Aşağıdaki butona tıklayarak doğrulama işlemini tamamla:`;

                    const botButton = {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '🤖 Bota Git ve Doğrula', url: 'https://t.me/coc_dostluk_bot' }
                            ]]
                        }
                    };

                    await ctx.replyWithMarkdown(verificationNeededMessage, botButton);
                    console.log(`⚠️ Doğrulanmamış kullanıcı gruba katıldı: ${firstName} (${userId})`);
                }
            }
        } catch (error) {
            console.error('Yeni üye karşılama hatası:', error);
        }
    }

    createWelcomeMessage(firstName, userId) {
        return `🎉 **Hoş geldin ${firstName}!** 🎉

Clash of Clans klanımıza katıldığın için teşekkürler! 

⚠️ **ÖNEMLİ:** Bot komutlarını kullanabilmek için önce hesabını doğrulaman gerekiyor.

🔗 **Nasıl doğrularım?**
1️⃣ Aşağıdaki "🔐 Hesap Doğrula" butonuna tıkla
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
                
                const alreadyVerifiedMessage = `✅ **Zaten doğrulanmışsın!**

🏷️ **Eşlenmiş hesapların:**
${mappingList}

📋 **Seçeneklerin:**
🏰 **Gruba Katıl:** ${await this.getClanName()} grubuna katılabilirsin
➕ **Başka Hesap Ekle:** Birden fazla hesabın varsa ekleyebilirsin`;

                const verifiedButtons = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🏰 Gruba Katıl', url: 'https://t.me/cocDostluk' }
                            ],
                            [
                                { text: '➕ Başka Hesap Ekle', callback_data: `start_verification_${userId}` }
                            ]
                        ]
                    }
                };

                ctx.replyWithMarkdown(alreadyVerifiedMessage, verifiedButtons);
                return;
            }
            
            // Bekleyen doğrulama listesine ekle (eğer yoksa)
            await this.db.addPendingVerification(userId, username, firstName);
            
            // Doğrulama işlemini başlat
            await this.startVerificationProcess(ctx, userId);
            
        } catch (error) {
            console.error('Doğrulama hatası:', error);
            ctx.reply('❌ Doğrulama sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        }
    }

    async startVerificationProcess(ctx, userId) {
        try {
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
            console.error('Doğrulama başlatma hatası:', error);
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

    async getClanName() {
        try {
            const clanTag = await this.db.getConfig('clan_tag');
            if (!clanTag) {
                return 'Klan';
            }
            
            const clanData = await this.coc.clanByTag(clanTag);
            return clanData.name || 'Klan';
        } catch (error) {
            console.error('Klan adı alınamadı:', error);
            return 'Klan';
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
        // Doğrulama başlatma callback'i
        this.bot.action(/^start_verification_(\d+)$/, async (ctx) => {
            const callbackUserId = parseInt(ctx.match[1]);
            const currentUserId = ctx.from.id;
            
            // Sadece kendi doğrulamasını başlatabilir
            if (currentUserId !== callbackUserId) {
                await ctx.answerCbQuery('❌ Sadece kendi hesabını doğrulayabilirsin!');
                return;
            }
            
            await ctx.answerCbQuery('🔍 Doğrulama başlatılıyor...');
            await this.startVerificationProcess(ctx, currentUserId);
        });

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
            
            // Cache'i temizle ve doğrulamayı kontrol et
            console.log(`🔄 Doğrulama sonrası kullanıcı kontrol ediliyor: ${currentUserId}`);
            const isNowVerified = await this.db.isUserVerified(currentUserId);
            console.log(`✅ Doğrulama durumu: ${isNowVerified ? 'Doğrulanmış' : 'Henüz doğrulanmamış'}`);
            
            const successMessage = `✅ **Doğrulama Başarılı!**

🎉 **Hesabın başarıyla eşlendi:**
👤 **Oyuncu:** ${playerData.name}
🏷️ **Tag:** \`${playerTag}\`
🏆 **Seviye:** ${playerData.expLevel}
🏰 **Belediye Binası:** ${playerData.townHallLevel}

🎊 **Tebrikler!** Artık tüm bot komutlarını kullanabilirsin!

📋 **Seçeneklerin:**
🏰 **Gruba Katıl:** ${await this.getClanName()} grubuna katılabilirsin
➕ **Başka Hesap Ekle:** Birden fazla hesabın varsa ekleyebilirsin`;
            
            // Butonları sadeleştir ve URL formatını düzelt
            const successButtons = [
                [
                    { text: '🏰 Gruba Katıl', url: 'https://t.me/cocDostluk' }
                ],
                [
                    { text: '➕ Başka Hesap Ekle', callback_data: `start_verification_${currentUserId}` }
                ]
            ];
            
            await ctx.editMessageText(successMessage, { 
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: successButtons
                }
            });
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
        
        const cancelMessage = `❌ **Doğrulama iptal edildi.**

İstediğin zaman aşağıdaki butona tıklayarak tekrar doğrulama yapabilirsin.`;

        const retryButton = {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔐 Tekrar Doğrula', callback_data: `start_verification_${currentUserId}` }
                ]]
            }
        };
        
        await ctx.editMessageText(cancelMessage, {
            parse_mode: 'Markdown',
            reply_markup: retryButton
        });
        await ctx.answerCbQuery('İptal edildi');
    }

    // Middleware: Doğrulanmış kullanıcı kontrolü
    createVerificationMiddleware() {
        return async (ctx, next) => {
            const userId = ctx.from.id;
            const firstName = ctx.from.first_name || 'Kullanıcı';
            
            // start, help, dogrula komutları için doğrulama gerektirmeyen
            const exemptCommands = ['start', 'help', 'dogrula', 'yardim'];
            const command = ctx.message?.text?.split(' ')[0]?.replace('/', '');
            
            if (exemptCommands.includes(command)) {
                return next();
            }
            
            // Debug: Doğrulama durumunu kontrol et
            console.log(`🔍 Kullanıcı doğrulama kontrolü: ${firstName} (${userId})`);
            
            // Doğrulanmış kullanıcı mı?
            const isVerified = await this.db.isUserVerified(userId);
            console.log(`📊 Doğrulama durumu: ${isVerified ? 'Doğrulanmış ✅' : 'Doğrulanmamış ❌'}`);
            
            if (!isVerified) {
                const warningMessage = `⚠️ **Merhaba ${firstName}!**

Bu komutu kullanabilmek için önce hesabını doğrulaman gerekiyor.

🤖 **Lütfen önce bota özel mesaj at:**
👇 Aşağıdaki butona tıklayarak doğrulama işlemini tamamla:`;
                
                // Bot linki butonu - sadeleştirilmiş format
                const botButton = [
                    [
                        { text: '🤖 Bota Git ve Doğrula', url: 'https://t.me/coc_dostluk_bot' }
                    ]
                ];
                
                ctx.replyWithMarkdown(warningMessage, {
                    reply_markup: {
                        inline_keyboard: botButton
                    }
                });
                return; // next() çağırma, komut çalışmasın
            }
            
            console.log(`✅ Kullanıcı doğrulanmış, komut devam ediyor: ${firstName}`);
            return next();
        };
    }
}

module.exports = VerificationService; 