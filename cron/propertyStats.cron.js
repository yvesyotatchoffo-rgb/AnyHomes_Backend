const statsService = require('../app/services/propertyStats.service');

module.exports = (agendaInstance) => {
  agendaInstance.define('property-stats-reconcile', async (job) => {
    try {
      console.log('[Cron] Running property_stats reconciliation');
      await statsService.reconcileAll();
      console.log('[Cron] property_stats reconciliation complete');
    } catch (err) {
      console.error('[Cron] property_stats reconciliation error:', err.message);
    }
  });

  // Reconcile every 6 hours to catch any drift from missed increment/decrement calls
  agendaInstance.every('6 hours', 'property-stats-reconcile');
};
