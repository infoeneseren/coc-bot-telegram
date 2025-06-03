const { Telegraf } = require('telegraf');
const Database = require('./src/services/database');
const VerificationService = require('./src/services/verificationService');

const clashApi = require('./src/services/clashApi');
const clan = require('./src/callbacks/clan');
const player = require('./src/callbacks/player');
const war = require('./src/callbacks/war');
const leagues = require('./src/callbacks/leagues');
const help = require('./src/callbacks/help');
const telegramReplies = require('./src/replies/telegram');
const WarNotificationService = require('./src/services/warNotifications');

// Veritabanını başlat
const database = new Database();

// Telegram init
let bot;
let clashOfClansClient;
let warNotificationService = null;
let verificationService = null;

// Bot'u başlat
async function initializeBot() {
	try {
		// Bottoken'ı db'den al
		const botToken = await database.getConfig('bot_token');
		if (!botToken) {
			console.error('❌ Bot token bulunamadı! Lütfen önce konfigürasyonu yapın.');
			console.log('💡 Konfigürasyon yapmak için setup.js dosyasını çalıştırın.');
			process.exit(1);
		}

		// Bot'u oluştur
		bot = new Telegraf(botToken);
		bot.catch((err, ctx) => console.error(`Hata oluştu ${ctx.updateType} için:`, err.message));

		// Clash of Clans API init
		clashOfClansClient = clashApi({ database: database });

		// Doğrulama servisini başlat
		verificationService = new VerificationService(bot, database, clashOfClansClient);
		verificationService.setupCallbackHandlers();

		// Doğrulama middleware'ini ekle (tüm komutlardan önce çalışacak)
		bot.use(verificationService.createVerificationMiddleware());

		// Savaş bildirim servisi
		const notificationChatId = await database.getConfig('notification_chat_id');
		if (notificationChatId) {
			warNotificationService = new WarNotificationService(
				clashOfClansClient, 
				bot, 
				notificationChatId,
				database // Veritabanı referansını ekle
			);
			warNotificationService.start();
		} else {
			console.log('⚠️ NOTIFICATION_CHAT_ID tanımlanmadı, savaş bildirimleri devre dışı');
		}

		console.log('✅ Bot başarıyla yapılandırıldı!');
		return true;
	} catch (error) {
		console.error('❌ Bot başlatma hatası:', error);
		return false;
	}
}

// Konfigürasyon komutu (sadece ilk kurulum için)
async function setupCommands() {
	const { Telegraf } = require('telegraf');
	const tempBot = new Telegraf('TEMP_TOKEN'); // Geçici token

	tempBot.command('setup', async (ctx) => {
		ctx.reply('🛠️ Kurulum modu aktif. Lütfen setup.js dosyasını kullanarak konfigürasyonu tamamlayın.');
	});
}

// Ana başlatma fonksiyonu
async function startBot() {
	const initialized = await initializeBot();
	if (!initialized) {
		console.log('❌ Bot başlatılamadı');
		return;
	}

	// Telegram commands
	bot.start(async (ctx) => {
		const userId = ctx.from.id;
		const firstName = ctx.from.first_name || 'Kullanıcı';
		
		// Debug: Kullanıcı bilgilerini logla
		console.log(`🚀 /start komutu: ${firstName} (${userId})`);
		
		// Doğrulama kontrolü (adminler dahil herkes doğrulama yapacak)
		const isVerified = await database.isUserVerified(userId);
		console.log(`📊 Start - Doğrulama durumu: ${isVerified ? 'Doğrulanmış ✅' : 'Doğrulanmamış ❌'}`);
		
		if (isVerified) {
			// Zaten doğrulanmış - gruba yönlendir
			const verifiedWelcome = `🎉 **Merhaba ${firstName}!**

✅ **Hesabın zaten doğrulanmış!** 

🏰 Artık **${await clan.getClanName(clashOfClansClient)}** grubumuzda tüm bot komutlarını kullanabilirsin!

👇 **Gruba katılmak için aşağıdaki butona tıkla:**`;

			const groupButton = [
				[
					{ text: '🏰 Gruba Katıl', url: 'https://t.me/cocDostluk/1' }
				]
			];

			ctx.replyWithMarkdown(verifiedWelcome, {
				reply_markup: {
					inline_keyboard: groupButton
				}
			});
		} else {
			// Henüz doğrulanmamış - doğrulama yap
			const welcomeMessage = `🎮 **${await clan.getClanName(clashOfClansClient)} Clash of Clans Bot**

👋 **Merhaba ${firstName}!** 

⚠️ **Gruba katılabilmek için önce hesabını doğrulaman gerekiyor.**

🔗 **Doğrulama Süreci:**
1️⃣ Aşağıdaki **🔐 Hesap Doğrula** butonuna tıkla
2️⃣ Klandaki CoC hesabını seç  
3️⃣ Doğrulama tamamlandıktan sonra gruba yönlendirileceksin!

💡 **Not:** Sadece ${await clan.getClanName(clashOfClansClient)} klan üyeleri gruba katılabilir.`;

			// Doğrulama butonu
			const verificationButton = [
				[
					{ text: '🔐 Hesap Doğrula', callback_data: `start_verification_${userId}` }
				]
			];

			ctx.replyWithMarkdown(welcomeMessage, {
				reply_markup: {
					inline_keyboard: verificationButton
				}
			});
		}
	});

	bot.help(async (ctx) => {
		const userId = ctx.from.id;
		const firstName = ctx.from.first_name || 'Kullanıcı';
		
		// Debug: Kullanıcı bilgilerini logla
		console.log(`❓ /help komutu: ${firstName} (${userId})`);
		
		// Doğrulama kontrolü (adminler dahil herkes doğrulama yapacak)
		const isVerified = await database.isUserVerified(userId);
		console.log(`📊 Help - Doğrulama durumu: ${isVerified ? 'Doğrulanmış ✅' : 'Doğrulanmamış ❌'}`);
		
		if (isVerified) {
			// Doğrulanmış kullanıcı - normal help mesajı
			const startMessage = await telegramReplies.getStarted(clashOfClansClient, ctx.from);
			ctx.replyWithHTML(startMessage);
		} else {
			// Henüz doğrulanmamış - doğrulama yap
			const helpMessage = `❓ **Yardım - ${await clan.getClanName(clashOfClansClient)} Bot**

👋 **Merhaba ${firstName}!** 

⚠️ **Bot komutlarını görebilmek için önce hesabını doğrulaman gerekiyor.**

🔗 **Doğrulama Süreci:**
1️⃣ Aşağıdaki **🔐 Hesap Doğrula** butonuna tıkla
2️⃣ Klandaki CoC hesabını seç  
3️⃣ Doğrulama tamamlandıktan sonra tüm komutları görebilirsin!

💡 **Not:** Sadece ${await clan.getClanName(clashOfClansClient)} klan üyeleri bot komutlarını kullanabilir.`;

			// Doğrulama butonu
			const verificationButton = [
				[
					{ text: '🔐 Hesap Doğrula', callback_data: `start_verification_${userId}` }
				]
			];

			ctx.replyWithMarkdown(helpMessage, {
				reply_markup: {
					inline_keyboard: verificationButton
				}
			});
		}
	});

	// ID komutu - kullanıcı bilgilerini göster
	bot.command('id', async (ctx) => {
		const user = ctx.from;
		const firstName = user.first_name || 'Kullanıcı';
		const lastName = user.last_name || '';
		const username = user.username ? `@${user.username}` : '';
		const fullName = lastName ? `${firstName} ${lastName}` : firstName;
		
		const message = `🆔 **Telegram Bilgilerin**

👤 **İsim:** ${fullName}
📱 **Username:** ${username || 'Yok'}
🔢 **Telegram ID:** \`${user.id}\`
🌐 **Dil:** ${user.language_code || 'Bilinmiyor'}

💡 **Bu bilgiler ne için kullanılır?**
• **Admin Ekleme:** Bot adminleri bu ID'yi kullanarak seni admin yapabilir
• **Destek:** Sorun yaşadığında bu ID'yi destek ekibine verebilirsin
• **Doğrulama:** Klan üyeliği doğrulaması için kullanılır

🔒 **Güvenlik:** ID'ni sadece güvendiğin kişilerle paylaş!`;

		ctx.replyWithMarkdown(message);
	});

	// Klan komutları
	bot.command('klan', async (ctx) => await clan.getClan(ctx, clashOfClansClient));
	bot.command('uyeler', async (ctx) => await clan.getClanMembers(ctx, clashOfClansClient));
	bot.command('baskinlar', async (ctx) => await clan.getCapitalRaidSeasons(ctx, clashOfClansClient));
	bot.command('baskin_sezonlari', async (ctx) => await clan.getCapitalRaidSeasons(ctx, clashOfClansClient));

	// Oyuncu komutu
	bot.command('oyuncu', async (ctx) => await player.getPlayer(ctx, clashOfClansClient));

	// Savaş komutları
	bot.command('savas', async (ctx) => await war.getCurrentWar(ctx, clashOfClansClient));
	bot.command('savas_analiz', async (ctx) => await war.getWarAnalysis(ctx, clashOfClansClient));
	bot.command('savas_saldirmayanlar', async (ctx) => await war.getNonAttackers(ctx, clashOfClansClient));
	bot.command('savas_gecmis', async (ctx) => await war.getWarLog(ctx, clashOfClansClient));
	bot.command('savas_lig', async (ctx) => await war.getWarLeague(ctx, clashOfClansClient));

	// Sıralama komutları
	bot.command('ligler', async (ctx) => await leagues.getWarLeagues(ctx, clashOfClansClient));
	bot.command('savas_ligleri', async (ctx) => await leagues.getRealWarLeagues(ctx, clashOfClansClient));
	bot.command('basken_ligleri', async (ctx) => await leagues.getCapitalLeagues(ctx, clashOfClansClient));
	bot.command('builder_ligleri', async (ctx) => await leagues.getBuilderBaseLeagues(ctx, clashOfClansClient));
	bot.command('legend_siralamasi', async (ctx) => await leagues.getLeagueSeasonRankings(ctx, clashOfClansClient));
	bot.command('tum_ligler', async (ctx) => await leagues.getAllLeaguesSummary(ctx, clashOfClansClient));

	// Genel sıralamar
	bot.command('klan_siralamasi', async (ctx) => await leagues.getClanRankings(ctx, clashOfClansClient));
	bot.command('oyuncu_siralamasi', async (ctx) => await leagues.getPlayerRankings(ctx, clashOfClansClient));

	// Builder Base sıralamaları
	bot.command('builder_oyuncu_siralama', async (ctx) => await leagues.getBuilderBasePlayerRankings(ctx, clashOfClansClient));
	bot.command('builder_klan_siralama', async (ctx) => await leagues.getBuilderBaseClanRankings(ctx, clashOfClansClient));

	// Başkent sıralaması
	bot.command('basken_siralama', async (ctx) => await leagues.getCapitalRankings(ctx, clashOfClansClient));
	bot.command('lokasyonlar', async (ctx) => await leagues.getAllLocations(ctx, clashOfClansClient));

	// Admin paneli
	bot.command('admin', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			console.log(`❌ Yetkisiz admin paneli erişimi: ${ctx.from.first_name} (${userId})`);
			ctx.reply('❌ Bu komut sadece adminler içindir.');
			return;
		}
		
		console.log(`✅ Admin paneli erişimi: ${ctx.from.first_name} (${userId})`);
		
		const clanName = await clan.getClanName(clashOfClansClient);
		const message = `🔧 **${clanName} - Admin Paneli**

👋 Merhaba Admin! Bu panelden bot yönetim işlemlerini yapabilirsin.

⚙️ **Sistem Bilgileri:**
• Bot Durumu: ✅ Aktif
• Bildirim Sistemi: ${warNotificationService ? '✅ Yapılandırılmış' : '❌ Yapılandırılmamış'}
• Admin ID: \`${userId}\`
• Veritabanı: ✅ SQLite

💡 **İpucu:** Aşağıdaki butonları kullanarak bot yönetimi yapabilirsin.`;
		
		const adminButtons = [
			[
				{ text: '🔔 Bildirim Durumu', callback_data: 'admin_notification_status' },
				{ text: '⚙️ Ayarları Görüntüle', callback_data: 'admin_show_config' }
			],
			[
				{ text: '🔧 Ayarları Düzenle', callback_data: 'admin_edit_config' }
			],
			[
				{ text: '🧪 Test Bildirimi', callback_data: 'admin_test_notification' }
			]
		];

		ctx.replyWithMarkdown(message, {
			reply_markup: {
				inline_keyboard: adminButtons
			}
		});
	});

	// Bildirim komutlarının alt çizgisiz versiyonları
	bot.command('bildirimbaslat', async (ctx) => {
		ctx.reply('💡 Bu komut henüz implementlenmedi. Yakında eklenecek!');
	});

	bot.command('bildirimdurdur', async (ctx) => {
		ctx.reply('💡 Bu komut henüz implementlenmedi. Yakında eklenecek!');
	});

	bot.command('bildirimtest', async (ctx) => {
		ctx.reply('💡 Bu komut henüz implementlenmedi. Yakında eklenecek!');
	});

	// Alt çizgisiz config komutları
	bot.command('bildirimdurum', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			console.log(`❌ Yetkisiz bildirim durum erişimi: ${ctx.from.first_name} (${userId})`);
			ctx.reply('❌ Bu komut sadece adminler içindir.');
			return;
		}
		
		if (!warNotificationService) {
			ctx.reply('❌ Savaş bildirim sistemi aktif değil.');
			return;
		}
		
		console.log(`✅ Bildirim durumu kontrolü: ${ctx.from.first_name} (${userId})`);
		
		const status = warNotificationService.getStatus();
		const message = `📊 **Savaş Bildirim Sistemi Durumu**

🔄 Durum: ${status.isRunning ? '✅ Aktif' : '❌ Pasif'}
📝 Son Savaş Durumu: ${status.lastWarState || 'Bilinmiyor'}

🔔 **Gönderilen Bildirimler:**

🚀 **Savaş Başlangıcı:**
• Savaş Bulundu: ${status.notificationsSent.warFound ? '✅' : '❌'}
• 15 Dakika Kaldı: ${status.notificationsSent.fifteenMinutesStart ? '✅' : '❌'}
• Savaş Başladı: ${status.notificationsSent.warStarted ? '✅' : '❌'}

⏰ **Savaş Bitişi:** (Saldırı yapmayanlar listeli)
• 1 Saat Kaldı: ${status.notificationsSent.oneHourEnd ? '✅' : '❌'}
• 30 Dakika Kaldı: ${status.notificationsSent.thirtyMinutesEnd ? '✅' : '❌'}
• 5 Dakika Kaldı: ${status.notificationsSent.fiveMinutesEnd ? '✅' : '❌'}

⏱️ Kontrol Sıklığı: Her 3 dakika
🔔 Toplam Bildirim Türü: 6 farklı bildirim (3 azaldı)
💾 Bildirim Geçmişi: SQLite Veritabanında
📱 Telegram Doğrulama: Saldırı yapmayanlarda görünür`;
		
		ctx.replyWithMarkdown(message);
	});

	bot.command('configgoster', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			ctx.reply('❌ Bu komut sadece adminler içindir.');
			return;
		}

		const botToken = await database.getConfig('bot_token');
		const clanTag = await database.getConfig('clan_tag');
		const cocApiKey = await database.getConfig('coc_api_key');
		const notificationChatId = await database.getConfig('notification_chat_id');
		const adminUserIds = await database.getConfig('admin_user_ids');

		const message = `⚙️ **Bot Konfigürasyonu**

🤖 **Bot Token:** ${botToken ? '✅ Ayarlanmış' : '❌ Ayarlanmamış'}
🏰 **Klan Tag:** ${clanTag ? `\`${clanTag}\`` : '❌ Ayarlanmamış'}
🔑 **CoC API Key:** ${cocApiKey ? '✅ Ayarlanmış' : '❌ Ayarlanmamış'}
📢 **Bildirim Chat ID:** ${notificationChatId ? `\`${notificationChatId}\`` : '❌ Ayarlanmamış'}
👥 **Admin ID'leri:** ${adminUserIds ? adminUserIds.split(',').length + ' admin' : '❌ Ayarlanmamış'}

💡 Ayarları değiştirmek için butonları kullanın.`;

		const configButtons = [
			[
				{ text: '🔧 Ayarları Düzenle', callback_data: 'admin_edit_config' }
			]
		];

		ctx.replyWithMarkdown(message, {
			reply_markup: {
				inline_keyboard: configButtons
			}
		});
	});

	bot.command('configduzenle', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			ctx.reply('❌ Bu komut sadece adminler içindir.');
			return;
		}

		const configButtons = [
			[
				{ text: '🤖 Bot Token', callback_data: 'config_edit_bot_token' },
				{ text: '🏰 Klan Tag', callback_data: 'config_edit_clan_tag' }
			],
			[
				{ text: '🔑 CoC API Key', callback_data: 'config_edit_coc_api_key' },
				{ text: '📢 Chat ID', callback_data: 'config_edit_notification_chat_id' }
			],
			[
				{ text: '👥 Admin ID\'leri', callback_data: 'config_edit_admin_user_ids' }
			],
			[
				{ text: '📋 Mevcut Ayarları Göster', callback_data: 'config_show_current' }
			],
			[
				{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
			]
		];

		const message = `⚙️ **Konfigürasyon Düzenleme**

Hangi ayarı düzenlemek istiyorsunuz?

🔧 **Düzenlenebilir Ayarlar:**
• Bot Token
• Klan Tag
• CoC API Key
• Bildirim Chat ID
• Admin ID'leri

💡 **İpucu:** Değişiklikleri yapmadan önce mevcut ayarları kontrol edebilirsin.`;

		ctx.replyWithMarkdown(message, {
			reply_markup: {
				inline_keyboard: configButtons
			}
		});
	});

	// Yardım komutları
	bot.command('yardim', async (ctx) => {
		const startMessage = await telegramReplies.getStarted(clashOfClansClient, ctx.from);
		ctx.replyWithHTML(startMessage);
	});
	bot.command('yardim_klan', async (ctx) => {
		const helpMessage = await help.getHelpClan(clashOfClansClient);
		ctx.replyWithHTML(helpMessage);
	});
	bot.command('yardim_oyuncu', (ctx) => ctx.replyWithHTML(help.getHelpPlayer()));
	bot.command('yardim_savas', async (ctx) => {
		const helpMessage = await help.getHelpWar(clashOfClansClient);
		ctx.replyWithHTML(helpMessage);
	});
	bot.command('yardim_lig', (ctx) => ctx.replyWithHTML(help.getHelpLeague()));
	bot.command('yardim_genel', async (ctx) => {
		const helpMessage = await help.getHelpGeneral(clashOfClansClient);
		ctx.replyWithHTML(helpMessage);
	});

	// Mesaj geldiğinde (# ile başlayan taglar için)
	bot.on('message', async (ctx) => {
		const { text } = ctx.message;
		const userId = ctx.from.id;

		// Manuel admin ekleme kontrolü
		if (bot.adminAddManualUsers && bot.adminAddManualUsers.has(userId)) {
			const userConfig = bot.adminAddManualUsers.get(userId);
			
			// 5 dakika kontrolü
			if (Date.now() - userConfig.timestamp > 300000) {
				bot.adminAddManualUsers.delete(userId);
				ctx.reply('⏰ Zaman aşımı! Lütfen tekrar deneyin.');
				return;
			}

			const newAdminId = text.trim();

			if (newAdminId.toLowerCase() === 'iptal') {
				bot.adminAddManualUsers.delete(userId);
				ctx.reply('❌ Manuel admin ekleme iptal edildi.');
				return;
			}

			// ID format kontrolü
			if (!/^\d+$/.test(newAdminId)) {
				ctx.reply('❌ **Geçersiz ID Formatı**\n\nLütfen sadece rakam girin. Örnek: `910484564`', {
					parse_mode: 'Markdown'
				});
				return;
			}

			try {
				// Mevcut adminleri al
				const currentAdmins = await database.getConfig('admin_user_ids');
				const adminIds = currentAdmins ? currentAdmins.split(',').map(id => id.trim()) : [];
				
				// Zaten admin mi kontrol et
				if (adminIds.includes(newAdminId)) {
					bot.adminAddManualUsers.delete(userId);
					ctx.reply('❌ **Bu kullanıcı zaten admin!**\n\nFarklı bir ID deneyin.');
					return;
				}
				
				// Admin ekle
				adminIds.push(newAdminId);
				await database.setConfig('admin_user_ids', adminIds.join(','));
				bot.adminAddManualUsers.delete(userId);
				
				// Kullanıcı bilgilerini almaya çalış
				let displayInfo = `ID: ${newAdminId}`;
				try {
					// Kullanıcı botla etkileşimde bulunmuşsa bilgilerini alabilir
					const userInfo = await ctx.telegram.getChat(newAdminId);
					if (userInfo.first_name) {
						displayInfo = userInfo.first_name + (userInfo.last_name ? ' ' + userInfo.last_name : '');
						if (userInfo.username) {
							displayInfo += ` (@${userInfo.username})`;
						}
						displayInfo += ` - ID: ${newAdminId}`;
					}
				} catch (error) {
					// Kullanıcı bilgileri alınamazsa sadece ID göster
				}
				
				const message = `✅ **Admin Eklendi**

👤 **Yeni Admin:** ${displayInfo}

🎉 Bu kullanıcı artık tüm bot komutlarını kullanabilir!

💡 **Not:** Kullanıcı henüz botla etkileşime geçmemişse sadece ID gösterilir.`;

				ctx.reply(message, {
					parse_mode: 'Markdown'
				});

				console.log(`✅ Manuel admin eklendi: ${displayInfo} tarafından ${ctx.from.first_name} (${userId})`);
				return;

			} catch (error) {
				console.error('Manuel admin ekleme hatası:', error);
				bot.adminAddManualUsers.delete(userId);
				ctx.reply('❌ Admin ekleme sırasında hata oluştu. Lütfen tekrar deneyin.');
				return;
			}
		}

		// Config düzenleme kontrolü
		if (bot.configEditUsers && bot.configEditUsers.has(userId)) {
			const userConfig = bot.configEditUsers.get(userId);
			
			// 5 dakika kontrolü
			if (Date.now() - userConfig.timestamp > 300000) {
				bot.configEditUsers.delete(userId);
				ctx.reply('⏰ Zaman aşımı! Lütfen tekrar deneyin.');
				return;
			}

			const configKey = userConfig.configKey;
			const newValue = text.trim();

			const configNames = {
				'bot_token': '🤖 Bot Token',
				'clan_tag': '🏰 Klan Tag',
				'coc_api_key': '🔑 CoC API Key',
				'notification_chat_id': '📢 Bildirim Chat ID',
				'admin_user_ids': '👥 Admin ID\'leri'
			};

			const configName = configNames[configKey] || configKey;

			if (newValue.toLowerCase() === 'iptal') {
				bot.configEditUsers.delete(userId);
				ctx.reply('❌ Config düzenleme iptal edildi.');
				return;
			}

			if (newValue.toLowerCase() === 'sil') {
				await database.setConfig(configKey, null);
				bot.configEditUsers.delete(userId);
				ctx.reply(`✅ ${configName} silindi.`);
				return;
			}

			// Değeri güncelle
			await database.setConfig(configKey, newValue);
			bot.configEditUsers.delete(userId);
			
			const displayValue = configKey === 'bot_token' || configKey === 'coc_api_key' 
				? '✅ Başarıyla ayarlandı' 
				: `\`${newValue}\``;
			
			ctx.reply(`✅ ${configName} güncellendi: ${displayValue}`);
			return;
		}

		// # ile başlayan tag kontrolü
		if (text && text.charAt(0) == '#') {
			const tag = text.substring(0, 10);
			ctx.reply(await player.playerMessage(tag, clashOfClansClient));
		}
	});

	// Verification service callback'lerini de ayarla
	if (verificationService) {
		verificationService.setupCallbackHandlers();
	}

	// Yeni admin paneli callback'leri
	bot.action('admin_notification_status', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}
		
		if (!warNotificationService) {
			await ctx.editMessageText('❌ **Savaş Bildirim Sistemi Aktif Değil**\n\nBildirim sistemi yapılandırılmamış.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
					]]
				}
			});
			await ctx.answerCbQuery('Bildirim sistemi aktif değil');
			return;
		}
		
		console.log(`✅ Bildirim durumu kontrolü: ${ctx.from.first_name} (${userId})`);
		
		const status = warNotificationService.getStatus();
		const message = `📊 **Savaş Bildirim Sistemi Durumu**

🔄 Durum: ${status.isRunning ? '✅ Aktif' : '❌ Pasif'}
📝 Son Savaş Durumu: ${status.lastWarState || 'Bilinmiyor'}

🔔 **Gönderilen Bildirimler:**

🚀 **Savaş Başlangıcı:**
• Savaş Bulundu: ${status.notificationsSent.warFound ? '✅' : '❌'}
• 15 Dakika Kaldı: ${status.notificationsSent.fifteenMinutesStart ? '✅' : '❌'}
• Savaş Başladı: ${status.notificationsSent.warStarted ? '✅' : '❌'}

⏰ **Savaş Bitişi:** (Saldırı yapmayanlar listeli)
• 1 Saat Kaldı: ${status.notificationsSent.oneHourEnd ? '✅' : '❌'}
• 30 Dakika Kaldı: ${status.notificationsSent.thirtyMinutesEnd ? '✅' : '❌'}
• 5 Dakika Kaldı: ${status.notificationsSent.fiveMinutesEnd ? '✅' : '❌'}

⏱️ Kontrol Sıklığı: Her 3 dakika
🔔 Toplam Bildirim Türü: 6 farklı bildirim (3 azaldı)
💾 Bildirim Geçmişi: SQLite Veritabanında
📱 Telegram Doğrulama: Saldırı yapmayanlarda görünür`;
		
		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [[
					{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
				]]
			}
		});

		await ctx.answerCbQuery('Bildirim durumu gösteriliyor');
	});

	bot.action('admin_show_config', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const botToken = await database.getConfig('bot_token');
		const clanTag = await database.getConfig('clan_tag');
		const cocApiKey = await database.getConfig('coc_api_key');
		const notificationChatId = await database.getConfig('notification_chat_id');
		const adminUserIds = await database.getConfig('admin_user_ids');

		const message = `⚙️ **Bot Konfigürasyonu**

🤖 **Bot Token:** ${botToken ? '✅ Ayarlanmış' : '❌ Ayarlanmamış'}
🏰 **Klan Tag:** ${clanTag ? `\`${clanTag}\`` : '❌ Ayarlanmamış'}
🔑 **CoC API Key:** ${cocApiKey ? '✅ Ayarlanmış' : '❌ Ayarlanmamış'}
📢 **Bildirim Chat ID:** ${notificationChatId ? `\`${notificationChatId}\`` : '❌ Ayarlanmamış'}
👥 **Admin ID'leri:** ${adminUserIds ? adminUserIds.split(',').length + ' admin' : '❌ Ayarlanmamış'}

💡 Ayarları değiştirmek için düzenle butonunu kullanın.`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [
					[
						{ text: '🔧 Ayarları Düzenle', callback_data: 'admin_edit_config' }
					],
					[
						{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
					]
				]
			}
		});

		await ctx.answerCbQuery('Konfigürasyon gösteriliyor');
	});

	bot.action('admin_edit_config', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const configButtons = [
			[
				{ text: '🤖 Bot Token', callback_data: 'config_edit_bot_token' },
				{ text: '🏰 Klan Tag', callback_data: 'config_edit_clan_tag' }
			],
			[
				{ text: '🔑 CoC API Key', callback_data: 'config_edit_coc_api_key' },
				{ text: '📢 Chat ID', callback_data: 'config_edit_notification_chat_id' }
			],
			[
				{ text: '👥 Admin ID\'leri', callback_data: 'config_edit_admin_user_ids' }
			],
			[
				{ text: '📋 Mevcut Ayarları Göster', callback_data: 'config_show_current' }
			],
			[
				{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
			]
		];

		const message = `⚙️ **Konfigürasyon Düzenleme**

Hangi ayarı düzenlemek istiyorsunuz?

🔧 **Düzenlenebilir Ayarlar:**
• Bot Token
• Klan Tag
• CoC API Key
• Bildirim Chat ID
• Admin ID'leri

💡 **İpucu:** Değişiklikleri yapmadan önce mevcut ayarları kontrol edebilirsin.`;

		ctx.replyWithMarkdown(message, {
			reply_markup: {
				inline_keyboard: configButtons
			}
		});

		await ctx.answerCbQuery('Konfigürasyon düzenleme açıldı');
	});

	bot.action('admin_test_notification', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		if (!warNotificationService) {
			await ctx.editMessageText('❌ **Test Bildirimi Gönderilemedi**\n\nBildirim sistemi yapılandırılmamış veya aktif değil.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
					]]
				}
			});
			await ctx.answerCbQuery('Bildirim sistemi aktif değil');
			return;
		}

		// Test bildirimi gönder
		try {
			await ctx.editMessageText('🧪 **Test Bildirimi Gönderiliyor...**\n\n⏳ Lütfen bekleyin...', {
				parse_mode: 'Markdown'
			});

			const success = await warNotificationService.sendTestNotification();
			
			if (success) {
				await ctx.editMessageText('✅ **Test Bildirimi Başarıyla Gönderildi!**\n\n🔔 Bildirim chat\'inde test mesajını kontrol edin.', {
					parse_mode: 'Markdown',
					reply_markup: {
						inline_keyboard: [[
							{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
						]]
					}
				});
				await ctx.answerCbQuery('Test bildirimi gönderildi!');
			} else {
				await ctx.editMessageText('❌ **Test Bildirimi Gönderilemedi**\n\n🔍 Hata detayları console\'da kontrol edilebilir.\n\n**Olası Nedenler:**\n• Chat ID yanlış\n• Bot yetkisi yok\n• API sorunu', {
					parse_mode: 'Markdown',
					reply_markup: {
						inline_keyboard: [[
							{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
						]]
					}
				});
				await ctx.answerCbQuery('Test bildirimi başarısız!');
			}
		} catch (error) {
			console.error('❌ Test bildirimi callback hatası:', error);
			await ctx.editMessageText('❌ **Bir Hata Oluştu**\n\nTest bildirimi gönderilemedi. Detaylar console\'da görülebilir.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
					]]
				}
			});
			await ctx.answerCbQuery('Hata oluştu!');
		}
	});

	bot.action('admin_back_to_panel', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const clanName = await clan.getClanName(clashOfClansClient);
		const message = `🔧 **${clanName} - Admin Paneli**

👋 Merhaba Admin! Bu panelden bot yönetim işlemlerini yapabilirsin.

⚙️ **Sistem Bilgileri:**
• Bot Durumu: ✅ Aktif
• Bildirim Sistemi: ${warNotificationService ? '✅ Yapılandırılmış' : '❌ Yapılandırılmamış'}
• Admin ID: \`${userId}\`
• Veritabanı: ✅ SQLite

💡 **İpucu:** Aşağıdaki butonları kullanarak bot yönetimi yapabilirsin.`;
		
		const adminButtons = [
			[
				{ text: '🔔 Bildirim Durumu', callback_data: 'admin_notification_status' },
				{ text: '⚙️ Ayarları Görüntüle', callback_data: 'admin_show_config' }
			],
			[
				{ text: '🔧 Ayarları Düzenle', callback_data: 'admin_edit_config' }
			],
			[
				{ text: '🧪 Test Bildirimi', callback_data: 'admin_test_notification' }
			]
		];

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: adminButtons
			}
		});

		await ctx.answerCbQuery('Admin paneline dönüldü');
	});

	// Config düzenleme callback'leri
	bot.action(/^config_edit_(.+)$/, async (ctx) => {
		const configKey = ctx.match[1];
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		// Admin yönetimi için özel sistem
		if (configKey === 'admin_user_ids') {
			await ctx.answerCbQuery('Admin yönetimi açılıyor...');
			await showAdminManagement(ctx);
			return;
		}

		const configNames = {
			'bot_token': '🤖 Bot Token',
			'clan_tag': '🏰 Klan Tag',
			'coc_api_key': '🔑 CoC API Key',
			'notification_chat_id': '📢 Bildirim Chat ID'
		};

		const configName = configNames[configKey] || configKey;
		
		// Mevcut değeri al
		const currentValue = await database.getConfig(configKey);
		const currentDisplay = configKey === 'bot_token' || configKey === 'coc_api_key' 
			? (currentValue ? '✅ Ayarlanmış' : '❌ Ayarlanmamış')
			: (currentValue || '❌ Ayarlanmamış');

		const message = `✏️ **${configName} Düzenleniyor**

📋 **Mevcut Değer:** ${currentDisplay}

💬 **Yeni değeri aşağıya yazın ve gönderin:**

⚠️ **DİKKAT:** 
• Boş bırakmak için "sil" yazın
• İptal etmek için "iptal" yazın
• Bot token ve API key gizli tutulacaktır

⏰ **5 dakika içinde yanıt verin**`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [[
					{ text: '❌ İptal', callback_data: 'config_cancel' }
				]]
			}
		});

		await ctx.answerCbQuery(`${configName} düzenleniyor...`);

		// Geçici olarak kullanıcının beklenen config key'ini sakla
		if (!bot.configEditUsers) {
			bot.configEditUsers = new Map();
		}
		bot.configEditUsers.set(userId, { configKey, timestamp: Date.now() });

		// 5 dakika sonra temizle
		setTimeout(() => {
			if (bot.configEditUsers && bot.configEditUsers.has(userId)) {
				bot.configEditUsers.delete(userId);
			}
		}, 300000); // 5 dakika
	});

	bot.action('config_show_current', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const botToken = await database.getConfig('bot_token');
		const clanTag = await database.getConfig('clan_tag');
		const cocApiKey = await database.getConfig('coc_api_key');
		const notificationChatId = await database.getConfig('notification_chat_id');
		const adminUserIds = await database.getConfig('admin_user_ids');

		const message = `📋 **Mevcut Konfigürasyon**

🤖 **Bot Token:** ${botToken ? '✅ Ayarlanmış' : '❌ Ayarlanmamış'}
🏰 **Klan Tag:** ${clanTag ? `\`${clanTag}\`` : '❌ Ayarlanmamış'}
🔑 **CoC API Key:** ${cocApiKey ? '✅ Ayarlanmış' : '❌ Ayarlanmamış'}
📢 **Bildirim Chat ID:** ${notificationChatId ? `\`${notificationChatId}\`` : '❌ Ayarlanmamış'}
👥 **Admin ID'leri:** ${adminUserIds ? adminUserIds.split(',').length + ' admin tanımlı' : '❌ Ayarlanmamış'}

⚙️ Değişiklik yapmak için yukarıdaki düzenleme menüsünü kullanın.`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [[
					{ text: '🔙 Ayar Menüsü', callback_data: 'admin_edit_config' }
				]]
			}
		});

		await ctx.answerCbQuery('Mevcut ayarlar gösteriliyor');
	});

	bot.action('config_cancel', async (ctx) => {
		await ctx.editMessageText('❌ **Konfigürasyon düzenleme iptal edildi.**\n\nAdmin paneline dönebilirsin.', {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [[
					{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
				]]
			}
		});
		await ctx.answerCbQuery('İptal edildi');
	});

	bot.action('config_back_to_menu', async (ctx) => {
		const configButtons = [
			[
				{ text: '🤖 Bot Token', callback_data: 'config_edit_bot_token' },
				{ text: '🏰 Klan Tag', callback_data: 'config_edit_clan_tag' }
			],
			[
				{ text: '🔑 CoC API Key', callback_data: 'config_edit_coc_api_key' },
				{ text: '📢 Chat ID', callback_data: 'config_edit_notification_chat_id' }
			],
			[
				{ text: '👥 Admin ID\'leri', callback_data: 'config_edit_admin_user_ids' }
			],
			[
				{ text: '📋 Mevcut Ayarları Göster', callback_data: 'config_show_current' }
			],
			[
				{ text: '🔙 Admin Paneli', callback_data: 'admin_back_to_panel' }
			]
		];

		const message = `⚙️ **Konfigürasyon Düzenleme**

Hangi ayarı düzenlemek istiyorsunuz?

🔧 **Düzenlenebilir Ayarlar:**
• Bot Token
• Klan Tag
• CoC API Key
• Bildirim Chat ID
• Admin ID'leri

💡 **İpucu:** Değişiklikleri yapmadan önce mevcut ayarları kontrol edebilirsin.`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: configButtons
			}
		});

		await ctx.answerCbQuery('Ana menüye dönüldü');
	});

	// Admin yönetim fonksiyonları
	async function showAdminManagement(ctx) {
		const currentAdmins = await database.getConfig('admin_user_ids');
		const adminCount = currentAdmins ? currentAdmins.split(',').length : 0;

		const adminButtons = [
			[
				{ text: '➕ Admin Ekle', callback_data: 'admin_add' },
				{ text: '➖ Admin Sil', callback_data: 'admin_remove' }
			],
			[
				{ text: '📋 Mevcut Adminleri Göster', callback_data: 'admin_list' }
			],
			[
				{ text: '🔙 Geri Dön', callback_data: 'config_back_to_menu' }
			]
		];

		const message = `👥 **Admin Yönetimi**

📊 **Mevcut Durum:** ${adminCount} admin tanımlı

🔧 **Yönetim Seçenekleri:**

➕ **Admin Ekle:** Grup üyelerinden seçerek admin yapabilirsin
➖ **Admin Sil:** Mevcut adminlerden birini kaldırabilirsin
📋 **Liste:** Tüm adminleri görüntüleyebilirsin

💡 **İpucu:** Admin ekleme/silme işlemleri anında etkili olur.`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: adminButtons
			}
		});
	}

	// Admin ekleme - grup üyelerini listele veya manuel ekle
	bot.action('admin_add', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		// Chat tipi kontrolü
		const chatType = ctx.chat.type;
		const isGroup = chatType === 'group' || chatType === 'supergroup';

		const adminButtons = [
			[
				{ text: '📝 Manuel ID Girişi', callback_data: 'admin_add_manual' }
			]
		];

		let message = `➕ **Admin Ekleme**

🔧 **Ekleme Yöntemleri:**

📝 **Manuel ID Girişi:** Kullanıcı ID'sini direct yazarak ekle`;

		// Grup chat'te üye listesi seçeneği de ekle
		if (isGroup) {
			adminButtons.unshift([
				{ text: '👥 Grup Üyelerinden Seç', callback_data: 'admin_add_from_group' }
			]);
			
			message = `➕ **Admin Ekleme**

🔧 **Ekleme Yöntemleri:**

👥 **Grup Üyelerinden Seç:** Mevcut grup yöneticilerinden seç
📝 **Manuel ID Girişi:** Kullanıcı ID'sini direct yazarak ekle

💡 **İpucu:** Grup dışından birini admin yapmak için manuel ID girişi kullan.`;
		} else {
			message += `

💡 **İpucu:** Private chat'te olduğunuz için sadece manuel ekleme mevcut.
📱 Kullanıcının ID'sini öğrenmek için ona \`/start\` komutu gönderttirin.`;
		}

		adminButtons.push([{
			text: '🔙 Geri Dön',
			callback_data: 'config_edit_admin_user_ids'
		}]);

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: adminButtons
			}
		});

		await ctx.answerCbQuery('Admin ekleme seçenekleri');
	});

	// Grup üyelerinden admin ekleme
	bot.action('admin_add_from_group', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		try {
			// Grup üyelerini al
			const chatMembers = await ctx.telegram.getChatAdministrators(ctx.chat.id);
			const currentAdmins = await database.getConfig('admin_user_ids');
			const currentAdminIds = currentAdmins ? currentAdmins.split(',').map(id => id.trim()) : [];

			// Bot olmayan ve zaten admin olmayan üyeleri filtrele
			const availableUsers = chatMembers.filter(member => 
				!member.user.is_bot && 
				!currentAdminIds.includes(member.user.id.toString())
			);

			if (availableUsers.length === 0) {
				await ctx.editMessageText('📭 **Admin Eklenecek Kullanıcı Bulunamadı**\n\nTüm grup yöneticileri zaten admin olarak tanımlı.', {
					parse_mode: 'Markdown',
					reply_markup: {
						inline_keyboard: [[
							{ text: '🔙 Geri Dön', callback_data: 'admin_add' }
						]]
					}
				});
				await ctx.answerCbQuery('Eklenecek kullanıcı yok');
				return;
			}

			// Kullanıcı butonları oluştur
			const userButtons = [];
			availableUsers.forEach(member => {
				const user = member.user;
				const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
				const username = user.username ? `@${user.username}` : '';
				const buttonText = username ? `${displayName} (${username})` : displayName;
				
				userButtons.push([{
					text: buttonText,
					callback_data: `admin_add_user_${user.id}`
				}]);
			});

			userButtons.push([{
				text: '🔙 Geri Dön',
				callback_data: 'admin_add'
			}]);

			const message = `👥 **Grup Üyelerinden Admin Seç**

📋 **Mevcut Grup Yöneticileri:** (${availableUsers.length} kişi)

⚠️ **Not:** Sadece grup yöneticileri listelenmiştir.
💡 Seçtiğiniz kişi anında admin yetkisi kazanacak.`;

			await ctx.editMessageText(message, {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: userButtons
				}
			});

			await ctx.answerCbQuery('Grup üyeleri listeleniyor...');

		} catch (error) {
			console.error('Grup üyelerini alma hatası:', error);
			await ctx.editMessageText('❌ **Grup Üyeleri Alınamadı**\n\nGrup üyelerini almak için bot\'un admin yetkisi olması gerekiyor.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Geri Dön', callback_data: 'admin_add' }
					]]
				}
			});
			await ctx.answerCbQuery('❌ Grup üyeleri alınamadı!');
		}
	});

	// Manuel admin ekleme
	bot.action('admin_add_manual', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const message = `📝 **Manuel Admin Ekleme**

💬 **Kullanıcı ID'sini aşağıya yazın ve gönderin:**

🔢 **Örnek:** \`910484564\`

💡 **ID öğrenme yolları:**
• Kullanıcıya bota \`/start\` veya \`/id\` komutunu gönderttin
• @userinfobot kullanarak öğrenebilirsin
• Telegram Desktop'ta kullanıcı profilinde görüntüleyebilirsin

⚠️ **DİKKAT:**
• Sadece rakam girin, @ işareti veya harf kullanmayın
• İptal etmek için "iptal" yazın

⏰ **5 dakika içinde yanıt verin**`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [[
					{ text: '❌ İptal', callback_data: 'admin_add' }
				]]
			}
		});

		await ctx.answerCbQuery('Manuel ID girişi açıldı...');

		// Manuel admin ekleme modunu etkinleştir
		if (!bot.adminAddManualUsers) {
			bot.adminAddManualUsers = new Map();
		}
		bot.adminAddManualUsers.set(userId, { timestamp: Date.now() });

		// 5 dakika sonra temizle
		setTimeout(() => {
			if (bot.adminAddManualUsers && bot.adminAddManualUsers.has(userId)) {
				bot.adminAddManualUsers.delete(userId);
			}
		}, 300000); // 5 dakika
	});

	// Admin silme - mevcut adminleri listele
	bot.action('admin_remove', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const currentAdmins = await database.getConfig('admin_user_ids');
		if (!currentAdmins) {
			await ctx.editMessageText('📭 **Silinecek Admin Bulunamadı**\n\nHenüz hiç admin tanımlanmamış.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Geri Dön', callback_data: 'config_edit_admin_user_ids' }
					]]
				}
			});
			await ctx.answerCbQuery('Admin bulunamadı');
			return;
		}

		const adminIds = currentAdmins.split(',').map(id => id.trim());
		
		// Sadece kendisini silememesi için kontrol
		if (adminIds.length === 1 && adminIds[0] === userId.toString()) {
			await ctx.editMessageText('⚠️ **Son Admin Silinemez**\n\nKendini silemezsin çünkü son admin sensin. Önce başka birini admin yap.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Geri Dön', callback_data: 'config_edit_admin_user_ids' }
					]]
				}
			});
			await ctx.answerCbQuery('Son admin silinemez');
			return;
		}

		const adminButtons = [];
		
		for (const adminId of adminIds) {
			try {
				const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, adminId);
				const user = chatMember.user;
				const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
				const username = user.username ? `@${user.username}` : '';
				const buttonText = username ? `${displayName} (${username})` : displayName;
				
				// Kendisini silmesini engelle
				if (adminId === userId.toString()) {
					adminButtons.push([{
						text: `🚫 ${buttonText} (Sen)`,
						callback_data: 'admin_remove_self_warning'
					}]);
				} else {
					adminButtons.push([{
						text: `➖ ${buttonText}`,
						callback_data: `admin_remove_user_${adminId}`
					}]);
				}
			} catch (error) {
				// Kullanıcı bulunamazsa ID olarak göster
				adminButtons.push([{
					text: `➖ ID: ${adminId}`,
					callback_data: `admin_remove_user_${adminId}`
				}]);
			}
		}

		adminButtons.push([{
			text: '🔙 Geri Dön',
			callback_data: 'config_edit_admin_user_ids'
		}]);

		const message = `➖ **Admin Silme**

👥 **Mevcut Adminler:** (${adminIds.length} kişi)

⚠️ **Dikkat:** Seçtiğiniz admin anında yetkisini kaybedecek.
🚫 **Not:** Kendini silemezsin.`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: adminButtons
			}
		});

		await ctx.answerCbQuery('Adminler listeleniyor...');
	});

	// Admin listesi göster
	bot.action('admin_list', async (ctx) => {
		const userId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(userId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		const currentAdmins = await database.getConfig('admin_user_ids');
		if (!currentAdmins) {
			await ctx.editMessageText('📭 **Admin Bulunamadı**\n\nHenüz hiç admin tanımlanmamış.', {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [[
						{ text: '🔙 Geri Dön', callback_data: 'config_edit_admin_user_ids' }
					]]
				}
			});
			await ctx.answerCbQuery('Admin bulunamadı');
			return;
		}

		const adminIds = currentAdmins.split(',').map(id => id.trim());
		let adminList = '';

		for (let i = 0; i < adminIds.length; i++) {
			const adminId = adminIds[i];
			try {
				const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, adminId);
				const user = chatMember.user;
				const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
				const username = user.username ? `@${user.username}` : '';
				const isSelf = adminId === userId.toString() ? ' **(Sen)**' : '';
				
				adminList += `${i + 1}. **${displayName}**${username ? ` (${username})` : ''}${isSelf}\n   📋 ID: \`${adminId}\`\n\n`;
			} catch (error) {
				adminList += `${i + 1}. **Bilinmeyen Kullanıcı**\n   📋 ID: \`${adminId}\`\n\n`;
			}
		}

		const message = `📋 **Admin Listesi**

👥 **Toplam ${adminIds.length} Admin:**

${adminList}💡 **İpucu:** Admin eklemek/silmek için geri dön.`;

		await ctx.editMessageText(message, {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [[
					{ text: '🔙 Geri Dön', callback_data: 'config_edit_admin_user_ids' }
				]]
			}
		});

		await ctx.answerCbQuery('Admin listesi gösteriliyor');
	});

	// Admin ekleme callback'i
	bot.action(/^admin_add_user_(.+)$/, async (ctx) => {
		const targetUserId = ctx.match[1];
		const currentUserId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(currentUserId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		try {
			// Hedef kullanıcının bilgilerini al
			const targetUser = await ctx.telegram.getChatMember(ctx.chat.id, targetUserId);
			const displayName = targetUser.user.first_name + (targetUser.user.last_name ? ' ' + targetUser.user.last_name : '');
			
			// Mevcut adminleri al
			const currentAdmins = await database.getConfig('admin_user_ids');
			const adminIds = currentAdmins ? currentAdmins.split(',').map(id => id.trim()) : [];
			
			// Zaten admin mi kontrol et
			if (adminIds.includes(targetUserId)) {
				await ctx.answerCbQuery('❌ Bu kullanıcı zaten admin!');
				return;
			}
			
			// Admin ekle
			adminIds.push(targetUserId);
			await database.setConfig('admin_user_ids', adminIds.join(','));
			
			const message = `✅ **Admin Eklendi**

👤 **Yeni Admin:** ${displayName}
🆔 **ID:** \`${targetUserId}\`

🎉 Bu kullanıcı artık tüm bot komutlarını kullanabilir!

💡 Admin listesini görmek için "Mevcut Adminleri Göster" butonunu kullanabilirsin.`;

			await ctx.editMessageText(message, {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [
						[
							{ text: '📋 Admin Listesi', callback_data: 'admin_list' }
						],
						[
							{ text: '🔙 Admin Yönetimi', callback_data: 'config_edit_admin_user_ids' }
						]
					]
				}
			});

			await ctx.answerCbQuery(`✅ ${displayName} admin yapıldı!`);
			console.log(`✅ Yeni admin eklendi: ${displayName} (${targetUserId}) tarafından ${ctx.from.first_name} (${currentUserId})`);

		} catch (error) {
			console.error('Admin ekleme callback hatası:', error);
			await ctx.answerCbQuery('❌ Admin ekleme sırasında hata oluştu!');
		}
	});

	// Admin silme callback'i
	bot.action(/^admin_remove_user_(.+)$/, async (ctx) => {
		const targetUserId = ctx.match[1];
		const currentUserId = ctx.from.id;
		
		const isAdmin = await database.isAdmin(currentUserId);
		if (!isAdmin) {
			await ctx.answerCbQuery('❌ Bu işlem sadece adminler içindir!');
			return;
		}

		// Kendisini silmeye çalışıyor mu?
		if (targetUserId === currentUserId.toString()) {
			await ctx.answerCbQuery('❌ Kendini silemezsin!');
			return;
		}

		try {
			// Hedef kullanıcının bilgilerini al
			let displayName;
			try {
				const targetUser = await ctx.telegram.getChatMember(ctx.chat.id, targetUserId);
				displayName = targetUser.user.first_name + (targetUser.user.last_name ? ' ' + targetUser.user.last_name : '');
			} catch (error) {
				displayName = `ID: ${targetUserId}`;
			}
			
			// Mevcut adminleri al
			const currentAdmins = await database.getConfig('admin_user_ids');
			const adminIds = currentAdmins ? currentAdmins.split(',').map(id => id.trim()) : [];
			
			// Admin değil mi kontrol et
			if (!adminIds.includes(targetUserId)) {
				await ctx.answerCbQuery('❌ Bu kullanıcı zaten admin değil!');
				return;
			}
			
			// Son admin kontrolü
			if (adminIds.length === 1) {
				await ctx.answerCbQuery('❌ Son admin silinemez!');
				return;
			}
			
			// Admin sil
			const newAdminIds = adminIds.filter(id => id !== targetUserId);
			await database.setConfig('admin_user_ids', newAdminIds.join(','));
			
			const message = `❌ **Admin Silindi**

👤 **Eski Admin:** ${displayName}
🆔 **ID:** \`${targetUserId}\`

🚫 Bu kullanıcı artık admin yetkilerini kaybetti.

💡 Yeni admin eklemek için "Admin Ekle" butonunu kullanabilirsin.`;

			await ctx.editMessageText(message, {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [
						[
							{ text: '📋 Admin Listesi', callback_data: 'admin_list' }
						],
						[
							{ text: '🔙 Admin Yönetimi', callback_data: 'config_edit_admin_user_ids' }
						]
					]
				}
			});

			await ctx.answerCbQuery(`✅ ${displayName} admin yetkisi kaldırıldı!`);
			console.log(`❌ Admin silindi: ${displayName} (${targetUserId}) tarafından ${ctx.from.first_name} (${currentUserId})`);

		} catch (error) {
			console.error('Admin silme callback hatası:', error);
			await ctx.answerCbQuery('❌ Admin silme sırasında hata oluştu!');
		}
	});

	// Kendini silme uyarısı
	bot.action('admin_remove_self_warning', async (ctx) => {
		await ctx.answerCbQuery('❌ Kendini silemezsin! Başka birini seç.');
	});

	// Bot'u başlat
	bot.launch();

	console.log('🤖 Bot başlatıldı!');
	if (warNotificationService) {
		console.log('🔔 Savaş bildirim sistemi aktif');
	}
	
	const adminIds = await database.getConfig('admin_user_ids');
	if (adminIds) {
		const adminCount = adminIds.split(',').length;
		console.log(`👥 ${adminCount} admin tanımlı`);
	}
}

// Graceful shutdown
process.once('SIGINT', () => {
	console.log('\n🛑 Bot kapatılıyor...');
	if (bot) bot.stop('SIGINT');
	if (database) database.close();
	console.log('✅ Bot başarıyla kapatıldı');
});

process.once('SIGTERM', () => {
	console.log('\n🛑 Bot kapatılıyor...');
	if (bot) bot.stop('SIGTERM');
	if (database) database.close();
	console.log('✅ Bot başarıyla kapatıldı');
});

// Bot'u başlat
startBot().catch(error => {
	console.error('❌ Uygulama başlatma hatası:', error);
	process.exit(1);
});
