const axios = require('axios');

class ClashOfClansAPI {
    constructor(token = null, database = null) {
        this.database = database;
        this.token = token;
        this.client = null;
        
        // İlk başlatma
        this.initializeClient();
    }

    async initializeClient() {
        if (!this.token) {
            if (this.database) {
                try {
                    this.token = await this.database.getConfig('coc_api_key');
                } catch (error) {
                    console.error('❌ Veritabanından API key alınamadı:', error);
                }
            } else {
                this.token = process.env.COC_API_TOKEN;
            }
        }
        
        if (!this.token) {
            throw new Error('❌ COC_API_TOKEN bulunamadı! Lütfen setup.js ile konfigürasyonu yapın veya .env dosyasında COC_API_TOKEN değişkenini tanımlayın.');
        }

        this.client = axios.create({
            baseURL: 'https://api.clashofclans.com/v1',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 saniye timeout
        });

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            response => response.data,
            error => {
                if (error.response) {
                    // API'den gelen hata
                    const status = error.response.status;
                    const message = error.response.data?.reason || error.response.data?.message || 'Bilinmeyen API hatası';
                    throw new Error(`API Hatası (${status}): ${message}`);
                } else if (error.request) {
                    // Network hatası
                    throw new Error('Ağ hatası: API\'ye bağlanılamıyor');
                } else {
                    throw new Error(`İstek hatası: ${error.message}`);
                }
            }
        );
    }

    // Client'ın hazır olduğundan emin ol
    async ensureClient() {
        if (!this.client) {
            await this.initializeClient();
        }
    }

    // Klan bilgilerini getir
    async clanByTag(clanTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(clanTag);
        return await this.client.get(`/clans/${encodedTag}`);
    }

    // Klan üyelerini getir
    async clanMembersByTag(clanTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(clanTag);
        return await this.client.get(`/clans/${encodedTag}/members`);
    }

    // Mevcut savaş bilgilerini getir
    async clanCurrentWarByTag(clanTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(clanTag);
        return await this.client.get(`/clans/${encodedTag}/currentwar`);
    }

    // Savaş geçmişini getir
    async clanWarlogByTag(clanTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(clanTag);
        return await this.client.get(`/clans/${encodedTag}/warlog`);
    }

    // Klan Savaş Ligi bilgilerini getir
    async clanLeague(clanTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(clanTag);
        return await this.client.get(`/clans/${encodedTag}/currentwar/leaguegroup`);
    }

    // Klan Savaş Ligi savaş detaylarını getir
    async clanLeagueWars(warTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(warTag);
        return await this.client.get(`/clanwarleagues/wars/${encodedTag}`);
    }

    // Başkent Baskın Sezonları bilgilerini getir
    async clanCapitalRaidSeasons(clanTag, params = {}) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(clanTag);
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/clans/${encodedTag}/capitalraidseasons${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    // Oyuncu bilgilerini getir
    async playerByTag(playerTag) {
        await this.ensureClient();
        const encodedTag = encodeURIComponent(playerTag);
        return await this.client.get(`/players/${encodedTag}`);
    }

    // Klan arama
    async clans() {
        await this.ensureClient();
        return {
            withWarFrequency: (frequency) => {
                this.searchParams = { ...this.searchParams, warFrequency: frequency };
                return this;
            },
            withMinMembers: (minMembers) => {
                this.searchParams = { ...this.searchParams, minMembers };
                return this;
            },
            withName: (name) => {
                this.searchParams = { ...this.searchParams, name };
                return this;
            },
            withLocationId: (locationId) => {
                this.searchParams = { ...this.searchParams, locationId };
                return this;
            },
            fetch: async () => {
                const params = new URLSearchParams(this.searchParams || {});
                this.searchParams = {}; // Reset search params
                return await this.client.get(`/clans?${params.toString()}`);
            }
        };
    }

    // Lokasyonları getir
    async locations() {
        await this.ensureClient();
        return {
            withId: (locationId) => {
                this.locationId = locationId;
                return this;
            },
            byClan: () => {
                this.rankingType = 'clans';
                return this;
            },
            byPlayer: () => {
                this.rankingType = 'players';
                return this;
            },
            fetch: async () => {
                if (this.locationId && this.rankingType) {
                    const result = await this.client.get(`/locations/${this.locationId}/rankings/${this.rankingType}`);
                    this.locationId = null;
                    this.rankingType = null;
                    return result;
                } else if (this.locationId) {
                    const result = await this.client.get(`/locations/${this.locationId}`);
                    this.locationId = null;
                    return result;
                } else {
                    return await this.client.get('/locations');
                }
            }
        };
    }

    // Basit location ranking metodları
    async clansByLocation(locationId, params = {}) {
        await this.ensureClient();
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/locations/${locationId}/rankings/clans${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    async playersByLocation(locationId, params = {}) {
        await this.ensureClient();
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/locations/${locationId}/rankings/players${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    // Builder Base oyuncu sıralaması
    async playersByLocationBuilderBase(locationId, params = {}) {
        await this.ensureClient();
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/locations/${locationId}/rankings/players-builder-base${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    // Builder Base klan sıralaması
    async clansByLocationBuilderBase(locationId, params = {}) {
        await this.ensureClient();
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/locations/${locationId}/rankings/clans-builder-base${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    // Başkent sıralaması
    async capitalsByLocation(locationId, params = {}) {
        await this.ensureClient();
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/locations/${locationId}/rankings/capitals${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    // Belirli lokasyon bilgisi
    async locationById(locationId) {
        await this.ensureClient();
        return await this.client.get(`/locations/${locationId}`);
    }

    // Savaş liglerini getir
    async warLeagues() {
        await this.ensureClient();
        return await this.client.get('/warleagues');
    }

    // Belirli savaş ligi bilgisini getir
    async warLeagueById(leagueId) {
        await this.ensureClient();
        return await this.client.get(`/warleagues/${leagueId}`);
    }

    // Ligleri getir
    async leagues() {
        await this.ensureClient();
        return await this.client.get('/leagues');
    }

    // Belirli lig bilgisini getir
    async leagueById(leagueId) {
        await this.ensureClient();
        return await this.client.get(`/leagues/${leagueId}`);
    }

    // Lig sezonlarını getir
    async leagueSeasons(leagueId) {
        await this.ensureClient();
        return await this.client.get(`/leagues/${leagueId}/seasons`);
    }

    // Lig sezonu sıralamalarını getir
    async leagueSeasonRankings(leagueId, seasonId, params = {}) {
        await this.ensureClient();
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const url = `/leagues/${leagueId}/seasons/${seasonId}${queryString ? `?${queryString}` : ''}`;
        return await this.client.get(url);
    }

    // Başkent liglerini getir
    async capitalLeagues() {
        await this.ensureClient();
        return await this.client.get('/capitalleagues');
    }

    // Belirli başkent ligi bilgisini getir
    async capitalLeagueById(leagueId) {
        await this.ensureClient();
        return await this.client.get(`/capitalleagues/${leagueId}`);
    }

    // Builder Base liglerini getir
    async builderBaseLeagues() {
        await this.ensureClient();
        return await this.client.get('/builderbaseleagues');
    }

    // Belirli Builder Base ligi bilgisini getir
    async builderBaseLeagueById(leagueId) {
        await this.ensureClient();
        return await this.client.get(`/builderbaseleagues/${leagueId}`);
    }
}

// Factory function - database referansı ile oluştur
const createClashApi = (options = {}) => {
    const { token, database } = options;
    return new ClashOfClansAPI(token, database);
};

module.exports = createClashApi; 