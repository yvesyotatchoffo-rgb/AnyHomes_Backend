module.exports = {
  baseUrl: (process.env.MOTEURIMMO_BASE_URL || 'https://moteurimmo.fr').replace(/\/+$/, ''),
  apiKey: process.env.MOTEURIMMO_API_KEY || '',
  defaultPageSize: Number(process.env.MOTEURIMMO_PAGE_SIZE) || 100,
  pollIntervalMinutes: Number(process.env.MOTEURIMMO_POLL_MINUTES) || 10,
  maxSyncPages: Number(process.env.MOTEURIMMO_MAX_SYNC_PAGES) || 3,
};
