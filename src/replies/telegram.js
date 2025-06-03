const clan = require('../callbacks/clan');

const getStarted = async (clashOfClansClient, userInfo = null) => {
	const client = clashOfClansClient;
	const clanName = await clan.getClanName(client);
	
	// Kullanıcı ID bilgisi
	let userIdSection = '';
	if (userInfo) {
		const firstName = userInfo.first_name || 'Kullanıcı';
		const username = userInfo.username ? ` (@${userInfo.username})` : '';
		userIdSection = `
👤 **Kullanıcı Bilgilerin:**
• Ad: ${firstName}${username}
• Telegram ID: \`${userInfo.id}\`

💡 **ID'ini paylaş:** Admin olmak isteyen arkadaşlarına bu ID'yi verebilirsin!

`;
	}
	
	return `
🎮 **${clanName} Clash of Clans Bot**

Merhaba! ${clanName} klanının resmi botuna hoş geldin!
Klan bilgilerinizi kolayca öğrenmek için aşağıdaki komutları kullanabilirsin:

<b>🏛️ Klan Komutları</b>
/klan - Klanın genel bilgileri ve istatistikleri
/uyeler - Tüm klan üyelerinin detaylı listesi
/baskinlar - Başkent baskın sezonları ve istatistikleri

<b>👤 Oyuncu Komutları</b>
/oyuncu #tag - Herhangi bir oyuncunun detaylı bilgileri

<b>⚔️ Savaş Komutları</b>
/savas - Mevcut savaş durumu ve skorları
/savas_analiz - Detaylı savaş performans analizi
/savas_saldirmayanlar - Saldırı yapmayan üyeler
/savas_gecmis - Son savaşların geçmişi
/savas_lig - Klan Savaş Ligi durumu

<b>🏆 Lig ve Sıralama</b>
/tum_ligler - Tüm lig sistemlerinin özeti
/ligler - Savaş ligleri bilgileri
/basken_ligleri - Başkent (Capital) ligleri
/builder_ligleri - Builder Base ligleri
/legend_siralamasi - Legend League top sıralaması

<b>📊 Türkiye Sıralamaları</b>
/klan_siralamasi - Normal klan sıralaması
/oyuncu_siralamasi - Normal oyuncu sıralaması
/builder_oyuncu_siralama - Builder Base oyuncu sıralaması
/builder_klan_siralama - Builder Base klan sıralaması
/basken_siralama - Başkent (Capital) sıralaması

<b>❓ Yardım</b>
/yardim - Bu menüyü tekrar göster
/yardim_klan - Klan komutları detayları
/yardim_oyuncu - Oyuncu komutları detayları
/yardim_savas - Savaş komutları detayları
/yardim_lig - Lig komutları detayları

<b>🆔 Kullanıcı Bilgileri</b>
/id - Telegram ID'ni öğren

<b>💡 Hızlı Kullanım:</b>
• Direkt #ABC123 yazarak hızlı oyuncu sorgulama
• Tüm komutlar ${clanName} klanı verilerine göre çalışır

İyi oyunlar! 🔥
`;
};

module.exports = {
	getStarted,
};
