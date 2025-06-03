const clashOfClansReplies = require('../replies/clash_of_clans');
const { escapeHtml } = require('../utils/helpers');

// Klan ismini getiren yardımcı fonksiyon
const getClanName = async (clashOfClansClient) => {
	try {
		const response = await clashOfClansClient.clanByTag('#9CPU2CQR');
		return response.name;
	} catch (e) {
		return 'Klan'; // Fallback
	}
};

const getClanMembers = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Database instance'ı almamız gerekiyor - ctx'ten alabilmemiz için index.js'den geçirmemiz gerekir
		// Şimdilik global database instance kullanacağız
		const Database = require('../services/database');
		const database = new Database();
		
		const response = await clashOfClansClient.clanMembersByTag('#9CPU2CQR');
		const { items } = response;
		
		// Doğrulanmış kullanıcıları al
		const verifiedUsers = await database.getAllVerifiedUsers();
		
		// Tag'e göre hızlı arama için map oluştur
		const verifiedMap = new Map();
		verifiedUsers.forEach(user => {
			verifiedMap.set(user.coc_player_tag, user);
		});
		
		message += '*****⚔Üyeler⚔*****\n\n';
		for (let i = 0; i < items.length; i++) {
			const member = items[i];
			const safeName = escapeHtml(member.name);
			
			// Doğrulanmış kullanıcı bilgisini al
			const verifiedUser = verifiedMap.get(member.tag);
			
			if (verifiedUser && verifiedUser.telegram_username) {
				// Doğrulanmış kullanıcı var ve username'i var
				message += `${i+1}. ${safeName} - <code>${member.tag}</code>\n`;
				message += `   📱 @${verifiedUser.telegram_username} ✅\n\n`;
			} else if (verifiedUser) {
				// Doğrulanmış kullanıcı var ama username yok
				message += `${i+1}. ${safeName} - <code>${member.tag}</code>\n`;
				message += `   📱 ${verifiedUser.telegram_first_name} ✅\n\n`;
			} else {
				// Doğrulanmamış kullanıcı
				message += `${i+1}. ${safeName} - <code>${member.tag}</code>\n`;
				message += `   📱 Doğrulanmamış ❌\n\n`;
			}
		}
		
		// İstatistik ekle
		const verifiedCount = items.filter(member => verifiedMap.has(member.tag)).length;
		const unverifiedCount = items.length - verifiedCount;
		
		message += `📊 **Doğrulama İstatistikleri:**\n`;
		message += `✅ Doğrulanmış: ${verifiedCount}/${items.length}\n`;
		message += `❌ Doğrulanmamış: ${unverifiedCount}/${items.length}\n`;
		
		if (verifiedCount > 0) {
			const verificationRate = Math.round((verifiedCount / items.length) * 100);
			message += `📈 Doğrulama Oranı: %${verificationRate}\n`;
		}
		
		message += '\n' + clashOfClansReplies.getTagHelpMessage();
		
		// Database bağlantısını kapat
		database.close();
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

const getClan = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
	 	const response = await clashOfClansClient.clanByTag('#9CPU2CQR');
		const safeName = escapeHtml(response.name);
		const safeDescription = escapeHtml(response.description);
	 	message += `***** 🏛 ${safeName} - <code>${response.tag}</code> *****\n\n`;
	 	message += `📝 Açıklama: \n"${safeDescription}"\n`;
	 	message += `\n ⭐️ Klan seviyesi: ${response.clanLevel}\n`;
	 	message += `\n 👥 Toplam üye sayısı: ${response.members}\n`;
	 	message += `\n🎨 Resmi logo:`;
	 	message += `\n${response.badgeUrls.medium}\n`;
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Başkent Baskın Sezonları bilgilerini getir
const getCapitalRaidSeasons = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.clanCapitalRaidSeasons('#9CPU2CQR', { limit: 5 });
		const clanResponse = await clashOfClansClient.clanByTag('#9CPU2CQR');
		const safeName = escapeHtml(clanResponse.name);
		
		message += `***** 🏰 ${safeName} - Başkent Baskın Sezonları *****\n\n`;
		
		if (response.items && response.items.length > 0) {
			message += `📊 **Son ${response.items.length} Sezon:**\n\n`;
			
			response.items.forEach((season, index) => {
				const startDate = new Date(season.startTime);
				const endDate = new Date(season.endTime);
				
				message += `**${index + 1}. Sezon**\n`;
				message += `📅 Tarih: ${startDate.toLocaleDateString('tr-TR')} - ${endDate.toLocaleDateString('tr-TR')}\n`;
				message += `🏆 Büyüklü Madalya: ${season.capitalTotalLoot}\n`;
				message += `🎯 Baskın Sayısı: ${season.raidsCompleted}\n`;
				message += `⚔️ Toplam Saldırı: ${season.totalAttacks}\n`;
				message += `🛡️ Savunma Ödülü: ${season.defensiveReward}\n`;
				message += `💰 Saldırı Ödülü: ${season.offensiveReward}\n`;
				
				if (season.members && season.members.length > 0) {
					message += `👥 Katılan Üye: ${season.members.length}\n`;
					
					// En iyi 3 üyeyi göster
					const topMembers = season.members
						.sort((a, b) => b.capitalResourcesLooted - a.capitalResourcesLooted)
						.slice(0, 3);
					
					message += `🏅 **En İyi Performans:**\n`;
					topMembers.forEach((member, idx) => {
						const safeMemberName = escapeHtml(member.name);
						message += `${idx + 1}. ${safeMemberName}: ${member.capitalResourcesLooted} 💰\n`;
					});
				}
				message += '\n';
			});
		} else {
			message += '📭 Henüz başkent baskın sezon verisi bulunmuyor.';
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

module.exports = {
	getClanMembers,
	getClan,
	getClanName,
	getCapitalRaidSeasons,
};
