const clashOfClansReplies = require('../replies/clash_of_clans');
const { escapeHtml, parseApiDate, getWarTimeStatus } = require('../utils/helpers');

// Mevcut savaş bilgilerini getir
const getCurrentWar = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.clanCurrentWarByTag('#9CPU2CQR');
		if (response.state === 'notInWar') {
			message = '🕊️ Klan şu anda savaşta değil.';
		} else {
			const safeClanName = escapeHtml(response.clan.name);
			const safeOpponentName = escapeHtml(response.opponent.name);
			
			message += `***** ⚔️ ${safeClanName} vs ${safeOpponentName} *****\n\n`;
			
			// Genel savaş durumu
			message += `📊 **SAVAŞ DURUMU**\n`;
			message += `📅 Durum: ${getWarState(response.state)}\n`;
			message += `👥 Takım Boyutu: ${response.teamSize}v${response.teamSize}\n`;
			message += `⚔️ Saldırı Hakkı: ${response.attacksPerMember} saldırı/üye\n`;
			
			if (response.battleModifier && response.battleModifier !== 'none') {
				message += `🎯 Savaş Modu: ${getBattleModifier(response.battleModifier)}\n`;
			}
			
			// Zaman bilgileri
			const startDate = response.startTime ? parseApiDate(response.startTime) : null;
			const endDate = response.endTime ? parseApiDate(response.endTime) : null;
			const prepDate = response.preparationStartTime ? parseApiDate(response.preparationStartTime) : null;
			
			// Kalan süre bilgisi
			const timeStatus = getWarTimeStatus(response.state, startDate, endDate);
			if (timeStatus) {
				message += `\n🕐 **ZAMAN BİLGİSİ**\n`;
				message += `${timeStatus}\n`;
			}
			
			// Detaylı tarih bilgileri
			message += `\n📅 **DETAYLI TARİHLER**\n`;
			if (prepDate && !isNaN(prepDate.getTime())) {
				message += `🛠️ Hazırlık Başlangıcı: ${prepDate.toLocaleString('tr-TR')}\n`;
			}
			if (startDate && !isNaN(startDate.getTime())) {
				message += `🚀 Savaş Başlangıcı: ${startDate.toLocaleString('tr-TR')}\n`;
			}
			if (endDate && !isNaN(endDate.getTime())) {
				message += `🏁 Savaş Bitişi: ${endDate.toLocaleString('tr-TR')}\n`;
			}
			
			// Skor karşılaştırması
			message += `\n🏆 **SKOR TABLOSU**\n`;
			message += `⭐ Yıldızlar: ${response.clan.stars} - ${response.opponent.stars}\n`;
			message += `💥 Hasar: %${response.clan.destructionPercentage.toFixed(1)} - %${response.opponent.destructionPercentage.toFixed(1)}\n`;
			message += `🎯 Saldırılar: ${response.clan.attacks}/${response.teamSize * response.attacksPerMember} - ${response.opponent.attacks}/${response.teamSize * response.attacksPerMember}\n`;
			
			// Duruma göre farklı mesajlar
			let warResult = '';
			if (response.state === 'preparation') {
				// Hazırlık aşamasında
				warResult = '🛠️ Hazırlık aşaması - Savaş düzeninizi kontrol edin!';
			} else if (response.state === 'inWar') {
				// Savaş devam ediyor
				if (response.clan.stars > response.opponent.stars) {
					warResult = '🎉 Önde gidiyoruz! Avantajı koruyun!';
				} else if (response.clan.stars < response.opponent.stars) {
					warResult = '😤 Gerideyiz, saldırın!';
				} else {
					// Yıldız eşitse yüzdeye bak
					if (response.clan.destructionPercentage > response.opponent.destructionPercentage) {
						warResult = '⚖️ Yıldız eşit, hasarda öndeyiz!';
					} else if (response.clan.destructionPercentage < response.opponent.destructionPercentage) {
						warResult = '⚖️ Yıldız eşit, hasarda gerideyiz! Saldırın!';
					} else {
						warResult = '🤝 Tam eşitlik! Her saldırı kritik!';
					}
				}
			} else if (response.state === 'warEnded') {
				// Savaş bitti
				if (response.clan.stars > response.opponent.stars) {
					warResult = '🎉 Savaşı kazandık! Tebrikler!';
				} else if (response.clan.stars < response.opponent.stars) {
					warResult = '😞 Savaşı kaybettik. Bir sonrakinde daha iyi!';
				} else {
					// Yıldız eşitse yüzdeye bak
					if (response.clan.destructionPercentage > response.opponent.destructionPercentage) {
						warResult = '🎯 Hasarda kazandık! Tebrikler!';
					} else if (response.clan.destructionPercentage < response.opponent.destructionPercentage) {
						warResult = '😤 Hasarda kaybettik. Çok yakındı!';
					} else {
						warResult = '🤝 Berabere bitti! Harika mücadele!';
					}
				}
			}
			message += `\n${warResult}\n`;
			
			// En iyi performanslar (sadece savaş devam ediyor veya bittiyse)
			if ((response.state === 'inWar' || response.state === 'warEnded') && response.clan.members && response.clan.members.length > 0) {
				message += `\n⭐ **EN İYİ PERFORMANSLAR**\n`;
				
				// En çok yıldız alan saldırılar
				const bestAttacks = [];
				response.clan.members.forEach(member => {
					if (member.attacks) {
						member.attacks.forEach(attack => {
							bestAttacks.push({
								name: member.name,
								stars: attack.stars,
								percentage: attack.destructionPercentage,
								order: attack.order
							});
						});
					}
				});
				
				bestAttacks.sort((a, b) => {
					if (b.stars !== a.stars) return b.stars - a.stars;
					return b.percentage - a.percentage;
				});
				
				const topAttacks = bestAttacks.slice(0, 3);
				if (topAttacks.length > 0) {
					topAttacks.forEach((attack, index) => {
						const safeName = escapeHtml(attack.name);
						message += `${index + 1}. ${safeName}: ${attack.stars}⭐ %${attack.percentage}\n`;
					});
				} else {
					message += `Henüz saldırı yapılmamış.\n`;
				}
				
				// Saldırı istatistikleri
				const totalAttacks = response.teamSize * response.attacksPerMember;
				const usedAttacks = response.clan.attacks;
				const remainingAttacks = totalAttacks - usedAttacks;
				
				message += `\n🎯 **SALDIRI İSTATİSTİKLERİ**\n`;
				message += `✅ Kullanılan: ${usedAttacks}/${totalAttacks}\n`;
				
				if (response.state === 'inWar') {
					message += `⏳ Kalan: ${remainingAttacks}\n`;
				}
				
				// Eksik saldırı yapan üyeler listesi (her durumda göster)
				const incompleteAttackers = response.clan.members.filter(member => {
					const memberAttacks = member.attacks ? member.attacks.length : 0;
					return memberAttacks < response.attacksPerMember;
				});
				
				if (incompleteAttackers.length > 0) {
					message += `\n⚠️ **EKSİK SALDIRI YAPAN ÜYELER (${incompleteAttackers.length})**\n`;
					incompleteAttackers.forEach(member => {
						const safeName = escapeHtml(member.name);
						const memberAttacks = member.attacks ? member.attacks.length : 0;
						const emoji = memberAttacks === 0 ? '❌' : '⚠️';
						message += `${emoji} ${safeName} (TH${member.townhallLevel}) - ${memberAttacks}/${response.attacksPerMember} saldırı\n`;
					});
				}
			}
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Saldırı yapmayanları listele
const getNonAttackers = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		// Database instance'ı al
		const Database = require('../services/database');
		const database = new Database();
		
		const response = await clashOfClansClient.clanCurrentWarByTag('#9CPU2CQR');
		if (response.state === 'notInWar') {
			message = '🕊️ Klan şu anda savaşta değil.';
		} else {
			const safeClanName = escapeHtml(response.clan.name);
			
			// Doğrulanmış kullanıcıları al
			const verifiedUsers = await database.getAllVerifiedUsers();
			
			// Tag'e göre hızlı arama için map oluştur
			const verifiedMap = new Map();
			verifiedUsers.forEach(user => {
				verifiedMap.set(user.coc_player_tag, user);
			});
			
			message += `***** ⚠️ EKSİK SALDIRI LİSTESİ *****\n\n`;
			message += `🏛️ Klan: ${safeClanName}\n`;
			message += `⚔️ Saldırı Hakkı: ${response.attacksPerMember} saldırı/üye\n\n`;
			
			if (response.clan.members && response.clan.members.length > 0) {
				// Hiç saldırmayanlar
				const nonAttackers = response.clan.members.filter(member => 
					!member.attacks || member.attacks.length === 0
				);
				
				// Eksik saldırı yapanlar
				const partialAttackers = response.clan.members.filter(member => {
					const memberAttacks = member.attacks ? member.attacks.length : 0;
					return memberAttacks > 0 && memberAttacks < response.attacksPerMember;
				});
				
				// Tam saldırı yapanlar
				const fullAttackers = response.clan.members.filter(member => {
					const memberAttacks = member.attacks ? member.attacks.length : 0;
					return memberAttacks === response.attacksPerMember;
				});

				// Üye bilgisi formatlamak için helper fonksiyon
				const formatMemberWithTelegram = (member, index, attackCount, maxAttacks) => {
					const safeName = escapeHtml(member.name);
					const verifiedUser = verifiedMap.get(member.tag);
					
					let memberInfo = `${index + 1}. ${safeName} (TH${member.townhallLevel}) - ${attackCount}/${maxAttacks}`;
					
					if (verifiedUser && verifiedUser.telegram_username) {
						memberInfo += `\n   📱 @${verifiedUser.telegram_username} ✅`;
					} else if (verifiedUser) {
						memberInfo += `\n   📱 ${verifiedUser.telegram_first_name} ✅`;
					} else {
						memberInfo += `\n   📱 Doğrulanmamış ❌`;
					}
					
					return memberInfo;
				};
				
				// Hiç saldırmayanlar
				if (nonAttackers.length > 0) {
					message += `❌ **HİÇ SALDIRMAYAN ÜYELER (${nonAttackers.length})**\n`;
					nonAttackers
						.sort((a, b) => b.townhallLevel - a.townhallLevel)
						.forEach((member, index) => {
							message += formatMemberWithTelegram(member, index, 0, response.attacksPerMember) + '\n\n';
						});
				}
				
				// Eksik saldırı yapanlar
				if (partialAttackers.length > 0) {
					message += `⚠️ **EKSİK SALDIRI YAPAN ÜYELER (${partialAttackers.length})**\n`;
					partialAttackers
						.sort((a, b) => b.townhallLevel - a.townhallLevel)
						.forEach((member, index) => {
							const memberAttacks = member.attacks.length;
							message += formatMemberWithTelegram(member, index, memberAttacks, response.attacksPerMember) + '\n\n';
						});
				}
				
				// Tam saldırı yapanlar
				if (fullAttackers.length > 0) {
					message += `✅ **TAM SALDIRI YAPAN ÜYELER (${fullAttackers.length})**\n`;
					fullAttackers
						.sort((a, b) => b.townhallLevel - a.townhallLevel)
						.forEach((member, index) => {
							message += formatMemberWithTelegram(member, index, response.attacksPerMember, response.attacksPerMember) + '\n\n';
						});
				}
				
				// Özet
				const totalMembers = response.clan.members.length;
				const problemMembers = nonAttackers.length + partialAttackers.length;
				
				// Doğrulama durumu özeti
				const verifiedInNonAttackers = nonAttackers.filter(member => verifiedMap.has(member.tag)).length;
				const verifiedInPartialAttackers = partialAttackers.filter(member => verifiedMap.has(member.tag)).length;
				const verifiedInFullAttackers = fullAttackers.filter(member => verifiedMap.has(member.tag)).length;
				const totalVerified = verifiedInNonAttackers + verifiedInPartialAttackers + verifiedInFullAttackers;
				
				message += `📊 **GENEL ÖZET**\n`;
				message += `👥 Toplam Üye: ${totalMembers}\n`;
				message += `❌ Hiç Saldırmayan: ${nonAttackers.length} (${verifiedInNonAttackers} doğrulanmış)\n`;
				message += `⚠️ Eksik Saldırı: ${partialAttackers.length} (${verifiedInPartialAttackers} doğrulanmış)\n`;
				message += `✅ Tam Saldırı: ${fullAttackers.length} (${verifiedInFullAttackers} doğrulanmış)\n`;
				message += `⚠️ Sorunlu Üye: ${problemMembers}/${totalMembers}\n`;
				message += `📱 Toplam Doğrulanmış: ${totalVerified}/${totalMembers}\n`;
				
				if (problemMembers > 0) {
					const problemRate = Math.round((problemMembers / totalMembers) * 100);
					message += `📈 Sorun Oranı: %${problemRate}\n`;
				}
				
				if (totalVerified > 0) {
					const verificationRate = Math.round((totalVerified / totalMembers) * 100);
					message += `🔗 Doğrulama Oranı: %${verificationRate}\n`;
				}
			}
		}
		
		// Database bağlantısını kapat
		database.close();
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Detaylı savaş analizi
const getWarAnalysis = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.clanCurrentWarByTag('#9CPU2CQR');
		if (response.state === 'notInWar') {
			message = '🕊️ Klan şu anda savaşta değil.';
		} else {
			const safeClanName = escapeHtml(response.clan.name);
			const safeOpponentName = escapeHtml(response.opponent.name);
			
			message += `***** 📊 SAVAŞ ANALİZİ *****\n\n`;
			message += `⚔️ ${safeClanName} vs ${safeOpponentName}\n\n`;
			
			// Townhall analizi
			const ourTHs = {};
			const enemyTHs = {};
			
			response.clan.members.forEach(member => {
				const th = member.townhallLevel;
				ourTHs[th] = (ourTHs[th] || 0) + 1;
			});
			
			response.opponent.members.forEach(member => {
				const th = member.townhallLevel;
				enemyTHs[th] = (enemyTHs[th] || 0) + 1;
			});
			
			message += `🏠 **TOWNHALL DAĞILIMI**\n`;
			const allTHs = new Set([...Object.keys(ourTHs), ...Object.keys(enemyTHs)]);
			const sortedTHs = Array.from(allTHs).sort((a, b) => b - a);
			
			sortedTHs.forEach(th => {
				const our = ourTHs[th] || 0;
				const enemy = enemyTHs[th] || 0;
				message += `TH${th}: ${our} - ${enemy}\n`;
			});
			
			// Saldırı verimliliği
			message += `\n⚔️ **SALDIRI VERİMLİLİĞİ**\n`;
			
			let our3Stars = 0, our2Stars = 0, our1Stars = 0, our0Stars = 0;
			let enemy3Stars = 0, enemy2Stars = 0, enemy1Stars = 0, enemy0Stars = 0;
			
			// Bizim saldırılarımız
			response.clan.members.forEach(member => {
				if (member.attacks) {
					member.attacks.forEach(attack => {
						if (attack.stars === 3) our3Stars++;
						else if (attack.stars === 2) our2Stars++;
						else if (attack.stars === 1) our1Stars++;
						else our0Stars++;
					});
				}
			});
			
			// Rakip saldırıları
			response.opponent.members.forEach(member => {
				if (member.attacks) {
					member.attacks.forEach(attack => {
						if (attack.stars === 3) enemy3Stars++;
						else if (attack.stars === 2) enemy2Stars++;
						else if (attack.stars === 1) enemy1Stars++;
						else enemy0Stars++;
					});
				}
			});
			
			message += `🌟 3 Yıldız: ${our3Stars} - ${enemy3Stars}\n`;
			message += `⭐ 2 Yıldız: ${our2Stars} - ${enemy2Stars}\n`;
			message += `⭐ 1 Yıldız: ${our1Stars} - ${enemy1Stars}\n`;
			message += `❌ 0 Yıldız: ${our0Stars} - ${enemy0Stars}\n`;
			
			// Ortalama hasar
			const ourTotalDamage = response.clan.destructionPercentage * response.clan.attacks / 100;
			const enemyTotalDamage = response.opponent.destructionPercentage * response.opponent.attacks / 100;
			
			if (response.clan.attacks > 0 && response.opponent.attacks > 0) {
				const ourAvgDamage = (ourTotalDamage / response.clan.attacks) * 100;
				const enemyAvgDamage = (enemyTotalDamage / response.opponent.attacks) * 100;
				
				message += `\n💥 **ORTALAMA HASAR**\n`;
				message += `Bizim: %${ourAvgDamage.toFixed(1)}\n`;
				message += `Rakip: %${enemyAvgDamage.toFixed(1)}\n`;
			}
		}
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Savaş geçmişi
const getWarLog = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.clanWarlogByTag('#9CPU2CQR');
		const { items } = response;
		
		message += '*****📋 Savaş Geçmişi*****\n\n';
		
		for (let i = 0; i < Math.min(items.length, 5); i++) {
			const war = items[i];
			const safeClanName = escapeHtml(war.clan.name);
			const safeOpponentName = escapeHtml(war.opponent.name);
			
			message += `${i+1}. ${safeClanName} vs ${safeOpponentName}\n`;
			message += `   ${getWarResult(war.result)} - ⭐${war.clan.stars} vs ⭐${war.opponent.stars}\n`;
			message += `   💥 %${war.clan.destructionPercentage} vs %${war.opponent.destructionPercentage}\n`;
			message += `   👥 ${war.teamSize}v${war.teamSize}\n`;
			
			if (war.endTime) {
				const endDate = parseApiDate(war.endTime);
				if (endDate && !isNaN(endDate.getTime())) {
					message += `   📅 ${endDate.toLocaleDateString('tr-TR')}\n`;
				}
			}
			message += '\n';
		}
		
		if (items.length > 5) {
			message += `... ve ${items.length - 5} savaş daha\n`;
		}
		
		// İstatistikler
		const wins = items.filter(war => war.result === 'win').length;
		const losses = items.filter(war => war.result === 'lose').length;
		const ties = items.filter(war => war.result === 'tie').length;
		
		message += `\n📊 **SON ${items.length} SAVAŞ İSTATİSTİKLERİ**\n`;
		message += `🎉 Galibiyet: ${wins}\n`;
		message += `😞 Mağlubiyet: ${losses}\n`;
		message += `🤝 Beraberlik: ${ties}\n`;
		
		if (items.length > 0) {
			const winRate = Math.round((wins / items.length) * 100);
			message += `📈 Kazanma Oranı: %${winRate}\n`;
		}
		
	} catch (e) {
		message = clashOfClansReplies.getErrorMessage(e);
	}
	ctx.replyWithHTML(message);
};

// Klan Savaş Ligi
const getWarLeague = async (ctx, clashOfClansClient) => {
	let message = '';
	try {
		const response = await clashOfClansClient.clanLeague('#9CPU2CQR');
		
		message += `***** 🏆 Klan Savaş Ligi *****\n\n`;
		message += `🎯 Durum: ${response.state}\n`;
		message += `🏆 Sezon: ${response.season}\n`;
		
		if (response.clans && response.clans.length > 0) {
			message += `\n👥 **KATILAN KLANLAR (${response.clans.length})**\n`;
			response.clans.forEach((clan, index) => {
				const safeName = escapeHtml(clan.name);
				message += `${index + 1}. ${safeName} - <code>${clan.tag}</code>\n`;
			});
		}
		
	} catch (e) {
		if (e.statusCode === 404) {
			message = '🏆 Klan şu anda Klan Savaş Ligi\'nde değil.';
		} else {
			message = clashOfClansReplies.getErrorMessage(e);
		}
	}
	ctx.replyWithHTML(message);
};

// Yardımcı fonksiyonlar
function getWarState(state) {
	switch (state) {
		case 'preparation': return 'Hazırlık 🛠️';
		case 'inWar': return 'Savaşta ⚔️';
		case 'warEnded': return 'Bitti 🏁';
		default: return state;
	}
}

function getBattleModifier(modifier) {
	switch (modifier) {
		case 'none': return 'Normal';
		case 'friendly': return 'Dostane';
		default: return modifier;
	}
}

function getWarResult(result) {
	switch (result) {
		case 'win': return '🎉 Kazandık';
		case 'lose': return '😞 Kaybettik';
		case 'tie': return '🤝 Berabere';
		default: return result;
	}
}

module.exports = {
	getCurrentWar,
	getNonAttackers,
	getWarAnalysis,
	getWarLog,
	getWarLeague,
};
