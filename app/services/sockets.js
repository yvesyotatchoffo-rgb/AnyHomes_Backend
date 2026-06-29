"use strict";
let _ = require("lodash");
const services = require(".");
global.redis_users = [];
const connected_users = [];
const db = require("../models");
const { send_fcm_push_notification } = require("./FcmServices");
const { default: mongoose } = require("mongoose");
const { duration } = require("moment");
const BACKEND_WEB_URL = process.env.BACK_WEB_URL || `http://localhost:${process.env.PORT || 6089}`;
const ASSETS_BASE_URL = `${BACKEND_WEB_URL}/assets/img`;

const getBackendWebUrl = (socket) => {
  const forwardedProto = socket?.handshake?.headers?.["x-forwarded-proto"];
  const proto = forwardedProto ? forwardedProto.split(",")[0] : "http";
  const host = socket?.handshake?.headers?.host || `localhost:${process.env.PORT || 6089}`;
  return `${proto}://${host}`;
};

const buildGuestEstimationProperties = (backendUrl) => {
  const assetsUrl = `${backendUrl}/assets/img`;
  return [
    {
      _id: "guest-property-1",
      propertyTitle: "Maison de caractère à Paris",
      address: "28 Rue des Rosiers, 75004 Paris",
      propertyType: "Maison",
      surface: 115,
      propertyFloor: 2,
      totalFloorBuilding: 3,
      bedrooms: 3,
      bathroom: 2,
      referencePrice: 860000,
      location: { lat: 48.8566, lng: 2.3522 },
      zipcode: "75004",
      images: [
        `${assetsUrl}/spacejoy-WQ35C1ZqCPk-unsplash.jpg`,
        `${assetsUrl}/jalg-tv-stand-Cmq9Sy5PW18-unsplash.jpg`,
        `${assetsUrl}/yann-maignan-x3BCSWCAtrY-unsplash.jpg`,
        `${assetsUrl}/spacejoy-GNs831kqdoM-unsplash.jpg`,
        `${assetsUrl}/spacejoy-8Y8U9fduILs-unsplash.jpg`,
      ],
      revenue_detail: [{ price: 18000 }, { price: 19000 }, { price: 17500 }],
      renovation_work: [{ price: 12000 }, { price: 8500 }],
      rating: [{ rating_value: "4.33" }, { rating_value: "4.33" }, { rating_value: "4.33" }],
      isLiked: false,
      isFollowed: false,
    },
    {
      _id: "guest-property-2",
      propertyTitle: "Appartement lumineux à Lyon",
      address: "12 Rue de la République, 69002 Lyon",
      propertyType: "Appartement",
      surface: 82,
      propertyFloor: 4,
      totalFloorBuilding: 6,
      bedrooms: 2,
      bathroom: 1,
      referencePrice: 420000,
      location: { lat: 45.7640, lng: 4.8357 },
      zipcode: "69002",
      images: [
        `${assetsUrl}/spacejoy-ctyssSFmXmU-unsplash.jpg`,
        `${assetsUrl}/spacejoy-85pCvDWDMmI-unsplash.jpg`,
        `${assetsUrl}/levente-gyulai-nzPlsLZdcm8-unsplash.jpg`,
        `${assetsUrl}/spacejoy-4xRP0Ajk9ys-unsplash.jpg`,
        `${assetsUrl}/prydumano-design-VZ2z8ozzy10-unsplash.jpg`,
      ],
      revenue_detail: [{ price: 10500 }, { price: 11500 }],
      renovation_work: [{ price: 4500 }],
      rating: [{ rating_value: 3 }, { rating_value: 4 }],
      isLiked: false,
      isFollowed: false,
    },
  ];
};

const buildGuestCampaigns = (propertyId) => [
  {
    _id: "guest-campaign-1",
    id: "guest-campaign-1",
    campaignName: "Campagne de lancement",
    startDate: new Date("2026-04-01"),
    duration: "1Week",
    pricePerSqm: 10800,
    status: "active",
    totalUsers: 42,
    propertyLikes: 85,
    propertyFollows: 32,
    propertyShares: 12,
  },
  {
    _id: "guest-campaign-2",
    id: "guest-campaign-2",
    campaignName: "Suivi social",
    startDate: new Date("2026-03-15"),
    duration: "1Month",
    pricePerSqm: 9800,
    status: "ended",
    totalUsers: 28,
    propertyLikes: 60,
    propertyFollows: 18,
    propertyShares: 8,
  },
];

const buildGuestEstimationStats = () => ({
  priceStats: [
    {
      underEstimatedProperties: 3,
      appropriateProperties: 7,
      expensiveProperties: 2,
      minPrice: 9200,
      maxPrice: 12300,
      avgPrice: 10550,
      totalUsers: 57,
    },
  ],
  minPriceDocs: [{ createdAt: new Date() }],
  maxPriceDocs: [{ createdAt: new Date() }],
  minPriceDocCount: [{ count: 8 }],
  maxPriceDocCount: [{ count: 5 }],
  ratePropertyTitleCount: [
    { _id: 1, count: 8 },
    { _id: 2, count: 15 },
    { _id: 3, count: 18 },
    { _id: 4, count: 10 },
    { _id: 5, count: 6 },
  ],
  ratePropertyPicturesCount: [
    { _id: 1, count: 6 },
    { _id: 2, count: 12 },
    { _id: 3, count: 20 },
    { _id: 4, count: 11 },
    { _id: 5, count: 8 },
  ],
  rateInteriorDesignCount: [
    { _id: 1, count: 7 },
    { _id: 2, count: 13 },
    { _id: 3, count: 19 },
    { _id: 4, count: 11 },
    { _id: 5, count: 7 },
  ],
  rateLocationCount: [
    { _id: 1, count: 9 },
    { _id: 2, count: 14 },
    { _id: 3, count: 16 },
    { _id: 4, count: 10 },
    { _id: 5, count: 8 },
  ],
  rateCouldYouLiveInCount: [
    { _id: 1, count: 10 },
    { _id: 2, count: 12 },
    { _id: 3, count: 18 },
    { _id: 4, count: 9 },
    { _id: 5, count: 8 },
  ],
  withinPlus0To5: [{ count: 14 }],
  withinMinus0To5: [{ count: 12 }],
  withinPlus5To10: [{ count: 10 }],
  withinMinus5To10: [{ count: 8 }],
  withinPlus10To20: [{ count: 6 }],
  withinMinus10To20: [{ count: 5 }],
  moreThanPlus20: [{ count: 2 }],
  lessThanMinus20: [{ count: 3 }],
});

const buildGuestPriceDeviationBreakdown = () => ({
  plus0To5: 24,
  minus0To5: 21,
  plus5To10: 18,
  minus5To10: 14,
  plus10To20: 11,
  minus10To20: 9,
  moreThanPlus20: 5,
  lessThanMinus20: 6,
});

const buildGuestSocialEstimationResponse = (propertyId) => {
  const baseProperty = buildGuestEstimationProperties(BACKEND_WEB_URL).find((property) => property._id === propertyId) || buildGuestEstimationProperties(BACKEND_WEB_URL)[0];
  return {
    success: true,
    message: "Guest analytics fetched successfully.",
    data: {
      campaignStats: {
        DayCampaignLimit: 1,
        WeekCampaignLimit: 2,
        MonthCampaignLimit: 3,
        extraCampaignsPerDay: 0,
        extraCampaignsPerWeek: 0,
        extraCampaignsPerMonth: 0,
        totalRunningCampaigns: 1,
      },
      estimationStats: buildGuestEstimationStats(),
      priceDeviationBreakdown: buildGuestPriceDeviationBreakdown(),
      socialEstimation: [85, 32, 12],
      campaigns: buildGuestCampaigns(propertyId),
    },
  };
};

const buildGuestCampaignDetails = (campaignId) => ({
  success: true,
  message: "Guest campaign details fetched successfully.",
  data: {
    estimationStats: buildGuestEstimationStats(),
    priceDeviationBreakdown: buildGuestPriceDeviationBreakdown(),
    socialEstimation: [85, 32, 12],
  },
});

const buildGuestLifetimePriceEstimation = (data) => ({
  success: true,
  totalCount: 34,
  lastRecord: {
    userReasonablePrice: parseInt(data.userReasonablePrice || 10550) || 10550,
    createdAt: new Date(),
  },
});

let io;

exports.initializeSocket = function (startServer) {
  io = require("socket.io")(startServer, {
    cors: {
      origin: "*",
      allowedHeaders: [
        "Origin, X-Requested-With, Content-Type, Accept, Authorization,access-control-allow-origin,Access-Control-Allow-Origin",
      ],
      methods: ["GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"],
    },
  });
  io.on("connection", function (socket) {
    // console.log("SOCKET_INITIALIZED");
    socket.on("unread-count", async (data) => {
      let unread_count = 0;
      if (data.user_id && data.room_id) {
        let get_data = await services.message.get_unread_messages_count(data);
        unread_count = get_data ? get_data.unread_count : 0;
      }

      io.emit("unread-count", {
        status: 200,
        data: {
          room_id: data.room_id,
          user_id: data.user_id,
          unread_count: unread_count,
        },
      });
    });
    socket.on("join-room", async (data) => {

      try {

        const roomMemberInfo = await db.roommembers.findOne({ room_id: data.room_id }).lean();

        if (!roomMemberInfo.isGroupChat) {
          const members = await db.roommembers.find({ room_id: data.room_id }).lean();
          const otherUser = members.find(m => m.user_id.toString() !== data.user_id);

          if (otherUser) {
            const blockCheck = await db.blockedUsers.findOne({
              $or: [
                { blockedBy: data.user_id, blockedTo: otherUser.user_id },
                { blockedBy: otherUser.user_id, blockedTo: data.user_id }
              ]
            });

            if (blockCheck) {
              return socket.emit("join-room", {
                status: 400,
                message: "You cannot join this room. Either you or the other user has blocked each other.",
              });
            }
          }
        }

        socket.join(`${data.room_id}`);
        socket.room_id = data.room_id;
        socket.user_id = data.user_id;
        if (!_.find(connected_users, data)) {
          data.socket_id = socket.id;
          data.user_id = data.user_id;
          data.room_id = data.room_id;
          connected_users.push(data);
        }

        io.emit("join-room", {
          status: 200,
          data: data,
        });



      } catch (error) {
        socket.emit("join-room", {
          status: 500,
          message: "An error occurred while joining the room.",
          error: error.message,
        });
      }




    });

    socket.on("user-online", async (data) => {
      socket.user_id = data.user_id;
      let update_status = await services.customers.online_offline(
        data.user_id,
        true
      );

      io.emit("user-online", {
        status: 200,
        data: data,
      });
    });

    socket.on("edit-message", async (data) => {
      let update_message = await services.message.update_message(data);
      io.to(socket.room_id).emit("edit-message", {
        status: 200,
        data: data,
      });
    });

    // socket.on("send-message", async (data) => {
    //   try {

    //     data.sender = data.user_id;
    //     delete data.user_id;

    //     const { sender, propertyId, room_id } = data;

    //     //parallel db queries
    //     const [property, recieverMember, senderUser] = await Promise.all([
    //       db.property.findOne({ _id: propertyId, isDeleted: false }),
    //       db.roommembers.findOne({ room_id,user_id:{ $ne: sender}}),
    //       db.users.findOne({ _id: sender }, { planId: 1, directoryMessageUsage: 1, totalOwnerMessages: 1 }).populate({
    //         path: "planId",
    //         select: "messageToDirectoryOwners messagesToOwners",
    //         match: { isDeleted: false, status: "active" }
    //       })
    //     ]);

    //     if (!property || !recieverMember || !senderUser?.planId) {
    //       return socket.emit("error", { message: "Required data not found." });
    //     }

    //     const isDirectory = property.propertyType === "directory";
    //     const isOwner = recieverMember.user_id.toString() === property.addedBy.toString();

    //     if (isOwner) {
    //       const plan = senderUser.planId;
    //       let updates = {};
    //       if (isDirectory) {
    //         const { directoryMessageUsage } = senderUser;
    //         if (directoryMessageUsage >= plan.messageToDirectoryOwners) {
    //           return socket.emit("error", { message: "You reached your directory messaging limit." });
    //         }
    //         updates.directoryMessageUsage = 1;
    //       }
    //       if (senderUser.totalOwnerMessages >= plan.messagesToOwners) {
    //         return socket.emit("error", { message: "You reached your owner messaging limit." });
    //       }
    //       updates.totalOwnerMessages = 1;
    //       await db.users.updateOne({ _id: sender }, {
    //         $inc: updates
    //       });
    //     }

    //     const [createdMessage] = await Promise.all([
    //       services.message.create_message(data),
    //       db.property.updateOne({ _id: propertyId }, { chatSorting: new Date() })
    //     ]);
    //     if (!createdMessage) return;
    //     // console.log("MESSAGE CREATED.....")
    //     const reciever_id = recieverMember.user_id;

    //     const receiver = await db.users.findById(reciever_id);
    //     if (!receiver.isOnline) {
    //       // console.log("NOTI ENTERED")
    //       const senderDetails = await db.users.findOne({ _id: reciever_id });
    //       const messageContent = `${senderDetails.firstName} sent you a new message`;
    //       const [notification] = await Promise.all([
    //         db.notifications.create({
    //           sendTo: reciever_id,
    //           sendBy: sender,
    //           title: "New Message",
    //           message: messageContent,
    //           type: "message",
    //           status: "unread",
    //           created_at: new Date(),
    //           property_id: propertyId
    //         }),

    //         // send_fcm_push_notification(...)
    //         // console.log("NOTI DONE")
    //       ]);
    //     }

    //     const unreadCount = await db.chatcommonoperations.countDocuments({
    //       room_id,
    //       user_id: reciever_id,
    //       isRead: false, // Make sure the field name matches your schema exactly (isRead vs isread)
    //       isDeleted: false
    //     });

    //     // Then, update the room member with that count
    //     await db.roommembers.updateOne(
    //       { room_id, user_id: reciever_id },
    //       {
    //         $set: {
    //           updatedAt: new Date(),
    //           user_chat_count: unreadCount,
    //         }
    //       }
    //     );

    //     // Emit the notification
    //     // console.log("HERE");
    //     io.emit("notify-message", {
    //       status: 200,
    //       data: {
    //         count_room_chat: unreadCount || 0,
    //         user_id: reciever_id,
    //         room_id
    //       }
    //     });
    //     const [finalMessage, senderData] = await Promise.all([
    //       db.messages.findById(createdMessage._id).lean(),
    //       db.users.findById(sender, { image: 1 })
    //     ]);
    //     finalMessage.sender_image = senderData.image;

    //     io.to(room_id).emit("receive-message", {
    //       status: 200,
    //       data: finalMessage
    //     });

    //   } catch (err) {
    //     console.error("send-message error:", err);
    //     socket.emit("error", { message: "Something went wrong while sending the message." })
    //   }
    // });
   socket.on("send-message", async (data) => {
      try {

        data.sender = data.user_id;
        delete data.user_id;

        const { sender, propertyId, room_id } = data;


//         //parallel db queries
        const [property, recieverMember, senderUser] = await Promise.all([
          db.property.findOne({ _id: propertyId, isDeleted: false }),
          db.roommembers.findOne({ room_id, user_id: { $ne: sender } }),
          db.users.findOne({ _id: sender }, { planId: 1, directoryMessageUsage: 1, totalOwnerMessages: 1 }).populate({
            path: "planId",
            select: "messageToDirectoryOwners messagesToOwners",
            match: { isDeleted: false, status: "active" }
          })
        ]);

//         if (!property || !recieverMember || !senderUser?.planId) {
//           return socket.emit("error", { message: "Required data not found." });
//         }

//         const isDirectory = property.propertyType === "directory";
//         const isOwner = recieverMember.user_id.toString() === property.addedBy.toString();

//         if (isOwner) {
//           const plan = senderUser.planId;
//           let updates = {};
//           if (isDirectory) {
//             const { directoryMessageUsage } = senderUser;
//             if (directoryMessageUsage >= plan.messageToDirectoryOwners) {
//               return socket.emit("error", { message: "You reached your directory messaging limit." });
//             }
//             updates.directoryMessageUsage = 1;
//           }
//           if (senderUser.totalOwnerMessages >= plan.messagesToOwners) {
//             return socket.emit("error", { message: "You reached your owner messaging limit." });
//           }
//           updates.totalOwnerMessages = 1;
//           await db.users.updateOne({ _id: sender }, {
//             $inc: updates
//           });
//         }

        const [createdMessage] = await Promise.all([
          services.message.create_message(data),
          db.property.updateOne({ _id: propertyId }, { chatSorting: new Date() })
        ]);
        if (!createdMessage) return;
        // console.log("MESSAGE CREATED.....")
        const reciever_id = recieverMember.user_id;

        const receiver = await db.users.findById(reciever_id);
        if (!receiver.isOnline) {
          // console.log("NOTI ENTERED")
          const senderDetails = await db.users.findOne({ _id: reciever_id });
          const messageContent = `${senderDetails.firstName} sent you a new message`;
          const [notification] = await Promise.all([
            db.notifications.create({
              sendTo: reciever_id,
              sendBy: sender,
              title: "New Message",
              message: messageContent,
              type: "message",
              status: "unread",
              created_at: new Date(),
              property_id: propertyId
            }),

            // send_fcm_push_notification(...)
            // console.log("NOTI DONE")
          ]);
        }

        const unreadCount = await db.chatcommonoperations.countDocuments({
          room_id,
          user_id: reciever_id,
          isRead: false, // Make sure the field name matches your schema exactly (isRead vs isread)
          isDeleted: false
        });

        // Then, update the room member with that count
        await db.roommembers.updateOne(
          { room_id, user_id: reciever_id },
          {
            $set: {
              updatedAt: new Date(),
              user_chat_count: unreadCount,
            }
          }
        );

        // Emit the notification
        // console.log("HERE");
        io.emit("notify-message", {
          status: 200,
          data: {
            count_room_chat: unreadCount || 0,
            user_id: reciever_id,
            room_id
          }
        });
        const [finalMessage, senderData] = await Promise.all([
          db.messages.findById(createdMessage._id).lean(),
          db.users.findById(sender, { image: 1 })
        ]);
        finalMessage.sender_image = senderData.image;

        io.to(room_id).emit("receive-message", {
          status: 200,
          data: finalMessage
        });

      } catch (err) {
        console.error("send-message error:", err);
        socket.emit("error", { message: "Something went wrong while sending the message." })
      }
    });
    socket;
    socket.on("read-message", async (data) => {
      data.type = "message";
      data.isRead = true;
      let read_message = await services.message.read_message(data);
      io.to(socket.room_id).emit("read-message", {
        status: 200,
        data: data,
      });
    });
    socket.on("read-all-message", async (data) => {

      data.type = "message";
      data.isRead = true;
      let read_message = await services.message.read_all_messages(data);
      let query = {
        user_id: data.user_id,
      };
      let get_count =
        await services.message.get_unread_messages_count_with_user_id(query);

      let count_room_chat = await db.chatcommonoperations.find({
        room_id: data.room_id,
        user_id: data.user_id,
        isRead: false,
      });

      let get_receiver = await db.users.findById({ _id: data.user_id });
      if (get_receiver.role == "666aa4e7c265ed0d26163701") {
        let updateRoom = await db.roommembers.updateOne(
          { room_id: data.room_id, user_id: data.user_id },
          {
            $set: {
              updatedAt: new Date(),
              admin_chat_count: count_room_chat.length,
            },
          }
        );
      } else {
        let updateRoom = await db.roommembers.updateOne(
          { room_id: data.room_id, user_id: data.user_id },
          {
            $set: {
              updatedAt: new Date(),
              user_chat_count: count_room_chat.length,
            },
          }
        );
      }
      io.emit("notify-message", {
        status: 200,
        data: {
          unread_count: get_count ? get_count : 0,
          user_id: data.user_id,
        },
      });

      io.to(socket.room_id).emit("read-all-message", {
        status: 200,
        data: data,
      });
    });

    socket.on("typing", async (data) => {

      let get_sender_data = _.find(connected_users, { socket_id: socket.id });
      data.user_id = get_sender_data.user_id;
      data.typing = data.typing ? data.typing : false;
      io.to(socket.room_id).emit("typing", {
        status: 200,
        data: data,
      });
    });

    socket.on("user-offline", async (data) => {

      let update_status = await services.customers.online_offline(
        data.user_id,
        false
      );
      io.emit("user-offline", {
        status: 200,
        data: data,
      });
    });

    socket.on("delete-message", async (data) => {
      data.isDeleted = true;
      let delete_type = data.type;
      if (data.type) {
        if (data.type == "delete_for_me") {
          let delete_for_me = await services.message.delete_message(data);
        } else if (data.type == "delete_for_everyone") {
          await services.message.delete_message_for_everyone(data);
        }
      }
      data.type = delete_type;
      io.to(socket.room_id).emit("delete-message", {
        status: 200,
        data: data,
      });
    });
    socket.on("disconnect", async () => {
      _.remove(connected_users, (item) => item.socket_id == socket.id);
      socket.leave();
      let update_status = await services.customers.online_offline(
        socket.user_id,
        false
      );

      io.emit("user-offline", {
        status: 200,
        data: {
          user_id: socket.user_id,
        },
      });
    });

    socket.on("notify-message", async (data) => {
      let query = {
        type: "message",
        user_id: data.user_id,
        isRead: false,
        isDeleted: false,
      };

      let get_count =
        await services.message.get_unread_messages_count_with_user_id(query);
      let resData = {
        user_id: data.user_id,
        unread_count: get_count ? get_count : 0,
      };

      io.to(socket.id).emit("notify-message", {
        status: 200,
        data: resData,
      });
    });
    socket.on("new-message", async (data) => {
      let find_message = await services.message.getMessages(data);

      if (find_message.length < 1) {
        let create_data = {
          room_id: data.room_id,
          sender: data.sender,
          type: data.type,
          content: data.content,
          inviteId: data.inviteId,
          message_type: data.message_type,
        };


        var create_message = await services.message.create_message(create_data);
      }
      io.to(socket.room_id).emit("receive-message", {
        status: 200,
        data: create_message,
      });
    });

    //event to get the count of notifications
    socket.on("un-noti", async (data) => {
      let get_count = await services.customers.get_unred_notification_count(
        data.user_id
      );
      let resData = {
        user_id: data.user_id,
        unread_count: get_count ? get_count : 0,
      };

      io.to(socket.id).emit("un-noti", {
        status: 200,
        data: resData,
      });
    });

    //marking all notifications as read
    socket.on("mark-as-read-noti", async (data) => {
      try {
        if (data.userId) {
          await db.notifications.updateMany({
            isDeleted: false,
            sendTo: data.userId,
            status: "unread"
          }, {
            status: "read"
          });
          io.to(socket.id).emit("mark-as-read-noti", {
            status: 200,
            message: "All notifications marked as read successfully.",
          });
        } else {
          io.to(socket.id).emit("mark-as-read-noti", {
            status: 400,
            message: "User ID is required."
          });
        }
      } catch (err) {
        io.to(socket.id).emit("mark-as-read-noti", {
          status: 500,
          message: "An error occurred while marking notifications as read.",
          error: err.message
        });
      }
    });


    socket.on("unread-noti-count", async (data) => {
      let unread_count = 0;
      if (data.user_id) {
        var get_data = await services.message.get_unread_notification_count(
          data
        );
        unread_count = get_data ? get_data : 0;
      }

      io.emit("unread-noti-count", {
        status: 200,
        data: {
          unread_count: unread_count,
          user_id: data.user_id,
        },
      });
    });

    socket.on("read-noti", async (data) => {
      let resData;
      if (data.notification_id) {
        let get_data = await services.message.read_notification(data);

        resData = get_data;
      }

      io.emit("read-noti", {
        status: 200,
        data: {
          message: "Notification read successfully.",
          data: resData,
        },
      });
    });
    socket.on("read-all-noti", async (data) => {
      if (data.user_id) {
        let get_data = await services.message.read_all_notifications(data);

        var get_user_data =
          await services.message.get_unread_notification_count(data);
        let unread_count = get_user_data ? get_user_data : 0;
        io.emit("unread-noti-count", {
          status: 200,
          data: {
            unread_count: unread_count,
            user_id: data.user_id,
          },
        });
      }
      io.emit("read-all-noti", {
        status: 200,
        data: {
          user_id: data.user_id,
          message: "Notifications read successfully.",
        },
      });
    });
    socket.on("get-all-rooms", async (data) => {
      let get_rooms = await services.message.getAllRoomMembers(data);
      io.emit("get-all-rooms", {
        status: 200,
        data: {
          user_id: data.user_id,
          message: "All rooms fetched successfully.",
          all_rooms: get_rooms,
        },
      });
    });

    socket.on("user-chat-update", async (data) => {

      let update_all_users = await db.users.updateMany({
        chat_enabled: data.chat,
      });

      let all_users = await db.users.find({
        _id: { $ne: data.admin_id },
        isDeleted: false,
      });
      if (all_users && all_users.length > 0) {
        for await (let user of all_users) {
          var get_user_data = await services.message.getUserProfile(user._id);
          io.emit("user-profile", {
            staus: 200,
            data: {
              user: get_user_data ? get_user_data : {},
              message: "User chat fetched successfully",
            },
          });
        }
      }

      io.emit("user-chat-update", {
        staus: 200,
        data: {
          user: get_user_data ? get_user_data : {},
          message: "User chat updated/fetched successfully",
        },
      });
    });

    socket.on("user-profile", async (data) => {
      if (data.user_id) {
        var get_user_data = await services.message.getUserProfile(data.user_id);
      }

      io.emit("user-profile", {
        staus: 200,
        data: {
          user: get_user_data ? get_user_data : {},
          message: "User chat fetched successfully",
        },
      });
    });


    // event to clear all the chat with another user
    socket.on("clear-chat", async (data) => {
      if (data.room_id && data.user_id) {
        try {
          const findMessages = await db.messages.find({ room_id: data.room_id });

          const clearChat = await db.messages.updateMany(
            { room_id: data.room_id },
            { $addToSet: { clearedBy: data.user_id } }
          );

          io.emit("clear-chat", {
            status: 200,
            data: {
              chatCleared: clearChat.modifiedCount,
              message: "Your chats have been cleared."
            }
          });
        } catch (error) {
          console.error("Error clearing chat:", error);

          io.emit("clear-chat", {
            status: 500,
            data: {
              message: "Failed to clear chats."
            }
          });
        }
      } else {
        io.emit("clear-chat", {
          status: 400,
          data: {
            message: "room_id and user_id are required."
          }
        });
      }
    });

    //event to inform all the users about the funnel status
    socket.on("informUsers", async (data) => {
      if (data.interestId && data.funnelStatus) {


        let interestId = data.interestId;
        let funnelStatus = data.funnelStatus;

        const findInterest = await db.interests.findOne({
          _id: interestId,
          isDeleted: false
        })
        if (!findInterest) {

          io.emit("informUsers", {
            status: 400,
            data: {
              message: "Interest not found."
            }
          });
        }
        const { buyerId, finalPrice: ownerPrice, finalPrice, propertyId } = findInterest;


        const findBuyer = await db.users.findOne({ _id: buyerId, isDeleted: false })
        // let buyerName = findBuyer.fullName;
        let { buyerName } = findBuyer;

        const findProperty = await db.property.findOne({
          _id: propertyId,
          isDeleted: false
        })
          .populate({
            path: "addedBy",
            select: "fullName"
          })

        let ownerId = findProperty.addedBy;
        let propertyData = {
          ...findProperty.toObject(),
          ownerName: findProperty.addedBy?.fullName
        }

        const findInterestedUsers = await db.interests.find({
          propertyId,
          isDeleted: false,
          //    interestStatus: "pending",
        })

        let buyerIds = findInterestedUsers.map((interest) => interest.buyerId)
        console.log(buyerIds);

        const users = await db.users.find(
          { _id: { $in: buyerIds } },
          { _id: 1 }
        );

        let notificationType, message, title;
        switch (funnelStatus) {
          case "offer accept by owner":
            notificationType = "interestStatus";
            title = "Offer Accepted";
            message = `${findBuyer.firstName}'s offer for ${findProperty.propertyTitle} has been accepted.`;
            break;
          case "offer refused by owner":
            notificationType = "interestStatus";
            title = "Offer Declined";
            message = `${findBuyer.firstName}'s offer for ${findProperty.propertyTitle} has been declined.`;
            break;
          case "owner accept the application":
            notificationType = "interestStatus";
            title = "Application Approved";
            message = `${findBuyer.firstName}'s application for ${findProperty.propertyTitle} has been approved.`;
            break;
          case "owner reject the application":
            notificationType = "interestStatus";
            title = "Application Declined";
            message = `${findBuyer.firstName}'s application for ${findProperty.propertyTitle} has been declined.`;
            break;
          case "propertyTransfer":
            notificationType = "interestStatus";
            title = "Property Transfer";
            message = `${findBuyer.firstName} has bought the ${findProperty.propertyTitle} property.`
            break;
          case "renterTransafer":
            notificationType = "interestStatus";
            title = "Property Rental";
            message = `${findBuyer.firstName} has rented the ${findProperty.propertyTitle} property.`
            break;
          default:
            return io.emit("informUsers", {
              status: 400,
              data: { message: "Invalid funnel status" }
            });
        }

        const notificationPromises = users.map(async user => {
          // Create notification record
          const notification = await db.notifications.create({
            sendTo: user._id,
            sendBy: findProperty.addedBy._id,
            property_id: propertyId,
            type: notificationType,
            message,
            title,
            status: "unread"
          });

          // Emit socket event to the specific user
          io.to(user._id.toString()).emit('informUsers', {
            notification: {
              id: notification._id,
              type: notification.type,
              message: notification.message,
              title: notification.title,
              propertyId: notification.property_id,
              createdAt: notification.createdAt,
              isRead: notification.status === 'read'
            }
          });

          return notification;
        });

        await Promise.all(notificationPromises);

        io.emit("informUsers", {
          status: 200,
          data: { message: "Notifications created and sent successfully", }
        });
      } else {
        io.emit("informUsers", {
          status: 400,
          data: {
            message: "funnelStatus and interestId are required."
          }
        });
      }
    })

    socket.on("activityIndicatorCount", async (data) => {
      if (data.propertyId) {
        if (!mongoose.isValidObjectId(data.propertyId)) {
          io.emit("activityIndicatorCount", {
            status: 200,
            data: { message: "Guest activity count ignored", },
          });
          return;
        }

        const findProperty = await db.property.findOne({ _id: data.propertyId, isDeleted: false })
        if (findProperty) {
          await db.property.updateOne(
            { _id: data.propertyId },
            { activityIndicatorCount: 0 }
          );
          io.emit("activityIndicatorCount", {
            status: 200,
            data: { message: "Activity count setted to zero", }
          });
        }
      }
      else {
        io.emit("activityIndicatorCount", {
          status: 400,
          data: {
            message: "propertyId is required."
          }
        });
      }
    })


    //event for property listing of in p2p estimation random
    socket.on("est-prop-list", async (data) => {
      try {
        let { zipcode = '', loggedInUser, guest } = data;
        const isGuestRequest = guest === true || guest === 'true' || loggedInUser === 'guest-user-000';
        if (isGuestRequest) {
          const backendUrl = getBackendWebUrl(socket);
          const guestProperties = buildGuestEstimationProperties(backendUrl);
          return socket.emit("est-prop-list", {
            success: true,
            message: "Guest properties fetched successfully.",
            data: guestProperties,
            total: guestProperties.length,
          });
        }

        let page = data.page || 1;
        let count = data.count || 10;

        const skip = (parseInt(page) - 1) * parseInt(count);
        const matchStage = {};

        if (!zipcode) {
          const findSearchHistory = await db.recentLogs.findOne({ userId: loggedInUser });
          // console.log("FINDSEARCHHISTORY", findSearchHistory);

          let zipSet = new Set;

          if (findSearchHistory?.zipcodes?.length > 0) {
            findSearchHistory.zipcodes.forEach(z => zipSet.add(z));
          }

          // Fetch 2 random zipcodes from user's properties
          const userProperties = await db.property.aggregate([
            { $match: { addedBy: new mongoose.Types.ObjectId(loggedInUser) } },
            { $group: { _id: "$zipcode" } },
            { $sample: { size: 2 } }
          ]);

          userProperties.forEach(prop => {
            if (prop._id) zipSet.add(prop._id);
          });

          zipcode = Array.from(zipSet);
        }
        //   if (findSearchHistory?.zipcodes?.length > 0) {
        //     zipcode = findSearchHistory.zipcodes;
        //   }
        // }
        console.log("ZIPCODE", zipcode);
        // console.log("TYPEZIPCODE", typeof (zipcode));
        // if (Array.isArray(zipcode) && zipcode.length > 0) {
        //   matchStage.zipcode = { $in: zipcode.map(z => z.trim()) };
        // }

        const zipList = Array.isArray(zipcode) ? zipcode : [zipcode];

        if (zipList.length > 0) {
          matchStage.zipcode = { $in: zipList.map(z => z.trim()) };
        }

        let filters = {
          isDeleted: false
        }

        const pipeline = [
          { $match: matchStage },
          {
            $lookup: {
              from: "favorites",
              let: { propId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$property_id", "$$propId"] },
                        { $eq: ["$user_id", new mongoose.Types.ObjectId(loggedInUser)] },
                        { $eq: ["$like", true] }
                      ]
                    }
                  }
                }
              ],
              as: "favProperties"
            }
          },
          {
            $lookup: {
              from: "followunfollows",
              let: { propId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$property_id", "$$propId"] },
                        { $eq: ["$user_id", new mongoose.Types.ObjectId(loggedInUser)] },
                        { $eq: ["$follow_unfollow", true] }
                      ]
                    }
                  }
                }
              ],
              as: "followProperties"
            }
          },
          // {
          //   $addFields: {
          //     zipcodeAsNumber: {
          //       $convert: {
          //         input: "$zipcode",
          //         to: "double",
          //         onError: null,
          //         onNull: null,
          //       }
          //     }
          //   },
          // },
          {
            $lookup: {
              from: "campaignrefprices",
              localField: "zipcodeAsNumber",
              foreignField: "postalCode",
              as: "matchPostalCodeData"
            }
          },
          {
            $unwind: {
              path: "$matchPostalCodeData",
              preserveNullAndEmptyArrays: true
            }
          },
          // {
          //   $addFields: {
          //     referencePrice: {
          //       $cond: {
          //         if: {
          //           $or: [
          //             { $eq: ["$referencePrice", null] },
          //             { $not: ["$referencePrice"] },
          //           ]
          //         },
          //         then: "$matchPostalCodeData.refPrice",
          //         else: "$referencePrice"
          //       }
          //     }
          //   }
          // },
          {
            $addFields: {
              referencePrice: {
                $cond: {
                  if: { $ifNull: ["$surface", false] },
                  then: {
                    $multiply: [
                      { $toDouble: "$surface" },
                      { $ifNull: ["$matchPostalCodeData.refPrice", 2001] }
                    ]
                  },
                  else: "$referencePrice"
                }
              }
            }
          },
          {
            $addFields: {
              isLiked: { $gt: [{ $size: "$favProperties" }, 0] },
              isFollowed: { $gt: [{ $size: "$followProperties" }, 0] }
            }
          },
          // Lookup active campaigns for this property to enable priority sorting
          {
            $lookup: {
              from: "peercampaigns",
              let: { propId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$propertyId", "$$propId"] },
                        { $eq: ["$status", "active"] },
                        { $gte: ["$endDate", new Date()] }
                      ]
                    }
                  }
                }
              ],
              as: "activeCampaigns"
            }
          },
          {
            $addFields: {
              hasCampaign: { $gt: [{ $size: "$activeCampaigns" }, 0] },
              // Random value within each priority group for fair shuffling
              _sortRand: { $rand: {} }
            }
          },
          // Campaign properties first, then random within each group
          { $sort: { hasCampaign: -1, _sortRand: 1 } },
          { $skip: skip },
          { $limit: parseInt(count) },
          {
            $project: {
              propertyTitle: 1,
              propertyType: 1,
              address: 1,
              location: 1,
              zipcode: 1,
              addedBy: 1,
              images: 1,
              bedrooms: 1,
              rooms: 1,
              bathroom: 1,
              toilets: 1,
              propertyFloor: 1,
              totalFloorBuilding: 1,
              surface: 1,
              renovation_work: 1,
              revenue_detail: 1,
              rating: 1,
              referencePrice: 1,
              energy_efficient: 1,
              isLiked: 1,
              isFollowed: 1,
              hasCampaign: 1
            }
          }
        ]
        const properties = await db.property.aggregate(pipeline);

        socket.emit("est-prop-list", {
          success: true,
          message: "Properties fetched successfully.",
          data: properties,
          total: properties.length
        });
      } catch (err) {
        console.error("Socket error:", err);
        socket.emit("est-prop-list", {
          success: false,
          message: "Failed to fetch properties.",
          error: err.message
        });
      }
    })

    //event to show the owner side campaign estimation
    // socket.on("owner-total-campaign-results", async (data) => {
    //   if (data.userId && data.propertyId) {
    //     const { propertyId, userId } = data;
    //     const [
    //       underEstimatedProperties,
    //       appropriateProperties,
    //       expensiveProperties,
    //       lifetimeMinPriceEstimation,
    //       lifetimeMaxPriceEstimation,
    //       lifetimeAvgPriceEstimation,
    //       ratePropertyTitleCount,
    //       ratePropertyPicturesCount,
    //       rateInteriorDesignCount,
    //       rateLocationCount,
    //       rateCouldYouLiveInCount,
    //     ] = await Promise.all([
    //       await db.peerEstimation.countDocuments({ propertyId, referencePrice: "underestimated" }),
    //       await db.peerEstimation.countDocuments({ propertyId, referencePrice: "appropriate" }),
    //       await db.peerEstimation.countDocuments({ propertyId, referencePrice: "expensive" }),
    //       await db.peerEstimation.findOne({ propertyId }).sort({ userReasonablePrice: 1 }).select("userReasonablePrice"),
    //       await db.peerEstimation.findOne({ propertyId }).sort({ userReasonablePrice: -1 }).select("userReasonablePrice"),
    //       await db.peerEstimation.aggregate([
    //         { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
    //         {
    //           $group: {
    //             _id: null,
    //             avgPrice: { $avg: "$userReasonablePrice" }
    //           }
    //         }
    //       ]),
    //       await db.peerEstimation.aggregate([
    //         { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
    //         {
    //           $group: {
    //             _id: "$ratePropertyTitle",
    //             count: { $sum: 1 }
    //           }
    //         }
    //       ]),
    //       await db.peerEstimation.aggregate([
    //         { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
    //         {
    //           $group: {
    //             _id: "$ratePropertyPictures",
    //             count: { $sum: 1 }
    //           }
    //         }
    //       ]),
    //       await db.peerEstimation.aggregate([
    //         { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
    //         {
    //           $group: {
    //             _id: "$rateInteriorDesign",
    //             count: { $sum: 1 }
    //           }
    //         }
    //       ]),
    //       await db.peerEstimation.aggregate([
    //         { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
    //         {
    //           $group: {
    //             _id: "$rateLocation",
    //             count: { $sum: 1 }
    //           }
    //         }
    //       ]),
    //       await db.peerEstimation.aggregate([
    //         { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
    //         {
    //           $group: {
    //             _id: "$rateCouldYouLiveIn",
    //             count: { $sum: 1 }
    //           }
    //         }
    //       ]),
    //     ])
    //     const avgPrice = lifetimeAvgPriceEstimation[0]?.avgPrice || 0;
    //     socket.emit("owner-total-campaign-results", {
    //       success: true,
    //       message: "Owner side analytics fetched.",
    //       data: {
    //         underEstimatedProperties,
    //         appropriateProperties,
    //         expensiveProperties,
    //         lifetimeMinPriceEstimation,
    //         lifetimeMaxPriceEstimation,
    //         lifetimeAvgPriceEstimation: parseInt(avgPrice),
    //         ratePropertyTitleCount,
    //         ratePropertyPicturesCount,
    //         rateInteriorDesignCount,
    //         rateLocationCount,
    //         rateCouldYouLiveInCount,
    //       }
    //     });

    //   } else {
    //     socket.emit("owner-total-campaign-results", {
    //       success: false,
    //       message: "userId and propertyId is required.",
    //     });
    //   }
    // })

    socket.on("owner-total-campaign-results", async (data) => {
      const isGuestRequest = data?.guest === true || data?.guest === 'true' || data?.userId === 'guest-user-000';
      if (isGuestRequest) {
        const guestResponse = buildGuestSocialEstimationResponse(data?.propertyId);
        return socket.emit("owner-total-campaign-results", guestResponse);
      }

      if (data.userId && data.propertyId) {
        const { propertyId, userId } = data;
        const objectId = new mongoose.Types.ObjectId(propertyId);

        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        const [campaignCounts, estimationStats, socialEstimation] = await Promise.all([

          Promise.all([
            // db.peerCampaign.countDocuments({
            //   startDate: { $gte: firstDay, $lte: lastDay },
            //   duration: "1Day",
            //   userId,
            // }),
            // db.peerCampaign.countDocuments({
            //   startDate: { $gte: firstDay, $lte: lastDay },
            //   duration: "1Week",
            //   userId,
            // }),
            // db.peerCampaign.countDocuments({
            //   startDate: { $gte: firstDay, $lte: lastDay },
            //   duration: "1Month",
            //   userId,
            // }),
            db.users.findById(userId),

            db.campaignPayments.countDocuments({
              userId,
              campaignType: "1Day",
              paymentStatus: "successfull",
              createdAt: { $lt: lastDay },
              createdAt: { $gt: firstDay }
            }),


            db.campaignPayments.countDocuments({
              userId,
              campaignType: "1Week",
              paymentStatus: "successfull",
              createdAt: { $lt: lastDay },
              createdAt: { $gt: firstDay }
            }),


            db.campaignPayments.countDocuments({
              userId,
              campaignType: "1Month",
              paymentStatus: "successfull",
              createdAt: { $lt: lastDay },
              createdAt: { $gt: firstDay }
            }),

            db.peerCampaign.countDocuments({
              status: "active",
              userId: data.userId
            })

          ]),

          db.peerEstimation.aggregate([
            { $match: { propertyId: objectId } },
            {
              $facet: {
                priceStats: [
                  {
                    $group: {
                      _id: null,
                      underEstimatedProperties: {
                        $sum: { $cond: [{ $eq: ["$referencePrice", "underestimated"] }, 1, 0] }
                      },
                      appropriateProperties: {
                        $sum: { $cond: [{ $eq: ["$referencePrice", "appropriate"] }, 1, 0] }
                      },
                      expensiveProperties: {
                        $sum: { $cond: [{ $eq: ["$referencePrice", "expensive"] }, 1, 0] }
                      },
                      minPrice: { $min: "$userReasonablePrice" },
                      maxPrice: { $max: "$userReasonablePrice" },
                      avgPrice: { $avg: "$userReasonablePrice" },
                      totalUsers: { $sum: 1 }
                    }
                  }
                ],
                minPriceDocs: [
                  { $sort: { userReasonablePrice: 1 } },
                  { $limit: 1 }
                ],
                maxPriceDocs: [
                  { $sort: { userReasonablePrice: -1 } },
                  { $limit: 1 }
                ],

                minPriceDocCount: [
                  {
                    $group: {
                      _id: "$userReasonablePrice",
                      count: { $sum: 1 }
                    }
                  },
                  { $sort: { _id: 1 } },
                  { $limit: 1 }
                ],
                maxPriceDocCount: [
                  {
                    $group: {
                      _id: "$userReasonablePrice",
                      count: { $sum: 1 }
                    }
                  },
                  { $sort: { _id: -1 } },
                  { $limit: 1 }
                ],
                ratePropertyTitleCount: [
                  { $group: { _id: "$ratePropertyTitle", count: { $sum: 1 } } }
                ],
                ratePropertyPicturesCount: [
                  { $group: { _id: "$ratePropertyPictures", count: { $sum: 1 } } }
                ],
                rateInteriorDesignCount: [
                  { $group: { _id: "$rateInteriorDesign", count: { $sum: 1 } } }
                ],
                rateLocationCount: [
                  { $group: { _id: "$rateLocation", count: { $sum: 1 } } }
                ],
                rateCouldYouLiveInCount: [
                  { $group: { _id: "$rateCouldYouLiveIn", count: { $sum: 1 } } }
                ],
                withinPlus0To5: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gte: ["$userReasonablePrice", "$currentPropReferencePrice"] },
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.05] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinMinus0To5: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lte: ["$userReasonablePrice", "$currentPropReferencePrice"] },
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.95] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinPlus5To10: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.05] }] },
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.10] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinMinus5To10: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.95] }] },
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.90] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinPlus10To20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.10] }] },
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.20] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinMinus10To20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.90] }] },
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.80] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                moreThanPlus20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.20] }] },
                          // { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.20] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                lessThanMinus20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.80] }] },
                          // { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.80] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ]
              }
            }
          ]),

          Promise.all([
            db.favorites.countDocuments({ property_id: propertyId, p2pLike: true }),
            db.followUnfollow.countDocuments({ property_id: propertyId, p2pFollow: true }),
            db.peerEstimation.countDocuments({ propertyId }),
          ])

        ]);

        const totalUsers = estimationStats[0]?.priceStats[0]?.totalUsers || 0;

        const getCount = (key) => estimationStats[0]?.[key]?.[0]?.count || 0;

        const percentage = (count) => totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(2) : "0.00";

        const responseBreakdown = {
          plus0To5: percentage(getCount("withinPlus0To5")),
          minus0To5: percentage(getCount("withinMinus0To5")),
          plus5To10: percentage(getCount("withinPlus5To10")),
          minus5To10: percentage(getCount("withinMinus5To10")),
          plus10To20: percentage(getCount("withinPlus10To20")),
          minus10To20: percentage(getCount("withinMinus10To20")),
          moreThanPlus20: percentage(getCount("moreThanPlus20")),
          lessThanMinus20: percentage(getCount("lessThanMinus20")),
        };


        // const [DayCampaignLimit, WeekCampaignLimit, MonthCampaignLimit, totalRunningCampaigns] = campaignCounts;

        const [user, extraCampaignsPerDay, extraCampaignsPerWeek, extraCampaignsPerMonth, totalRunningCampaigns] = campaignCounts;

        // Pull the limits directly from user model
        const DayCampaignLimit = user?.dailyCampaignUsage || 0;
        const WeekCampaignLimit = user?.weeklyCampaignUsage || 0;
        const MonthCampaignLimit = user?.monthlyCampaignUsage || 0;

        const finalResponse = {
          success: true,
          message: "Analytics fetched successfully.",
          data: {
            campaignStats: {
              DayCampaignLimit,
              WeekCampaignLimit,
              MonthCampaignLimit,
              extraCampaignsPerDay,
              extraCampaignsPerWeek,
              extraCampaignsPerMonth,
              totalRunningCampaigns
            },
            estimationStats: estimationStats[0],
            priceDeviationBreakdown: responseBreakdown,
            socialEstimation
          }
        };
        socket.emit("owner-total-campaign-results", finalResponse);
      } else {
        socket.emit("owner-total-campaign-results", {
          success: false,
          message: "userId and propertyId is required.",
        });
      }
    });

    //event to show the owner side campaign estimation for each campaign
    socket.on("owner-per-campaign-results", async (data) => {
      const isGuestRequest = data?.guest === true || data?.guest === 'true';
      if (isGuestRequest) {
        return socket.emit("owner-per-campaign-results", buildGuestCampaignDetails(data?.campaginId));
      }

      if (data.campaginId) {
        const { campaginId } = data;
        const objectId = new mongoose.Types.ObjectId(campaginId);
        const [estimationStats, socialEstimation] = await Promise.all([
          db.peerEstimation.aggregate([
            { $match: { campaginId: objectId } },
            {
              $facet: {
                priceStats: [
                  {
                    $group: {
                      _id: null,
                      underEstimatedProperties: {
                        $sum: { $cond: [{ $eq: ["$referencePrice", "underestimated"] }, 1, 0] }
                      },
                      appropriateProperties: {
                        $sum: { $cond: [{ $eq: ["$referencePrice", "appropriate"] }, 1, 0] }
                      },
                      expensiveProperties: {
                        $sum: { $cond: [{ $eq: ["$referencePrice", "expensive"] }, 1, 0] }
                      },
                      minPrice: { $min: "$userReasonablePrice" },
                      maxPrice: { $max: "$userReasonablePrice" },
                      avgPrice: { $avg: "$userReasonablePrice" },
                      totalUsers: { $sum: 1 }
                    }
                  }
                ],
                minPriceDocs: [
                  { $sort: { userReasonablePrice: 1 } },
                  { $limit: 1 }
                ],
                maxPriceDocs: [
                  { $sort: { userReasonablePrice: -1 } },
                  { $limit: 1 }
                ],

                minPriceDocCount: [
                  {
                    $group: {
                      _id: "$userReasonablePrice",
                      count: { $sum: 1 }
                    }
                  },
                  { $sort: { _id: 1 } },
                  { $limit: 1 }
                ],
                maxPriceDocCount: [
                  {
                    $group: {
                      _id: "$userReasonablePrice",
                      count: { $sum: 1 }
                    }
                  },
                  { $sort: { _id: -1 } },
                  { $limit: 1 }
                ],
                ratePropertyTitleCount: [
                  { $group: { _id: "$ratePropertyTitle", count: { $sum: 1 } } }
                ],
                ratePropertyPicturesCount: [
                  { $group: { _id: "$ratePropertyPictures", count: { $sum: 1 } } }
                ],
                rateInteriorDesignCount: [
                  { $group: { _id: "$rateInteriorDesign", count: { $sum: 1 } } }
                ],
                rateLocationCount: [
                  { $group: { _id: "$rateLocation", count: { $sum: 1 } } }
                ],
                rateCouldYouLiveInCount: [
                  { $group: { _id: "$rateCouldYouLiveIn", count: { $sum: 1 } } }
                ],
                withinPlus0To5: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gte: ["$userReasonablePrice", "$currentPropReferencePrice"] },
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.05] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinMinus0To5: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lte: ["$userReasonablePrice", "$currentPropReferencePrice"] },
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.95] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinPlus5To10: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.05] }] },
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.10] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinMinus5To10: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.95] }] },
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.90] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinPlus10To20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.10] }] },
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.20] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                withinMinus10To20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lt: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.90] }] },
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.80] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                moreThanPlus20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.20] }] },
                          // { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 1.20] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ],

                lessThanMinus20: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $lte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.80] }] },
                          // { $gte: ["$userReasonablePrice", { $multiply: ["$currentPropReferencePrice", 0.80] }] }
                        ]
                      }
                    }
                  },
                  { $count: "count" }
                ]
              }
            }
          ]),


          Promise.all([
            db.favorites.countDocuments({ campaignId: campaginId }),
            db.followUnfollow.countDocuments({ campaignId: campaginId }),
            db.peerEstimation.countDocuments({ campaginId }),
          ])

        ]);

        const totalUsers = estimationStats[0]?.priceStats[0]?.totalUsers || 0;

        const getCount = (key) => estimationStats[0]?.[key]?.[0]?.count || 0;

        const percentage = (count) => totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(2) : "0.00";

        const responseBreakdown = {
          plus0To5: percentage(getCount("withinPlus0To5")),
          minus0To5: percentage(getCount("withinMinus0To5")),
          plus5To10: percentage(getCount("withinPlus5To10")),
          minus5To10: percentage(getCount("withinMinus5To10")),
          plus10To20: percentage(getCount("withinPlus10To20")),
          minus10To20: percentage(getCount("withinMinus10To20")),
          moreThanPlus20: percentage(getCount("moreThanPlus20")),
          lessThanMinus20: percentage(getCount("lessThanMinus20")),
        };

        const finalResponse = {
          success: true,
          message: "Campaign analytics fetched.",
          data: {
            estimationStats: estimationStats[0],
            priceDeviationBreakdown: responseBreakdown,
            socialEstimation
          }
        };

        socket.emit("owner-per-campaign-results", finalResponse);
      } else {
        socket.emit("owner-per-campaign-results", {
          success: false,
          message: "campaignId is required.",
        });
      }
    })

    socket.on("lifetime-price-estimation", async (data) => {
      try {
        const isGuestRequest = data?.guest === true || data?.guest === 'true';
        if (isGuestRequest) {
          return socket.emit("lifetime-price-estimation", buildGuestLifetimePriceEstimation(data));
        }

        let matchCondition = null;


        if (data.propertyId && data.userReasonablePrice) {
          matchCondition = {
            propertyId: new mongoose.Types.ObjectId(data.propertyId),
            userReasonablePrice: parseInt(data.userReasonablePrice)
          };
        }

        else if (data.campaginId && data.userReasonablePrice) {
          matchCondition = {
            campaginId: new mongoose.Types.ObjectId(data.campaginId),
            userReasonablePrice: parseInt(data.userReasonablePrice)
          };
        }

        if (!matchCondition) {
          return socket.emit("lifetime-price-estimation", {
            success: false,
            message: "Either propertyId or campaignId with userReasonablePrice is required."
          });
        }

        const result = await db.peerEstimation.aggregate([
          { $match: matchCondition },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: null,
              totalCount: { $sum: 1 },
              lastRecord: { $first: "$$ROOT" }
            }
          }
        ]);

        if (result.length > 0) {
          socket.emit("lifetime-price-estimation", {
            success: true,
            totalCount: result[0].totalCount,
            lastRecord: result[0].lastRecord
          });
        } else {
          socket.emit("lifetime-price-estimation", {
            success: true,
            totalCount: 0,
            lastRecord: null
          });
        }

      } catch (error) {
        console.error("Error in lifetime-price-estimation:", error);
        socket.emit("lifetime-price-estimation", {
          success: false,
          message: "Internal server error"
        });
      }
    });

  });

  io.on("disconnect", function (socket) {
    socket.conn.close();
  });
};
exports.getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
