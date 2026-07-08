const db = require("../models");

module.exports = (agenda, db) => {
  agenda.define("deactivate-trial-plan", async (job) => {
    const { userId } = job.attrs.data;

    try {

      const findFreePlan = await db.subscription.findOne({
        isDeleted: false,
         status: "active",
          planType: "free"
        }).sort({createdAt: -1})

        if(findFreePlan){
          await db.users.updateOne(
        { _id: userId },
        {
          $set: {
            planId: findFreePlan._id,
            planType: findFreePlan.planType,
            planDuration: null,
            freeTrialStatus: "done"
          }
        }
      );
        }else{
      await db.users.updateOne(
        { _id: userId },
        {
          $set: {
            planId: null,
            planType: null,
            planDuration: null,
            freeTrialStatus: "done"
          }
        }
      );
    }

      console.log(`Trial plan deactivated for user ${userId}`);
    } catch (err) {
      console.error("Error deactivating trial plan:", err);
    }
  });

  //agenda to expire the active campaign
  agenda.define("expire-active-campaign", async (job) => {
    const { campaginId } = job.attrs.data;
    try {
      await db.peerCampaign.updateOne(
        { _id: campaginId },
        {
          $set: {
            status: "inactive"
          }
        }
      );
      console.log(`Active campaign expired ${campaginId}`);
    } catch (err) {
      console.error("Error expiring the active campaign:", err);
    }
  });

  // ── Coach IA Jobs ───────────────────────────────────────────────────────────
  const coachService = require("../services/coach.service");

  // Job: Process pending coach messages (plan, generate, validate)
  agenda.define("coach.process-pending-messages", async (job) => {
    try {
      const pendingRequests = await db.CoachMessageRequest.find({
        status: "received",
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      }).limit(100);

      for (const request of pendingRequests) {
        try {
          // Plan: Check dedupe
          await coachService.planMessage(request._id);

          const updated = await db.CoachMessageRequest.findById(request._id);
          if (updated.status === "dedupe_blocked") {
            continue;
          }

          // Generate: Call LLM
          const contextData = updated.payload_json || {};
          const record = await coachService.generateMessage(request._id, contextData);

          // Validate: Check constraints
          await coachService.validateMessage(record._id);

          // Send: Mark as sent
          const validatedRecord = await db.CoachMessageRecord.findById(record._id);
          if (validatedRecord.status === "valid" || validatedRecord.status === "generated") {
            await coachService.sendMessage(record._id, "polling");
          }
        } catch (err) {
          console.error(`Coach: Error processing request ${request._id}:`, err);
        }
      }

      console.log(`Coach: Processed ${pendingRequests.length} pending messages`);
    } catch (err) {
      console.error("Coach: Error in process-pending-messages job:", err);
    }
  });

  // Schedule: Run every 5 minutes
  agenda.every("5 minutes", "coach.process-pending-messages");

  // Job: Cleanup old records (retention policy)
  agenda.define("coach.cleanup-old-records", async (job) => {
    try {
      const coachDedupeService = require("../services/coachDedupe.service");
      const result = await coachDedupeService.cleanupOldRecords(13); // Delete > 13 months old

      console.log(`Coach: Cleaned up ${result.deletedCount} old history records`);
    } catch (err) {
      console.error("Coach: Error in cleanup-old-records job:", err);
    }
  });

  // Schedule: Run daily at 2 AM
  agenda.define("coach.cleanup-old-records", async (job) => {
    const coachDedupeService = require("../services/coachDedupe.service");
    try {
      const result = await coachDedupeService.cleanupOldRecords(13);
      console.log(`Coach: Cleaned up ${result.deletedCount} old history records`);
    } catch (err) {
      console.error("Coach: Error in cleanup-old-records job:", err);
    }
  });
  agenda.daily("2:00 am", "coach.cleanup-old-records");

  // ─ MoteurImmo sync job - DISABLED TO FIX SERVER STARTUP
  // try {
  //   require("../../cron/moteurimmo.cron.js")(agenda);
  // } catch (err) {
  //   console.error('Error loading moteurimmo cron:', err);
  // }
  //// agenda to delete the unused records
  //   agenda.define("cleanup-agenda-jobs", async () => {
  //   try {
  //     const result = await db.agendaJobs.deleteMany({
  //       nextRunAt: null,
  //       repeatInterval: null,
  //       lastFinishedAt: { $exists: true },
  //       lockedAt: null
  //     });

  //     console.log(`Cleaned up ${result.deletedCount} completed one-time jobs.`);
  //   } catch (err) {
  //     console.error("Error cleaning up agenda jobs:", err);
  //   }
  // });

};
