const onboarding = require('../controllers/OnboardingController');
const router = require('express').Router();

router.get('/state', onboarding.getState);
router.get('/admin/list', onboarding.getAdminList);
router.get('/admin/detail', onboarding.getAdminDetail);
router.put('/profile', onboarding.updateProfile);
router.put('/objective', onboarding.updateObjective);
router.post('/event', onboarding.sendEvent);
router.post('/celebration-seen', onboarding.markCelebrationSeen);

module.exports = router;
