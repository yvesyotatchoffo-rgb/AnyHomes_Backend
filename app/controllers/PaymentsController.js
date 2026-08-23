const db = require("../models");
var mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const agenda = require("../config/agenda.config");
const ReferralService = require("../services/referral.service");

module.exports = {
  payWithCard: async (req, res) => {
    try {
      const { userId, amount, planId, planType, interval, currency } = req.body;

      if (
        !userId ||
        amount === undefined ||
        !planId ||
        !currency ||
        !interval
      ) {
        return res.status(400).json({
          success: false,
          message: "Payload missing.",
        });
      }

      const findUser = await db.users.findOne({
        _id: userId,
        isDeleted: false,
      });
      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "User not found.",
        });
      }

      const activeSub = await db.subscription.findOne({
        userId,
        status: "active",
        isDeleted: false
      })

      if (activeSub) {
        return res.status(400).json({
          success: false,
          message: "You have an active subscription. Please cancel it first to active this plan."
        })
      }

      let customerId = findUser.customerId;

      let customerExists = false;
      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
          customerExists = true;
        } catch (error) {
          console.warn("Customer not found in Stripe. Creating a new one...");
          customerExists = false;
        }
      }

      if (!customerExists) {
        const customer = await stripe.customers.create({
          email: findUser.email,
          name: findUser.fullName,
        });

        customerId = customer.id;

        await db.users.findByIdAndUpdate(userId, { customerId });
      }

      console.log("Stripe Customer ID:", customerId);

      const findPlan = await db.plans.findOne({
        _id: planId,
        isDeleted: false,
        status: "active",
      });
      if (!findPlan) {
        return res.status(400).json({
          success: false,
          message: "Plan either doesn't exists or hasn't activated.",
        });
      }

      const matchingPrice = findPlan.pricing.find(
        (p) =>
          p.currency === currency &&
          p.unit_amount === amount &&
          p.interval === interval,
      );

      if (!matchingPrice) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment amount, currency, or interval for selected plan.",
        });
      }

      if (planType === "free") {
        await db.users.updateOne(
          {
            _id: userId,
            isDeleted: false,
          },
          {
            planId: planId,
            planType: planType,
            planDuration: interval,
          },
        );
        let now = new Date();
        const createTransaction = await db.payments.create({
          userId,
          amount: Number(amount),
          currency,
          planId,
          planType,
          paymentIntendId: `TSX-${now}`,
          paymentStatus: "successfull",
          addedBy: req.identity.id,
          customerId: customerId,
        });

        await db.subscription.create({
          userId,
          planId,
          planType,
          amount: 0,
          interval,
          addedBy: req.identity.id,
          subscriptionId: `sub_${now}`,
          status: "active",
        });

        return res.status(200).json({
          success: true,
          message: "Your free plan is now activated.",
        });
      }
      let primary_card = await db.cards.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
        isPrimary: true,
        paymentMethod: "stripe",
      });

      if (!primary_card) {
        return res.status(400).json({
          success: false,
          message: "No primary card found.",
        });
      }
      console.log("Primary Card ID:", primary_card.cardId);

      await stripe.paymentMethods.attach(primary_card.cardId, {
        customer: customerId,
      });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: primary_card.cardId },
      });
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: matchingPrice.stripe_price_id }],
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId,
          planId,
          planType,
          interval,
        },
      });

      console.log("subscription", subscription);

      const createPayment = await db.payments.create({
        userId,
        amount: findPlan.amount,
        currency,
        planId,
        planType,
        paymentIntendId: subscription.latest_invoice.payment_intent.id,
        // paymentIntendId: null,
        paymentStatus: "pending",
        addedBy: req.identity.id,
        customerId,
        paymentMethod: "stripe",
      });
      console.log("payment started ----------------------- - - - - - - - - --");

      return res.status(200).json({
        success: true,
        message: "Subscription created, pending payment confirmation.",
        subscriptionId: subscription.id,
        paymentId: createPayment._id,
        status: subscription.status,
        amount: amount,
        cardLast4: primary_card.last4,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Issue ocurred during payment.",
        error: err.message,
      });
    }
  },
  getAllPayments: async (req, res) => {
    try {
      const { userId } = req.query;
      let page = req.query.page || 1;
      let count = req.query.count || 10;
      let query = {
        isDeleted: false,
        userId,
      };
      const skip = (page - 1) * count;
      const getData = await db.payments
        .find(query)
        .sort({ createdAt: -1 }) // Sort by creation date in descending order (most recent first)
        .skip(skip)
        .limit(Number(count));
      if (!getData) {
        return res.status(400).json({
          success: false,
          message: "No payment history found",
        });
      }
      const total = await db.payments.countDocuments(query);
      return res.status(200).json({
        success: true,
        message: "Payment history fetched",
        data: getData,
        total,
      });
    } catch {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch payment history",
      });
    }
  },
  webhook: async (req, res) => {
    try {
      // console.log(req.body, "body-----------------------")
      const event = req.body;
      const eventObject = event.data.object;

      switch (event.type) {
        case "payment_intent.succeeded": {
          const intent = event.data.object;
          console.log("THIS IS THE INTENT:", intent);
          const { userId, planId, planType, interval } = intent.metadata;

          if (intent?.metadata?.type === "campaign") {
            console.log("INSIDE CAMP:");
            await db.campaignPayments.findOneAndUpdate(
              { paymentIntendId: intent.id },
              { paymentStatus: "successfull" },
              { new: true },
            );

            const startCampaign = await db.peerCampaign.create({
              referencePrice: intent?.metadata?.referencePrice,
              campaignName: intent?.metadata?.campaignName,
              propertyId: intent?.metadata?.propertyId,
              userId: intent?.metadata?.userId,
              duration: intent?.metadata?.duration,
              status: "active",
              startDate: intent?.metadata?.startDate,
              endDate: intent?.metadata?.endDate,
              pricePerSqm: intent?.metadata?.pricePerSqm,
            });
            console.log("CAMP STARTED.", startCampaign);

            await agenda.schedule(
              intent?.metadata?.endDate,
              "expire-active-campaign",
              {
                campaginId: startCampaign._id,
              },
            );
            console.log("CLOSE CAMP AGENDA LOADED.");
            break;
          }
          // console.log(intent.metadata, "intent.metadata-----------------------------------------------------");

          // const user = await db.users.findOne({ _id: userId, isDeleted: false });
          // const plan = await db.plans.findOne({ _id: planId, isDeleted: false });
          // if (!user || !plan) break;

          // const matchingPrice = plan.pricing.find(p =>
          //     p.currency === intent.currency &&
          //     p.interval === interval
          // );
          // console.log("matchingPrice", matchingPrice);

          // await db.payments.updateOne(
          //     {
          //         paymentIntendId: intent.id,
          //         userId: userId
          //     },
          //     {
          //         paymentStatus: "successfull",
          //         doneBy: user.fullName,
          //         paymentMethod: "stripe",
          //     }
          // );
          // console.log("USER_PAYMENT_UPDATED---------");

          // let updateUser = await db.users.updateOne({
          //     _id: userId, isDeleted: false
          // }, {
          //     planId: planId,
          //     planType: plan.planType,
          //     planDuration: interval,
          //     dailyCampaignUsage: plan.dailyCampaignLimit,
          //     weeklyCampaignUsage: plan.weeklyCampaignLimit,
          //     monthlyCampaignUsage: plan.monthlyCampaignLimit,
          //     directoryMessageUsage: plan.messageToDirectoryOwners,
          //     totalOwnerMessages: plan.messagesToOwners
          // })

          // console.log("USER_PLAN_UPDATED---------");

          // if (intent.payment_method) {
          //     const paymentMethodId = intent.payment_method;
          //     await stripe.paymentMethods.attach(paymentMethodId, {
          //         customer: user.customerId,
          //     });

          //     // 2. Set it as default
          //     await stripe.customers.update(user.customerId, {
          //         invoice_settings: {
          //             default_payment_method: paymentMethodId,
          //         },
          //     })
          //     console.log("Method attached---------------------------");
          // }

          // // const subscription = await stripe.subscriptions.create({
          // //     customer: user.customerId,
          // //     items: [{ price: matchingPrice.stripe_price_id }],
          // //     metadata: {
          // //         userId,
          // //         planId,
          // //         interval
          // //     },
          // //     expand: ['latest_invoice.payment_intent']
          // // });

          // console.log("stripe subscritpion created at payment intend--------------------------------");

          // const validUpto = new Date();
          // if (interval === "month") validUpto.setMonth(validUpto.getMonth() + 1);
          // else if (interval === "year") validUpto.setFullYear(validUpto.getFullYear() + 1)

          // const createSubscription = await db.subscription.create({
          //     planId,
          //     userId,
          //     amount: Number(intent.amount_received) / 100,
          //     planType,
          //     interval,
          //     stripe_price_id: matchingPrice.stripe_price_id,
          //     validUpto,
          //     subscriptionId: subscription.id,
          //     status: "active",
          //     addedBy: userId,
          // });
          // console.log("Subscription created after initial payment:", subscription.id);
          // break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          console.log("INVOICE:", invoice);
          console.log(
            "INVOICESUBSCRIPTION:",
            invoice.parent.subscription_details.metadata,
          );

          if (invoice.billing_reason === "subscription_create") {
            console.log("FIRST BILLING-----------------");
            // const intent = await stripe.paymentIntents.retrieve(invoice.payment_intent);
            // console.log("THIS IS THE INTENT:", intent);
            // const subscriptionId = invoice.subscription;
            // const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            // const { userId, planId, planType, interval } = subscription.metadata;
            // if (!userId || !planId || !interval) break;
            const subscriptionId =
              invoice.parent?.subscription_details?.subscription;
            const metadata = invoice.parent?.subscription_details?.metadata;

            if (!subscriptionId || !metadata) {
              console.warn(
                "Missing subscription ID or metadata in invoice.parent",
              );
              return;
            }

            const { userId, planId, planType, interval } = metadata;
            if (!userId || !planId || !interval) return;

            const subscription =
              await stripe.subscriptions.retrieve(subscriptionId);
            const latestInvoiceId = subscription.latest_invoice;
            const latestInvoice =
              await stripe.invoices.retrieve(latestInvoiceId);
            const paymentIntentId = latestInvoice.payment_intent;

            let intent = null;
            if (paymentIntentId) {
              intent = await stripe.paymentIntents.retrieve(paymentIntentId);
            }

            const user = await db.users.findOne({
              _id: userId,
              isDeleted: false,
            });
            const plan = await db.plans.findOne({
              _id: planId,
              isDeleted: false,
            });
            if (!user || !plan) break;

            const matchingPrice = plan.pricing.find(
              (p) => p.currency === intent.currency && p.interval === interval,
            );
            console.log("matchingPrice", matchingPrice);

            await db.payments.updateOne(
              {
                paymentIntendId: intent.id,
                userId: userId,
              },
              {
                paymentStatus: "successfull",
                doneBy: user.fullName,
                paymentMethod: "stripe",
              },
            );
            console.log("USER_PAYMENT_UPDATED---------");

            await db.users.updateOne(
              {
                _id: userId,
                isDeleted: false,
              },
              {
                planId: planId,
                planType: plan.planType,
                planDuration: interval,
                dailyCampaignUsage: 0,
                weeklyCampaignUsage: 0,
                monthlyCampaignUsage: 0,
                directoryMessageUsage: 0,
                totalOwnerMessages: 0,
                // directoryMessageUsage: plan.messageToDirectoryOwners,
                // totalOwnerMessages: plan.messagesToOwners
              },
            );
            console.log("USER_PLAN_UPDATED---------");

            if (intent.payment_method) {
              const paymentMethodId = intent.payment_method;
              await stripe.paymentMethods.attach(paymentMethodId, {
                customer: user.customerId,
              });

              await stripe.customers.update(user.customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              });
              console.log("Method attached---------------------------");
            }

            const validUpto = new Date();
            if (interval === "month")
              validUpto.setMonth(validUpto.getMonth() + 1);
            else if (interval === "year")
              validUpto.setFullYear(validUpto.getFullYear() + 1);

            const createSubscription = await db.subscription.create({
              planId,
              userId,
              amount: Number(intent.amount_received) / 100,
              planType,
              interval,
              stripe_price_id: matchingPrice.stripe_price_id,
              validUpto,
              subscriptionId: subscription.id,
              status: "active",
              addedBy: userId,
            });
            console.log(
              "Subscription created after initial payment:",
              subscription.id,
            );

            // Programme de parrainage : commission pro_subscription
            try {
              const payer = await db.users.findById(userId).select("_id accountType").lean();
              if (payer) {
                const amountReceived = Number(intent.amount_received) || 0;
                const amountHtCents = Math.round((amountReceived / 1.2) * 100);
                await ReferralService.createCommissionForPayment({
                  userId: String(payer._id),
                  amountHtCents,
                  paymentId: intent.id,
                  subscriptionId: createSubscription._id,
                  invoiceId: invoice.id || null,
                  revenueType: "pro_subscription",
                });
              }
            } catch (referralErr) {
              console.error("[Referral] commission subscription error:", referralErr.message);
            }
            return;
          }
          if (
            invoice.billing_reason === "subscription_cycle" &&
            invoice.amount_paid > 0
          ) {
            console.log(
              "CYCLE BILLING-----------------------------------------------",
            );
            const subscriptionId = invoice.subscription;

            const { userId, planId, planType, interval } = invoice.metadata;

            const plan = await db.plans.findOne({
              _id: planId,
              isDeleted: false,
            });
            if (!plan) break;

            const validUpto = new Date();
            if (interval === "month")
              validUpto.setMonth(validUpto.getMonth() + 1);
            else if (interval === "year")
              validUpto.setFullYear(validUpto.getFullYear() + 1);

            const matchingPrice = plan.pricing.find(
              (p) => p.interval === interval && p.currency === invoice.currency,
            );

            await db.subscription.updateOne(
              { subscriptionId, userId, status: "active", isDeleted: false },
              {
                validUpto,
                updatedAt: new Date(),
                status: "active",
                trialEnd: null,
                // twoWeekReminder: false,
                // oneWeekRemainder: false,
                // oneDayReminder: false,
              },
            );
            await db.payments.create({
              userId,
              amount: invoice.amount_paid / 100,
              currency: invoice.currency,
              planId,
              planType,
              paymentIntendId: invoice.payment_intent,
              subscriptionId,
              paymentStatus: "successfull",
              customerId: invoice.customer,
              doneBy: "Auto Renewal",
              paymentMethod: "stripe",
            });

            console.log(
              "Subscription renewal success nad payment log created:",
              subscriptionId,
            );
          }

          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          let getData = await db.subscription.findOne({
            subscriptionId: eventObject.id,
          });
          if (subscription.status === "canceled") {
            let findUser = await db.subscription.findOne({
              subscriptionId: eventObject.id,
            });
            let deleteSubscrption = await db.subscription.updateOne(
              { subscriptionId: subscription.id },
              { status: "inactive", validUpto: null },
            );
            // const findFreePlan = await db.plans.findOne({ planType: "free", status: "active", isDeleted: false })
            // const userId = new mongoose.Types.ObjectId(findUser.userId);
            // const updateUserPlan = await db.users.updateOne({
            //     _id: userId
            // }, {
            //     planId: findFreePlan._id,
            //     planType: findFreePlan.planType,
            // })

            // console.log(updateUserPlan);
            // if (updateUserPlan.modifiedCount === 0) {
            //     console.log("User plan update failed.");
            // } else {
            //     console.log("User moved to base plan successfully!");
            // }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;

          // let findUser = await db.subscription.findOne({ subscriptionId: eventObject.id })
          const findSubscription = await db.subscription.findOne({
            subscriptionId,
            isDeleted: false,
          });
          if (!findSubscription) break;

          await db.subscription.updateOne(
            { subscriptionId },
            {
              $set: {
                paymentStatus: "canceled",
                updatedAt: new Date(),
                validUpto: null,
              },
            },
          );
          // const findFreePlan = await db.plans.findOne({ planType: "free", status: "active", isDeleted: false })
          // const userId = new mongoose.Types.ObjectId(findUser.userId);
          const updateUserPlan = await db.users.updateOne(
            {
              _id: findSubscription.userId,
            },
            {
              planId: null,
              planType: null,
            },
          );
          // console.log(updateUserPlan);
          // if (updateUserPlan.modifiedCount === 0) {
          //     console.log("User plan update failed.");
          // } else {
          //     console.log("User moved to base plan successfully!");
          // }

          break;
        }

        case "customer.subscription.trial_will_end": {
          // occurs three days before trail ending
          const subscription = event.data.object;

          const userId = subscription.metadata?.userId;
          const planId = subscription.metadata?.planId;

          console.log(
            `Trial is about to end for subscription ${subscription.id}`,
          );

          const findAdmin = await db.users.find({
            isDeleted: false,
            role: "admin",
          });

          if (userId) {
            await db.notifications.create({
              sendTo: userId,
              sendBy: findAdmin[0]._id,
              status: "unread",
              title: "Your free trial is ending soon!",
              message:
                "Your subscription trial will end in 3 days. We will charge your saved card automatically unless you cancel.",
              type: "stripeTrialEnd",
            });
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      res.status(200).json({ success: true });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Webhook Failed.",
        error: err.message,
      });
    }
  },

  purchaseTrialplan: async (req, res) => {
    try {
      const { planId, userId } = req.body;
      if (!planId || !userId) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }
      const [findPlan, findUser] = await Promise.all([
        await db.plans.findOne({ _id: planId, isDeleted: false, status: "active" }),
        await db.users.findOne({ _id: userId, isDeleted: false }),
      ]);
      if (!findPlan || !findUser) {
        return res.status(400).json({
          success: false,
          message: "Plan or User not found.",
        });
      }
      // if (findUser.planId) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "You already have a active plan.",
      //   });
      // }
      const activeSubscription = await db.subscription.findOne({
        userId: userId,
         status: "active"})
      if(activeSubscription){
          return res.status(400).json({
          success: false,
          message: "You already have a active plan.",
        });
      }

      let now = new Date();
      if (
        !findUser.trialUserForPlan &&
        findUser.freeTrialStatus === "pending"
      ) {
        // Durée de l'essai : trialPeriod du plan (fallback 3 jours).
        const trialPlan = await db.plans.findById(planId);
        const trialDays =
          trialPlan?.trialPeriod && Number(trialPlan.trialPeriod) > 0
            ? Number(trialPlan.trialPeriod)
            : 3;
        const trialExpiryDate = new Date(
          now.getTime() + trialDays * 24 * 60 * 60 * 1000
        );
        const transaction = await db.payments.create({
          userId,
          planId,
          amount: 0,
          planType: "trial",
          paymentIntendId: `TSX-${now}`,
          paymentStatus: "successfull",
          status: "active",
          addedBy: req.identity.id,
        });
        await db.users.updateOne(
          { _id: userId },
          {
            planId,
            trialUserForPlan: planId,
            freeTrialStatus: "done",
            trialPlanDate: new Date(),
            trialExpiryDate,
          },
        );
        await agenda.schedule(
          trialExpiryDate,
          "deactivate-trial-plan",
          { userId },
        );
        return res.status(200).json({
          success: true,
          message: "Trial plan activated.",
          data: { transaction, trialDays, trialExpiryDate },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "You have already used your trial.",
        });
      }
    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Failed to purchase trial plan.",
        error: err.message,
      });
    }
  },

  updateSubscriptionPlan: async (req, res) => {
    try {
      const { userId, planId, interval, planType } = req.body;

      if (!userId || !planId || !interval || !planType) {
        return res.status(400).json({
          success: false,
          message: "User Id, interval and Plan Id are required.",
        });
      }

      const [user, newPlan] = await Promise.all([
        db.users.findOne({ _id: userId, isDeleted: false }),
        db.plans.findOne({ _id: planId, isDeleted: false, status: "active" }),
      ]);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User not found.",
        });
      }

      if (!newPlan) {
        return res.status(400).json({
          success: false,
          message: "Plan either doesn't exist or hasn't been activated.",
        });
      }

      let customerId = user.customerId;
      if (!customerId) {
        if (!customerExists) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.fullName,
          });

          customerId = customer.id;

          await db.users.findByIdAndUpdate(userId, { customerId });
        }

        console.log("Stripe Customer ID:", customerId);
      }

      const activeSubscription = await db.subscription.findOne({
        userId: userId,
        status: "active",
        isDeleted: false,
      });

      // if (!activeSubscription) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "No active subscription found for this user.",
      //   });
      // }

      //   console.log(
      //     "Current subscription interval:",
      //     activeSubscription.interval,
      //   );
      //   console.log("activeSubscription", activeSubscription);

      const currentInterval = interval || activeSubscription?.interval;
      const currency = activeSubscription?.currency || "eur";

      const matchingPrice = newPlan.pricing.find(
        (p) => p.currency === currency && p.interval === currentInterval,
      );

      //   console.log("matchingPrice", matchingPrice);

      if (!matchingPrice) {
        return res.status(400).json({
          success: false,
          message: `No ${currentInterval}ly pricing found for the new plan.`,
        });
      }

      if (!matchingPrice.stripe_price_id) {
        return res.status(400).json({
          success: false,
          message:
            "Plan price is not configured with Stripe. Please contact support.",
        });
      }

      //   console.log("Matching Price:", matchingPrice);
      //   console.log(
      //     `Upgrading to plan: ${newPlan.name}, Amount: $${matchingPrice.unit_amount}, Interval: ${currentInterval}`,
      //   );

      let stripeSubscription;


      if (!activeSubscription || activeSubscription?.planType === "free") {
        let primary_card = await db.cards.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          isPrimary: true,
          paymentMethod: "stripe",
        });

        if (!primary_card) {
          return res.status(400).json({
            success: false,
            message: "No primary card found.",
          });
        }
        console.log("Primary Card ID:", primary_card.cardId);

        await stripe.paymentMethods.attach(primary_card.cardId, {
          customer: customerId,
        });
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: primary_card.cardId },
        });
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: matchingPrice.stripe_price_id }],
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            userId,
            planId,
            planType,
            interval,
          },
        });
      } else {

        try {
          stripeSubscription = await stripe.subscriptions.retrieve(
            activeSubscription?.subscriptionId,
          );
          // console.log("Current Stripe subscription:", {
          //   id: stripeSubscription.id,
          //   status: stripeSubscription.status,
          //   current_period_end: stripeSubscription.current_period_end,
          //   interval:
          //     stripeSubscription.items.data[0]?.price?.recurring?.interval,
          // });
        } catch (stripeError) {
          console.error("Stripe subscription retrieval error:", stripeError);
          return res.status(400).json({
            success: false,
            message: "Stripe subscription not found.",
            error: stripeError.message,
          });
        }

        let updatedSubscription;
        try {
          updatedSubscription = await stripe.subscriptions.update(
            activeSubscription.subscriptionId,
            {
              cancel_at_period_end: false,
              proration_behavior: "create_prorations",
              items: [
                {
                  id: stripeSubscription.items.data[0].id,
                  price: matchingPrice.stripe_price_id,
                },
              ],
            },
          );
          // console.log("Updated Stripe subscription:", {
          //   id: updatedSubscription.id,
          //   new_plan: newPlan.name,
          //   new_amount: matchingPrice.unit_amount,
          //   new_interval: currentInterval,
          // });
        } catch (updateError) {
          console.error("Stripe subscription update error:", updateError);
          return res.status(400).json({
            success: false,
            message: "Failed to update subscription in Stripe.",
            error: updateError.message,
          });
        }

        let validUpto = new Date();
        if (currentInterval === "month") {
          validUpto.setMonth(validUpto.getMonth() + 1);
        } else if (currentInterval === "year") {
          validUpto.setFullYear(validUpto.getFullYear() + 1);
        }

        const data1 = await db.subscription.updateOne(
          { _id: activeSubscription._id },
          {
            planId: planId,
            stripe_price_id: matchingPrice.stripe_price_id,
            amount: matchingPrice.unit_amount,
            interval: currentInterval,
            status: "active",
            validUpto: validUpto,
            updatedAt: new Date(),
          },
        );
        //   console.log("data1", data1);

        await db.users.updateOne(
          { _id: userId },
          {
            planId: planId,
            planType: "paid",
            planDuration: currentInterval,
            updatedAt: new Date(),
          },
        );

        await db.payments.create({
          userId,
          planId,
          amount: matchingPrice.unit_amount,
          currency: currency,
          planType: "paid",
          paymentStatus: "successfull",
          addedBy: req.identity.id || userId,
          customerId: user.customerId,
          stripePriceId: matchingPrice.stripe_price_id,
          stripeSubscriptionId: activeSubscription.subscriptionId,
          paymentMethod: "stripe",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Subscription updated successfully.",
        data: {
          // subscriptionId: activeSubscription.subscriptionId,
          newPlan: newPlan.name,
          amount: matchingPrice.unit_amount,
          currency: currency,
          interval: currentInterval,
        //   validUpto: validUpto,
        //   stripeSubscription: {
        //     id: updatedSubscription.id,
        //     status: updatedSubscription.status,
        //     current_period_end: updatedSubscription.current_period_end,
        //   },
        },
      });
    } catch (err) {
      console.error("ERROR in updateSubscriptionPlan:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to update subscription plan.",
        error: err.message,
      });
    }
  },
};
