const agenda = require('../app/config/agenda.config');
const { checkStatusBatch } = require('../app/modules/moteurimmo/statusCheck');

module.exports = (agendaInstance) => {
  agendaInstance.define('moteurimmo-status-check', async (job) => {
    try {
      console.log('[MoteurImmo] Running status check job');
      await checkStatusBatch();
    } catch (err) {
      console.error('[MoteurImmo] Status check error:', err.message);
    }
  });

  agendaInstance.every('1 hour', 'moteurimmo-status-check');
};
