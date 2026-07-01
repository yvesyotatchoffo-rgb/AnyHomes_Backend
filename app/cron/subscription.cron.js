const cron = require('node-cron');
const db = require("../models");
const Emails = require("../Emails/paymentEmail");
const moment = require('moment');
const { sendEmail } = require("../config/brevo.config");
const constants = require('../utls/constants');



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

const checkAndSendSubscriptionReminders = () => {
    cron.schedule("0 9 * * *", async () => {
        console.log("SUBSCRIPTION REMINDER CRON WORKING...")

        const today = moment().startOf("day");
        const twoWeekFromNow = today.clone().add(14, 'days').toDate();
        const oneWeekFromNow = today.clone().add(7, 'days').toDate();
        const tomorrow = today.clone().add(1, 'days').toDate();

        await processReminder('oneDayReminder', tomorrow, 1);
        await processReminder('oneWeekReminder', oneWeekFromNow, 7);
        await processReminder('twoWeekReminder', twoWeekFromNow, 14);

        async function processReminder(reminderField, targetDate, daysLeft) {

            const subs = await db.subscription.find({
                status: "active",
                isDeleted: false,
                validUpto: {
                    $gte: today,
                    $lte: moment(targetDate).endOf('day').toDate()
                },
                [reminderField]: false
            }).populate("userId", "email fullName");

            console.log(`Found ${subs.length} subscriptions needing ${daysLeft}-day reminder`);

            const batchSize = 100;
            for (let i = 0; i < subs.length; i += batchSize) {
                const batch = subs.slice(i, i + batchSize);
                await Promise.all(batch.map(async sub => {
                    try {
                        const user = sub.userId;
                        const formattedDate = moment(sub.validUpto).format("DD/MM/YYYY");
                        const reminderMessages = {
                            twoWeekEmail: {
                                greeting: "Votre abonnement expire bientôt",
                                mainText: `Votre abonnement expirera le ${formattedDate} (dans 14 jours). Veuillez vérifier votre moyen de paiement afin d’éviter toute interruption de service.`,
                                buttonText: "Mettre à jour le paiement",
                                subject: "Votre abonnement expire bientôt"
                            },
                            oneWeekEmail: {
                                greeting: "Rappel de renouvellement",
                                mainText: `Votre abonnement prendra fin le ${formattedDate} (dans 7 jours). Merci de vérifier les informations de votre abonnement.`,
                                buttonText: "Voir l’abonnement",
                                subject: "Rappel de renouvellement d’abonnement"
                            },
                            onDayEmail: {
                                greeting: "Dernier rappel",
                                mainText: `Votre abonnement expire aujourd’hui (${formattedDate}). Renouvelez maintenant pour éviter toute interruption de service.`,
                                buttonText: "Renouveler maintenant",
                                subject: "Dernier rappel de renouvellement"
                            }
                        };
                        const typeMap = {
                            14: "twoWeekEmail",
                            7: "oneWeekEmail",
                            1: "onDayEmail"
                        };
                        const content = reminderMessages[typeMap[daysLeft]];
                        let payload = {
                            module: "AUTH",
                            to: user.email,
                            subject: content.subject,
                            templateId: constants.BREVO.SUBSCRIPTION_REMINDER,
                            params: {
                                fullName: user.fullName || "",
                                greeting: content.greeting || "",
                                mainText: content.mainText || "",
                                buttonText: content.buttonText || "",
                                subscriptionUrl: `${process.env.FRONT_WEB_URL}/subscriptions`, 
                            }, 
                        }
                        await sendEmail(payload);

                        // const typeMap = {
                        //     14: "twoWeekEmail",
                        //     7: "oneWeekEmail",
                        //     1: "onDayEmail"
                        // };

                        // await Emails.subscriptionRemainder({
                        //     email: user.email,
                        //     fullName: user.fullName,
                        //     validUpto: sub.validUpto,
                        //     type: typeMap[daysLeft]
                        // });
                        await db.notifications.create({
                            sendTo: user._id,
                            sendByWhere: "Bookaro",
                            status: "unread",
                            type: "paymentNofication",
                            title: `${daysLeft}-day-payment-notification`,
                            message: `Hi, your subscription will ${daysLeft === 1 ? 'be ending today' : 'end on ' + moment(sub.validUpto).format("MMMM Do, YYYY")}. Kindly ensure your payment method is active.`
                        });

                        // Mark reminder as sent
                        await db.subscription.updateOne(
                            { _id: sub._id },
                            { [reminderField]: true }
                        );
                    } catch (err) {
                        console.error(`Error processing subscription ${sub._id}:`, err);
                    }
                }))
            }

        }
    })

}

cron.schedule("0 9 * * *", checkAndSendSubscriptionReminders); // 9:00 AM everyday

module.exports = { checkAndSendSubscriptionReminders }