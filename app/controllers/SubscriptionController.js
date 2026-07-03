const cron = require('node-cron');
const db = require("../models");
var mongoose = require("mongoose");
const Emails = require("../Emails/paymentEmail");
const stripe = require("stripe")(process.env.STRIPE_KEY);


// const checkAndSendSubscriptionReminders = async () => {
//     console.log("CRON RUNNING DAILY...");

//     const today = moment().startOf("day");

//     const subscriptions = await db.subscription.find({
//         status: "active",
//         isDeleted: false,
//         validUpto: { $ne: null },
//     }).populate("userId");

//     for (const sub of subscriptions) {
//         const validUpto = moment(sub.validUpto).startOf("day");
//         const daysLeft = validUpto.diff(today, "days");

//         const user = sub.userId;
//         const email = user.email;
//         console.log(email);
//         console.log("NEXT");

//         if (daysLeft === 14 && !sub.twoWeekReminder) {

//             let twoWeekEmailPayload = {
//                 email: email,
//                 userName: user.fullName,
//                 validUpto,
//                 type: "twoWeekEmail"
//             }

//             const twoWeekEmail = await Emails.subscriptionRemainder(twoWeekEmailPayload);
//             const twoWeekNotification = await db.notifications.create({
//                 sendTo: user._id,
//                 sendByWhere: "Bookaro",
//                 status: "unread",
//                 type: "paymentNofication",
//                 title: "two-week-payment-notification",
//                 message: `Hi, your subscription will end on ${validUpto.format("MMMM Do, YYYY")}. Kindly ensure your payment method is active.`
//             })
//         }

//         if (daysLeft === 7 && !sub.oneWeekRemainder) {

//             let oneWeekEmailPayload = {
//                 email: email,
//                 userName: user.fullName,
//                 validUpto,
//                 type: "oneWeekEmail"
//             }

//             const twoWeekEmail = await Emails.subscriptionRemainder(oneWeekEmailPayload);

//             const oneWeekNotification = await db.notifications.create({
//                 sendTo: user._id,
//                 sendByWhere: "Bookaro",
//                 status: "unread",
//                 type: "paymentNofication",
//                 title: "one-week-payment-notification",
//                 message: `Hi, your subscription will end on ${validUpto.format("MMMM Do, YYYY")}. Kindly ensure your payment method is active.`
//             })
//         }

//         if (daysLeft === 0 && !sub.oneDayReminder) {

//             let onDayEmailPayload = {
//                 email: email,
//                 userName: user.fullName,
//                 validUpto,
//                 type: "onDayEmail"
//             }

//             const oneDayEmail = await Emails.subscriptionRemainder(onDayEmailPayload);
//             const onDayNotification = await db.notifications.create({
//                 sendTo: user._id,
//                 sendByWhere: "Bookaro",
//                 status: "unread",
//                 type: "paymentNofication",
//                 title: "on-day-payment-notification",
//                 message: `Hi, your subscription will be ending todday. Kindly ensure your payment method is active.`
//             })
//         }
//     }
// }


// cron.schedule("0 9 * * *", checkAndSendSubscriptionReminders); // 9:00 AM everyday


module.exports = {
    list: async (req, res) => {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ success: false, message: "userId manquant." });
            }
            const subscriptions = await db.subscription
                .find({ userId, isDeleted: false })
                .populate({ path: "planId", select: "name planType pricing role description" })
                .sort({ createdAt: -1 });

            // Active subscription = first non-cancelled, non-deleted
            const active = subscriptions.find((s) => s.status === "active" || s.status === "trialing") || null;

            return res.status(200).json({
                success: true,
                data: subscriptions,
                active,
            });
        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    },

    // add: async (req, res) => {
    //     try{

    //     }catch{
    //         return res.status(400).json({
    //             success: false,
    //             message: "Failed to add subscription.   "
    //         })
    //     }
    // },
    delete: async (req, res) => {
        try {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false, message: "Payload missing."
                });
            }

            const findSubscription = await db.subscription.findOne({ userId: userId, isDeleted: false, status: 'active' });
            const findUser = await db.users.findOne({
                userId,
                isDeleted: false
            })

            // const updateUserPlan = await db.users.updateOne({
            //     _id: userId
            // }, {
            //     planId: null,
            //     planType: null,
            //     // directoryMessageUsage: findFreePlan.messageToDirectoryOwners,
            //     // totalOwnerMessages: findFreePlan.messagesToOwners
            // })
            if (!findSubscription && !findUser.planId) {
                return res.status(400).json({
                    success: false,
                    message: "Subscription not found for this user."
                })
            }
            // const findFreePlan = await db.plans.findOne({ planType: "free", status: "active", isDeleted: false })

            if (findSubscription?.planType === "free") {
                // Case 2: Base plan (no Stripe subscription)
                await db.subscription.updateOne(
                    { userId, status: "active", planType: "free" },
                    {
                        status: "inactive",
                        isDeleted: true,
                        validUpto: null
                    }
                );
                const updateUserPlan = await db.users.updateOne({
                    _id: userId
                }, {
                    planId: null,
                    planType: null,
                })
            } else {
                // Case 1: Stripe subscription exists
                await stripe.subscriptions.cancel(findSubscription.subscriptionId);

                await db.subscription.updateOne(
                    { userId, subscriptionId: findSubscription.subscriptionId },
                    {
                        status: "inactive",
                        isDeleted: true,
                        validUpto: null
                    }
                );

                const updateUserPlan = await db.users.updateOne({
                    _id: userId
                }, {
                    planId: null,
                    planType: null,
                })

            }

            return res.status(200).json({
                success: true,
                message: "Subscription cancelled successfully."
            });

        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: "Failed to delete subscription",
                error: err.message,

            })
        }
    },

    update: async (req, res) => {
        try {
            const { userId, subscriptionId } = req.body;
            if (!userId || !subscriptionId || !newPlanId) {

                return res.status(400).json({
                    success: false,
                    message: "Payload missing."
                });
            }

            const plan = await db.plans.findOne({
                _id: newPlanId,
                isDeleted: false
            });
            if (!plan) {

                return res.status(400).json({
                    success: false,
                    message: "New plan not found."
                });
            }

            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
                items: [{ id: subscription.items.data[0].id, price: plan.pricing[0].stripe_price_id }],
                metadata: { updatedToPlanName: plan.name, updatedToPlanRole: plan.role, updatedToPlanDescription: plan.description }
            });

            await db.subscriptions.findOneAndUpdate({ userId, subscriptionId }, { planId: newPlanId, stripe_price_id: plan.pricing[0].stripe_price_id, subscriptionData: updatedSubscription });

            return res.status(200).json({ success: true, message: "Subscription updated successfully." });

        }
        catch {
            return res.status(400).json({
                success: false,
                message: "Failed to update subscription.   "
            })
        }
    }
}