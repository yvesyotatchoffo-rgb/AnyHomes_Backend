const router = require('express').Router();
const wl = require('../controllers/WhiteLabelController');

router.post('/activate', wl.activate);
router.get('/dashboard', wl.dashboard);
router.get('/settings', wl.getSettings);
router.put('/settings', wl.updateSettings);
router.put('/thresholds', wl.updateThresholds);
router.get('/leads', wl.getLeads);
router.post('/invite-lead', wl.inviteLead);
router.get('/properties', wl.getProperties);
router.get('/hot-leads', wl.getHotLeads);
router.get('/collaborators', wl.getCollaborators);
router.post('/invite-collaborator', wl.inviteCollaborator);
router.delete('/collaborators/:id', wl.deleteCollaborator);
router.put('/collaborators/permissions', wl.updateCollaboratorPermissions);
router.put('/admin-toggle', wl.adminToggle);

module.exports = router;