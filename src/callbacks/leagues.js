const clashOfClansReplies = require('../replies/clash_of_clans');
const clan = require('./clan');
const { escapeHtml } = require('../utils/helpers');

// Savaş ligleri
const getWarLeagues = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Normal ligleri getir
		const leaguesResponse = await clashOfClansClient.leagues();
		
		if (leaguesResponse.items && leaguesResponse.items.length > 0) {
			message += '🏆 **NORMAL LİGLER**\n\n';
			
			leaguesResponse.items.forEach((league, index) => {
				message += `${index + 1}. **${league.name}**\n`;
				message += `🆔 ID: ${league.id}\n`;
				if (league.iconUrls) {
					message += `🖼️ İkon: ${league.iconUrls.medium || league.iconUrls.small}\n`;
				}
				message += '\n';
			});
			
			message += '\n📋 **Diğer Komutlar:**\n';
			message += '/savas_ligleri - Savaş ligleri\n';
			message += '/basken_ligleri - Başkent ligleri\n';
			message += '/builder_ligleri - Builder Base ligleri\n';
			message += '/tum_ligler - Tüm ligler özeti\n';
		} else {
			message += '📭 Lig verileri bulunamadı.';
		}
		
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Gerçek savaş liglerini getir
const getRealWarLeagues = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const warLeaguesResponse = await clashOfClansClient.warLeagues();
		
		if (warLeaguesResponse.items && warLeaguesResponse.items.length > 0) {
			message += '⚔️ **SAVAŞ LİGLERİ**\n\n';
			
			warLeaguesResponse.items.forEach((league, index) => {
				message += `${index + 1}. **${league.name}**\n`;
				message += `🆔 ID: ${league.id}\n`;
				if (league.iconUrls) {
					message += `🖼️ İkon: ${league.iconUrls.medium || league.iconUrls.small}\n`;
				}
				message += '\n';
			});
			
			message += '\n📋 **Diğer Komutlar:**\n';
			message += '/ligler - Normal ligler\n';
			message += '/basken_ligleri - Başkent ligleri\n';
			message += '/builder_ligleri - Builder Base ligleri\n';
			message += '/tum_ligler - Tüm ligler özeti\n';
		} else {
			message += '📭 Savaş ligi verileri bulunamadı.';
		}
		
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Klan sıralaması (Türkiye)
const getClanRankings = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Türkiye lokasyon ID'si: 32000249
		const response = await clashOfClansClient.clansByLocation('32000249');
		
		if (response && response.items && response.items.length > 0) {
			const { items } = response;
			
			message += '*****🏆 Türkiye Klan Sıralaması (İlk 10)*****\n\n';
			
			for (let i = 0; i < Math.min(items.length, 10); i++) {
				const clan = items[i];
				const safeName = escapeHtml(clan.name);
				message += `${clan.rank}. ${safeName}\n`;
				message += `   🏆 ${clan.clanPoints} puan\n`;
				message += `   👥 ${clan.members}/50 üye\n`;
				if (clan.location && clan.location.name) {
					message += `   📍 ${clan.location.name}\n`;
				}
				message += '\n';
			}
		} else {
			message = '🔍 Klan sıralaması şu anda alınamıyor.';
		}
		
	} catch (e) {
		const clanName = await clan.getClanName(clashOfClansClient);
		message = '⚠️ Klan sıralaması servisi şu anda çalışmıyor.\n\n';
		message += 'Bunun yerine şu komutları kullanabilirsiniz:\n';
		message += `• /klan - ${clanName} klan bilgileri\n`;
		message += '• /uyeler - Klan üyeleri\n';
		message += '• /savas - Mevcut savaş durumu';
	}
	ctx.replyWithHTML(message);
};

// Oyuncu sıralaması (Türkiye)
const getPlayerRankings = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Türkiye lokasyon ID'si: 32000249
		const response = await clashOfClansClient.playersByLocation('32000249');
		
		if (response && response.items && response.items.length > 0) {
			const { items } = response;
			
			message += '*****🏆 Türkiye Oyuncu Sıralaması (İlk 10)*****\n\n';
			
			for (let i = 0; i < Math.min(items.length, 10); i++) {
				const player = items[i];
				const safeName = escapeHtml(player.name);
				message += `${player.rank}. ${safeName}\n`;
				message += `   🏆 ${player.trophies} kupa\n`;
				message += `   ⭐ Seviye ${player.expLevel}\n`;
				if (player.clan) {
					const safeClanName = escapeHtml(player.clan.name);
					message += `   🏛️ ${safeClanName}\n`;
				}
				message += '\n';
			}
		} else {
			message = '🔍 Oyuncu sıralaması şu anda alınamıyor.';
		}
		
	} catch (e) {
		message = '⚠️ Oyuncu sıralaması servisi şu anda çalışmıyor.\n\n';
		message += 'Bunun yerine şu komutları kullanabilirsiniz:\n';
		message += '• /oyuncu #tag - Oyuncu detayları\n';
		message += '• /uyeler - Klan üyeleri\n';
		message += '• /savas - Mevcut savaş durumu';
	}
	ctx.replyWithHTML(message);
};

// Builder Base liglerini getir
const getBuilderBaseLeagues = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.builderBaseLeagues();
		message += '🏗️ **BUILDER BASE LİGLERİ**\n\n';
		
		if (response.items && response.items.length > 0) {
			response.items.forEach((league, index) => {
				message += `${index + 1}. **${league.name}**\n`;
				message += `🆔 ID: ${league.id}\n`;
				if (league.iconUrls) {
					message += `🖼️ İkon: ${league.iconUrls.medium || league.iconUrls.small}\n`;
				}
				message += '\n';
			});
		} else {
			message += '📭 Builder Base ligi bulunamadı.';
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Başkent liglerini getir
const getCapitalLeagues = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.capitalLeagues();
		message += '🏰 **BAŞKENT LİGLERİ**\n\n';
		
		if (response.items && response.items.length > 0) {
			response.items.forEach((league, index) => {
				message += `${index + 1}. **${league.name}**\n`;
				message += `🆔 ID: ${league.id}\n`;
				if (league.iconUrls) {
					message += `🖼️ İkon: ${league.iconUrls.medium || league.iconUrls.small}\n`;
				}
				message += '\n';
			});
		} else {
			message += '📭 Başkent ligi bulunamadı.';
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Lig sezon sıralamalarını getir (Türkiye için)
const getLeagueSeasonRankings = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		message += '🏆 **LEGEND LEAGUE SIRALAMASI**\n\n';
		
		// Önce tüm ligleri kontrol edelim
		const allLeagues = await clashOfClansClient.leagues();
		
		if (!allLeagues.items || allLeagues.items.length === 0) {
			message += '❌ Lig verileri alınamadı.';
			ctx.replyWithHTML(message);
			return;
		}
		
		// Legend League'i bul
		const legendLeague = allLeagues.items.find(league => 
			league.name && league.name.toLowerCase().includes('legend')
		);
		
		if (!legendLeague) {
			message += '❌ Legend League bulunamadı.\n\n';
			message += '📋 **Mevcut Ligler:**\n';
			allLeagues.items.slice(0, 10).forEach((league, index) => {
				message += `${index + 1}. ${league.name} (ID: ${league.id})\n`;
			});
			ctx.replyWithHTML(message);
			return;
		}
		
		message += `🎯 Legend League ID: ${legendLeague.id}\n`;
		message += `📛 League Adı: ${legendLeague.name}\n\n`;
		
		// Sezonları getir
		const seasonsResponse = await clashOfClansClient.leagueSeasons(legendLeague.id);
		
		if (!seasonsResponse.items || seasonsResponse.items.length === 0) {
			message += '❌ Sezon verileri bulunamadı.';
			ctx.replyWithHTML(message);
			return;
		}
		
		// En son sezonu al
		const latestSeason = seasonsResponse.items[0];
		message += `📅 Son Sezon: ${latestSeason.id}\n\n`;
		
		// Sezon sıralamasını getir
		const rankingsResponse = await clashOfClansClient.leagueSeasonRankings(
			legendLeague.id, 
			latestSeason.id, 
			{ limit: 10 }
		);
		
		if (!rankingsResponse.items || rankingsResponse.items.length === 0) {
			message += '❌ Sıralama verileri bulunamadı.';
			ctx.replyWithHTML(message);
			return;
		}
		
		message += `👑 **Top ${rankingsResponse.items.length} Oyuncu:**\n\n`;
		
		rankingsResponse.items.forEach((player, index) => {
			const safeName = escapeHtml(player.name);
			const clanName = player.clan ? escapeHtml(player.clan.name) : 'Klansız';
			
			message += `${index + 1}. **${safeName}**\n`;
			message += `🏆 Kupa: ${player.trophies}\n`;
			message += `🏛️ Klan: ${clanName}\n`;
			message += `🏷️ Tag: <code>${player.tag}</code>\n\n`;
		});
		
	} catch (e) {
		console.error('Legend League Hatası:', e.message);
		
		message = '❌ **Legend League Sıralaması Hatası**\n\n';
		message += '🔧 **Alternatif Komutlar:**\n';
		message += '/tum_ligler - Tüm lig sistemleri\n';
		message += '/klan_siralamasi - Türkiye klan sıralaması\n';
		message += '/oyuncu_siralamasi - Türkiye oyuncu sıralaması\n\n';
		message += `⚠️ Hata Detayı: ${e.message}`;
	}
	ctx.replyWithHTML(message);
};

// Tüm lig türlerini özet halinde göster
const getAllLeaguesSummary = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		message += '🏆 **TÜM LİG SİSTEMLERİ**\n\n';
		
		// Normal Ligler
		const normalLeagues = await clashOfClansClient.leagues();
		message += `⚔️ **Normal Ligler:** ${normalLeagues.items ? normalLeagues.items.length : 0} adet\n`;
		
		// Savaş Ligleri
		const warLeagues = await clashOfClansClient.warLeagues();
		message += `🏛️ **Savaş Ligleri:** ${warLeagues.items ? warLeagues.items.length : 0} adet\n`;
		
		// Başkent Ligleri
		const capitalLeagues = await clashOfClansClient.capitalLeagues();
		message += `🏰 **Başkent Ligleri:** ${capitalLeagues.items ? capitalLeagues.items.length : 0} adet\n`;
		
		// Builder Base Ligleri
		const builderLeagues = await clashOfClansClient.builderBaseLeagues();
		message += `🏗️ **Builder Base Ligleri:** ${builderLeagues.items ? builderLeagues.items.length : 0} adet\n\n`;
		
		message += '📋 **Detaylı Liste İçin:**\n';
		message += '/ligler - Normal ligler\n';
		message += '/savas_ligleri - Savaş ligleri\n';
		message += '/basken_ligleri - Başkent ligleri\n';
		message += '/builder_ligleri - Builder Base ligleri\n';
		message += '/legend_siralamasi - Legend League sıralaması\n';
		
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Builder Base oyuncu sıralaması (Türkiye)
const getBuilderBasePlayerRankings = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Türkiye lokasyon ID'si: 32000249
		const response = await clashOfClansClient.playersByLocationBuilderBase('32000249', { limit: 10 });
		
		if (response && response.items && response.items.length > 0) {
			message += '🏗️ **TÜRKİYE BUILDER BASE OYUNCU SIRALAMASI**\n\n';
			
			response.items.forEach((player, index) => {
				const safeName = escapeHtml(player.name);
				const clanName = player.clan ? escapeHtml(player.clan.name) : 'Klansız';
				
				message += `${player.rank}. **${safeName}**\n`;
				message += `🏆 Versus Kupa: ${player.versusTrophies}\n`;
				message += `⭐ Seviye: ${player.expLevel}\n`;
				message += `🏛️ Klan: ${clanName}\n`;
				message += `🏷️ Tag: <code>${player.tag}</code>\n\n`;
			});
		} else {
			message += '📭 Builder Base oyuncu sıralaması bulunamadı.';
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Builder Base klan sıralaması (Türkiye)
const getBuilderBaseClanRankings = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Türkiye lokasyon ID'si: 32000249
		const response = await clashOfClansClient.clansByLocationBuilderBase('32000249', { limit: 10 });
		
		if (response && response.items && response.items.length > 0) {
			message += '🏗️ **TÜRKİYE BUILDER BASE KLAN SIRALAMASI**\n\n';
			
			response.items.forEach((clan, index) => {
				const safeName = escapeHtml(clan.name);
				
				message += `${clan.rank}. **${safeName}**\n`;
				message += `🏆 Versus Kupa: ${clan.versusTrophies}\n`;
				message += `👥 Üye: ${clan.members}/50\n`;
				message += `🏷️ Tag: <code>${clan.tag}</code>\n\n`;
			});
		} else {
			message += '📭 Builder Base klan sıralaması bulunamadı.';
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Başkent sıralaması (Türkiye)
const getCapitalRankings = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Türkiye lokasyon ID'si: 32000249
		const response = await clashOfClansClient.capitalsByLocation('32000249', { limit: 10 });
		
		if (response && response.items && response.items.length > 0) {
			message += '🏰 **TÜRKİYE BAŞKENT SIRALAMASI**\n\n';
			
			response.items.forEach((clan, index) => {
				const safeName = escapeHtml(clan.name);
				
				message += `${clan.rank}. **${safeName}**\n`;
				message += `🏆 Başkent Kupa: ${clan.clanCapitalPoints}\n`;
				message += `👥 Üye: ${clan.members}/50\n`;
				message += `🏷️ Tag: <code>${clan.tag}</code>\n\n`;
			});
		} else {
			message += '📭 Başkent sıralaması bulunamadı.';
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

module.exports = {
	getWarLeagues,
	getRealWarLeagues,
	getClanRankings,
	getPlayerRankings,
	getBuilderBaseLeagues,
	getCapitalLeagues,
	getLeagueSeasonRankings,
	getAllLeaguesSummary,
	getBuilderBasePlayerRankings,
	getBuilderBaseClanRankings,
	getCapitalRankings,
}; 