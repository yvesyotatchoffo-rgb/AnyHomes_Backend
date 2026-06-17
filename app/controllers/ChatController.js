const Services = require('../services');
let _ = require('lodash')
const response = require('../utls/Response');
const constants = require('../utls/constants');
const db = require("../models");
var mongoose = require("mongoose");
const Emails = require("../Emails/onBoarding");
const { success } = require('../services/Response');
const logPropertyActivity = require("../services/propertyActivityLog.service");

const isGuestRequest = (req) => {
  return (
    req.isGuest ||
    req.query?.guest === 'true' ||
    req.headers?.['x-guest-mode'] === 'true' ||
    req.headers?.['x-guest-mode'] === '1'
  );
};

const buildGuestChatMessages = (room_id = 'guest-room-1') => {
  const now = new Date();
  const messages = [
    {
      _id: 'guest-msg-1',
      type: 'text',
      room_id,
      sender: 'guest-buyer-001',
      sender_name: 'Marine Lefèvre',
      sender_image: null,
      sender_logo: null,
      content: "Bonjour, j'ai vu votre maison familiale sur AnyHomes. Même si je sais qu'elle n'est pas à vendre, je suis très intéressée et j'aimerais savoir si vous seriez prêt à en discuter.",
      media: [],
      inviteId: null,
      project_id: null,
      message_type: 'text',
      isRead: true,
      isDeleted: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 12),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 12),
    },
    {
      _id: 'guest-msg-2',
      type: 'text',
      room_id,
      sender: 'guest-user-000',
      sender_name: 'Propriétaire',
      sender_image: null,
      sender_logo: null,
      content: "Bonjour Marine, c'est bien ma maison. Je n'envisage pas de la vendre tout de suite, mais je peux en parler si votre intérêt est sérieux.",
      media: [],
      inviteId: null,
      project_id: null,
      message_type: 'text',
      isRead: false,
      isDeleted: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 8),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 8),
    },
    {
      _id: 'guest-msg-3',
      type: 'text',
      room_id,
      sender: 'guest-buyer-001',
      sender_name: 'Marine Lefèvre',
      sender_image: null,
      sender_logo: null,
      content: "D'accord, merci. Seriez-vous disponible pour un court échange cette semaine ? Je peux m'adapter à vos disponibilités.",
      media: [],
      inviteId: null,
      project_id: null,
      message_type: 'text',
      isRead: false,
      isDeleted: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 5),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 5),
    },
    {
      _id: 'guest-msg-4',
      type: 'text',
      room_id,
      sender: 'guest-user-000',
      sender_name: 'Propriétaire',
      sender_image: null,
      sender_logo: null,
      content: "Oui, je peux jeudi après-midi ou samedi matin. Dites-moi ce qui vous convient le mieux.",
      media: [],
      inviteId: null,
      project_id: null,
      message_type: 'text',
      isRead: false,
      isDeleted: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 2),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 2),
    },
  ];
  return messages;
};

const buildGuestRoomMembers = (room_id = 'guest-room-1', property_id = 'guest-prop-1') => [
  {
    _id: 'guest-room-member-self',
    id: 'guest-room-member-self',
    user_id: 'guest-user-000',
    user_role: 'owner',
    user_name: 'Propriétaire',
    user_logo: null,
    user_image: null,
    isOnline: false,
    room_id: [room_id],
    subject: 'Discussion au sujet de la Maison familiale',
    user_details: {
      _id: 'guest-user-000',
      fullName: 'Propriétaire',
      image: null,
      accountType: 'owner',
      isOnline: false,
      email: 'guest@bookaroo.local',
    },
    property_id,
  },
  {
    _id: 'guest-room-member-1',
    id: 'guest-room-member-1',
    user_id: 'guest-buyer-001',
    user_role: 'individual',
    user_name: 'Marine Lefèvre',
    user_logo: null,
    user_image: null,
    isOnline: false,
    room_id: [room_id],
    subject: 'Discussion au sujet de la Maison familiale',
    user_details: {
      _id: 'guest-buyer-001',
      fullName: 'Marine Lefèvre',
      image: null,
      accountType: 'individual',
      isOnline: false,
      email: 'marine.lefevre@anyhomes.local',
    },
    property_id,
  },
];

const buildGuestRecentChats = (room_id = 'guest-room-1', property_id = 'guest-prop-1') => {
  const messages = buildGuestChatMessages(room_id);
  return [
    {
      isGroupChat: false,
      room_id,
      room_name: 'Discussion au sujet de la Maison familiale',
      user_id: ['guest-buyer-001'],
      last_message: messages[messages.length - 1],
      last_message_at: messages[messages.length - 1].createdAt,
      room_members: buildGuestRoomMembers(room_id, property_id),
      unread_count: 0,
      read_count: 1,
      property_id,
      property_details: {
        _id: property_id,
        name: 'Maison familiale',
        images: ['/assets/img/dashboard/attractivity/attractivity-1.jpg'],
        address: 'Paris, 75000',
        propertyType: 'residential',
        content: 'Appartement familial en plein cœur de Paris',
        propertyTitle: 'Maison familiale',
        addedBy: 'Propriétaire',
      },
    },
  ];
};

const buildGuestPropertyChats = (room_id = 'guest-room-1', property_id = 'guest-prop-1') => {
  const messages = buildGuestChatMessages(room_id);
  return [
    {
      isGroupChat: false,
      room_id,
      room_name: 'Discussion au sujet de la Maison familiale',
      user_id: ['guest-buyer-001'],
      last_message: messages[messages.length - 1],
      last_message_at: messages[messages.length - 1].createdAt,
      room_members: buildGuestRoomMembers(room_id, property_id),
      unread_count: 0,
      read_count: 1,
      property_id,
      property_name: 'Maison familiale',
      property_images: ['/assets/img/dashboard/attractivity/attractivity-1.jpg'],
      property_address: 'Paris, 75000',
      propertyType: 'residential',
      content: 'Appartement familial en plein cœur de Paris',
      propertyTitle: 'Maison familiale',
      property_addedby: 'guest-user-000',
      property_chatSorting: 100,
    },
  ];
};

// Duplicate guest room member builder removed. Using the first definition above
// so chat requests return both guest and agent members for guest mode.

// exports.joinGroup = async (req, res, next) => {
//     try {
//         let { chat_by, chat_with, subject, property_id } = req.body;

//         if (!req.body.chat_by) { chat_by = req.identity.id }
//         if (!chat_by || !chat_with || !subject || !property_id) {
//             return res.status(404).json({
//                 success: false,
//                 error: { code: 404, message: constants.onBoarding.PAYLOAD_MISSING }
//             })
//         }
//         req.body.subject = req.body.subject.toLowerCase();
//         subject = req.body.subject
//         let get_chat_by_rooms = await Services.customers.get_user_rooms({
//             user_id: chat_by,
//             isGroupChat: false,
//             property_id: property_id,

//         }, {
//             room_id: 1
//         });
//         let get_chat_with_rooms = await Services.customers.get_user_rooms({
//             user_id: chat_with,
//             isGroupChat: false,
//             property_id: property_id
//         }, {
//             room_id: 1
//         });
//         if (get_chat_by_rooms && get_chat_by_rooms.length > 0 && get_chat_with_rooms && get_chat_with_rooms.length > 0) {
//             if (get_chat_by_rooms && get_chat_by_rooms.length > 0) {
//                 get_chat_by_rooms = get_chat_by_rooms.map(item => `${item.room_id}`);
//             }

//             if (get_chat_with_rooms && get_chat_with_rooms.length > 0) {
//                 get_chat_with_rooms = get_chat_with_rooms.map(item => `${item.room_id}`);
//             }

//             let common_room_id = await Services.common.get_common_from_arr_of_strs(get_chat_by_rooms, get_chat_with_rooms);
//             if (common_room_id && common_room_id.length > 0) {
//                 // return common_room_id[0];
//                 let data = {
//                     room_id: common_room_id[0]
//                 }
//                 return response.success(data, constants.USER.GROUP_JOINED, req, res);

//             }

//         }

//         let create_room = await Services.room.create_room({
//             subject: subject,
//             isGroupChat: false,
//         });
//         if (create_room) {
//             let create_members = await Services.room.add_members([{
//                 room_id: create_room._id,
//                 user_id: chat_by,
//                 property_id: property_id
//             },
//             {
//                 room_id: create_room._id,
//                 user_id: chat_with,
//                 property_id: property_id


//             }]);
//             let data = {
//                 room_id: create_room._id
//             }
//             return response.success(data, constants.USER.GROUP_JOINED, req, res);
//         }
//     } catch (error) {
//         console.log(error, "==============error")
//         return response.failed(null, `${error}`, req, res);
//     }
// }
exports.joinGroup = async (req, res, next) => {
    try {
        let { chat_by, chat_with, subject, property_id } = req.body;

        if (!req.body.chat_by) { chat_by = req.identity.id }
        if (!chat_by || !chat_with || !subject || !property_id) {
            return res.status(404).json({
                success: false,
                error: { code: 404, message: constants.onBoarding.PAYLOAD_MISSING }
            })
        }

        req.body.subject = req.body.subject.toLowerCase();
        subject = req.body.subject

        let get_chat_by_rooms = await Services.customers.get_user_rooms({
            user_id: chat_by,
            isGroupChat: false,
            property_id: property_id,
        }, {
            room_id: 1
        });

        let get_chat_with_rooms = await Services.customers.get_user_rooms({
            user_id: chat_with,
            isGroupChat: false,
            property_id: property_id
        }, {
            room_id: 1
        });

        if (get_chat_by_rooms && get_chat_by_rooms.length > 0 && get_chat_with_rooms && get_chat_with_rooms.length > 0) {
            if (get_chat_by_rooms && get_chat_by_rooms.length > 0) {
                get_chat_by_rooms = get_chat_by_rooms.map(item => `${item.room_id}`);
            }

            if (get_chat_with_rooms && get_chat_with_rooms.length > 0) {
                get_chat_with_rooms = get_chat_with_rooms.map(item => `${item.room_id}`);
            }

            let common_room_id = await Services.common.get_common_from_arr_of_strs(get_chat_by_rooms, get_chat_with_rooms);
            if (common_room_id && common_room_id.length > 0) {
                let data = {
                    room_id: common_room_id[0]
                }
                return response.success(data, constants.USER.GROUP_JOINED, req, res);
            }
        }

        const property = await db.property.findById(property_id);
        const isDirectory = property.propertyType === "directory";

        if (isDirectory) {
            const user = await db.users.findById(chat_by).populate("planId");

            if (!user || !user.planId) {
                return res.status(400).json({
                    success: false,
                    message: "User plan not found"
                });
            }

            const dir = user.planId.otherDetails.msgToDirectory;
            const limit = dir.key === "unlimited" ? Infinity : Number(dir.value);

            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const endOfMonth = new Date();
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setDate(0);
            endOfMonth.setHours(23, 59, 59, 999);

            const uniqueUsers = await db.roommembers.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(chat_by),
                        createdAt: {
                            $gte: startOfMonth,
                            $lte: endOfMonth
                        }
                    }
                },
                {
                    $lookup: {
                        from: "roommembers",
                        let: { roomId: "$room_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$room_id", "$$roomId"] },
                                            { $ne: ["$user_id", new mongoose.Types.ObjectId(chat_by)] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "otherUser"
                    }
                },
                { $unwind: "$otherUser" },
                {
                    $group: {
                        _id: "$otherUser.user_id"
                    }
                }
            ]);

            const totalUniqueUsers = uniqueUsers.length;
            console.log("totalUniqueUsers", totalUniqueUsers);
            console.log("limit", limit);

            if (limit !== Infinity && totalUniqueUsers >= limit) {
                return res.status(403).json({
                    success: false,
                    message: "You reached your monthly directory user chat limit"
                });
            }
        }

        let create_room = await Services.room.create_room({
            subject: subject,
            isGroupChat: false,
        });

        if (create_room) {
            let create_members = await Services.room.add_members([
                {
                    room_id: create_room._id,
                    user_id: chat_by,
                    property_id: property_id
                },
                {
                    room_id: create_room._id,
                    user_id: chat_with,
                    property_id: property_id
                }
            ]);

            // Log contact_owner activity
            logPropertyActivity(property_id, "contact_owner", { userId: chat_by, label: "Message envoyé au propriétaire" });

            let data = {
                room_id: create_room._id
            }

            return response.success(data, constants.USER.GROUP_JOINED, req, res);
        }

    } catch (error) {
        console.log(error, "==============error")
        return response.failed(null, `${error}`, req, res);
    }
}
exports.getAllMessages = async (req, res, next) => {
    try {
        if (isGuestRequest(req)) {
            const room_id = req.query.room_id || 'guest-room-1';
            const messages = buildGuestChatMessages(room_id);
            const page = req.query.page ? Number(req.query.page) : 1;
            const count = req.query.count ? Number(req.query.count) : messages.length;
            const skipNo = (page - 1) * count;
            const paginated = messages.slice(skipNo, skipNo + count);
            return response.success({ total: messages.length, data: paginated }, "Fetched all messages", req, res);
        }

        let { room_id, search, isDeleted, sortBy, user_id, login_user_id } = req.query;
        let page = req.query.page || 1;
        let count = req.query.count || 10;
        let skipNo = (Number(page) - 1) * Number(count);
        let query = {};

        if (search) {
            query.$or = [
                { content: { $regex: search, '$options': 'i' } },
            ]
        }

        const roomMembers = await db.roommembers.find({
            // isDeleted: false,
            room_id: new mongoose.Types.ObjectId(room_id),
            user_id: { $ne: new mongoose.Types.ObjectId(login_user_id) }
        })

        if (!roomMembers || roomMembers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No users found in this room."
            })
        }

        let blockedStatusMap = new Map();

        for (const member of roomMembers) {
            const memberId = member.user_id._id;

            const isBlocked = await db.blockedUsers.findOne({
                $or: [
                    { blockedBy: new mongoose.Types.ObjectId(login_user_id), blockedTo: new mongoose.Types.ObjectId(memberId) },
                    { blockedBy: new mongoose.Types.ObjectId(memberId), blockedTo: new mongoose.Types.ObjectId(login_user_id) }
                ]
            })
            blockedStatusMap.set(memberId.toString(), !!isBlocked); // Set true if blocked, false otherwise
        }






        let sortquery = {};
        if (sortBy) {
            let typeArr = [];
            typeArr = sortBy.split(" ");
            let sortType = typeArr[1];
            let field = typeArr[0];
            sortquery[field ? field : 'createdAt'] = sortType ? (sortType == 'desc' ? -1 : 1) : -1;
        } else {
            sortquery = { createdAt: 1 }
        }

        if (user_id) {
            user_id = new mongoose.Types.ObjectId(user_id)
        }

        if (login_user_id) {
            login_user_id = new mongoose.Types.ObjectId(login_user_id)
        }

        if (isDeleted) {
            query.isDeleted = isDeleted ? isDeleted === 'true' : true ? isDeleted : false;
        } else {
            query.isDeleted = false;
        }

        // let matchQuary = {};

        // matchQuary.room_id = new mongoose.Types.ObjectId(room_id);

        let matchQuary = {
            room_id: new mongoose.Types.ObjectId(room_id),
            clearedBy: { $nin: [login_user_id] },
        };

        let pipeline = [
            {
                $match: matchQuary

            },
            {
                $lookup: {
                    from: "users",
                    localField: "sender",
                    foreignField: "_id",
                    as: "sender_details"
                }
            },
            {
                $unwind: {
                    path: '$sender_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "chatcommonoperations",
                    let: { message_id: "$_id", user_id: user_id, type: "message" },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$message_id", "$$message_id"] },
                                    { $eq: ["$user_id", "$$user_id"] },
                                    { $eq: ["$type", "$$type"] },
                                ]
                            }
                        }
                    }],
                    as: "chatcommonoperations_details"
                }
            },
            {
                $unwind: {
                    path: '$chatcommonoperations_details',
                    preserveNullAndEmptyArrays: true
                }
            },

            // //------------ checking message deleted for login user or not -----------//
            {
                $lookup: {
                    from: "chatcommonoperations",
                    let: { message_id: "$_id", user_id: login_user_id, type: "message" },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$message_id", "$$message_id"] },
                                    { $eq: ["$user_id", "$$user_id"] },
                                    { $eq: ["$type", "$$type"] },
                                ]
                            }
                        }
                    }],
                    as: "deleted_message_details"
                }
            },
            {
                $unwind: {
                    path: '$deleted_message_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            //------------ checking message deleted for login user or not -----------//
        ];

        let projection = {
            $project: {
                type: "$type",
                room_id: "$room_id",
                sender: "$sender",
                sender_name: "$sender_details.fullName",
                sender_image: "$sender_details.image",
                sender_logo: "$sender_details.logo",
                content: "$content",
                media: "$media",
                inviteId: "$inviteId",
                project_id: "$project_id",
                message_type: "$message_type",
                isRead: {
                    $cond: [{ $ifNull: ['$chatcommonoperations_details', false] }, "$chatcommonoperations_details.isRead", false]
                },
                isDeleted: {
                    $cond: [{ $ifNull: ['$deleted_message_details', false] }, "$deleted_message_details.isDeleted", false]
                },
                createdAt: "$createdAt",
                updatedAt: "$updatedAt",
            }
        }
        pipeline.push(projection);
        pipeline.push({
            $match: query
        });

        let group_stage = {
            $group: {
                _id: "$_id",
                type: { $first: "$type" },
                room_id: { $first: "$room_id" },
                sender: { $first: "$sender" },
                sender_name: { $first: "$sender_name" },
                sender_image: { $first: "$sender_image" },
                sender_logo: { $first: "$sender_logo" },
                content: { $first: "$content" },
                media: { $first: "$media" },
                project_id: { $first: "$project_id" },
                inviteId: { $first: "$inviteId" },
                message_type: { $first: "$message_type" },
                isRead: { $first: "$isRead" },
                isDeleted: { $first: "$isDeleted" },
                createdAt: { $first: "$createdAt" },
                updatedAt: { $first: "$updatedAt" },
            }
        };
        pipeline.push(group_stage);
        pipeline.push({
            $sort: sortquery
        });
        // console.log(sortquery, "--------------sortquery")
        let totalResult = await db.messages.aggregate(pipeline);

        pipeline.push({
            $skip: Number(skipNo)
        });
        pipeline.push({
            $limit: Number(count)
        });

        let result = await db.messages.aggregate(pipeline);

        const finalResult = result.map((message) => {
            const senderId = message.sender.toString();
            const isBlocked = blockedStatusMap.get(senderId) || false;
            return {
                ...message,
                isBlocked,
            };
        });
        let resData = {
            total: totalResult ? totalResult.length : 0,
            data: finalResult ? finalResult : []
        }
        // if (!req.query.page && !req.query.count) {
        //     resData.data = totalResult ? totalResult : []
        // }

        if (!req.query.page && !req.query.count) {
            resData.data = totalResult.map((message) => {
                const senderId = message.sender.toString();
                const isBlocked = blockedStatusMap.get(senderId) || false;
                return {
                    ...message,
                    isBlocked,
                };
            });
        }

        return response.success(resData, "Fetched all messages", req, res);

    } catch (error) {
        console.log(error);
        return response.failed(null, `${error}`, req, res);
    }
}

// exports.getAllRoomMembers = async (req, res, next) => {
//     try {
//         let { user_id, room_id, search, property_id, sortBy, isGroupChat, quickChat } = req.query;
//         let page = req.query.page || 1;
//         let count = req.query.count || 10;
//         let skipNo = (Number(page) - 1) * Number(count);
//         let query = {};

//         if (search) {
//             // search = await Services.Utils.remove_special_char_exept_underscores(search);
//             query.$or = [
//                 { subject: { $regex: search, '$options': 'i' } },
//                 { fullName: { $regex: search, '$options': 'i' } },
//                 { email: { $regex: search, '$options': 'i' } },
//             ]
//         }

//         let sortquery = {};
//         if (sortBy) {
//             let typeArr = [];
//             typeArr = sortBy.split(" ");
//             let sortType = typeArr[1];
//             let field = typeArr[0];
//             sortquery[field ? field : 'updatedAt'] = sortType ? (sortType == 'desc' ? -1 : 1) : -1;
//         } else {
//             sortquery = { updatedAt: -1 }
//         }

//         if (isGroupChat) {
//             if (isGroupChat === 'true') {
//                 isGroupChat = true;
//             } else {
//                 isGroupChat = false;
//             }
//             query.isGroupChat = isGroupChat;
//         } else {
//             query.isGroupChat = false;
//         }

//         if (quickChat == "true") {
//             query.quickChat = true
//         } else if (quickChat == "false") {
//             query.quickChat = false
//         }
//         if (user_id) {
//             query.user_id = new mongoose.Types.ObjectId(user_id);
//             var admin_data = await db.users.find({}).limit(1).select(["fullName", "email", "image", "isOnline"])

//         }

//         if (room_id) {
//             query.room_id = new mongoose.Types.ObjectId(room_id);
//         }
//         if (property_id) {
//             query.property_id = new mongoose.Types.ObjectId(property_id);

//         }


//         let pipeline = [
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "user_id",
//                     foreignField: "_id",
//                     as: "user_id_details"
//                 }
//             },
//             {
//                 $unwind: {
//                     path: '$user_id_details',
//                     preserveNullAndEmptyArrays: true
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "rooms",
//                     localField: "room_id",
//                     foreignField: "_id",
//                     as: "room_id_details"
//                 }
//             },
//             {
//                 $unwind: {
//                     path: '$room_id_details',
//                     preserveNullAndEmptyArrays: true
//                 }
//             },
//         ];

//         let projection = {
//             $project: {
//                 id: "$_id",
//                 isGroupChat: "$isGroupChat",
//                 room_id: "$room_id",
//                 room_details: "$room_id_details",
//                 subject: "$room_id_details.subject",
//                 user_id: "$user_id",
//                 user_details: "$user_id_details",
//                 fullName: "$user_id_details.fullName",
//                 email: "$user_id_details.email",
//                 isOnline: "$user_id_details.isOnline",
//                 quickChat: "$quickChat",
//                 admin_chat_count: "$admin_chat_count",
//                 user_chat_count: "$user_chat_count",
//                 createdAt: "$createdAt",
//                 updatedAt: "$updatedAt",
//                 property_id: "$property_id"
//             }
//         }

//         let grouped = {
//             $group: {
//                 _id: "$room_id",
//                 isGroupChat: { $first: "$isGroupChat" },
//                 room_id: { $first: "$room_id" },
//                 room_details: { $first: "$room_details" },
//                 user_id: { $push: "$user_id" },
//                 quickChat: { $first: "$quickChat" },
//                 fullName: { $first: "$fullName" },
//                 user_details: { $push: "$user_details" },
//                 user_chat_count: { $first: "$user_chat_count" },
//                 admin_chat_count: { $first: "$admin_chat_count" },
//                 issOnline: { $first: "$isOnline" },
//                 // admin_chat_count: {$first:"$admin_chat_count"},
//                 createdAt: { $first: "$createdAt" },
//                 updatedAt: { $first: "$updatedAt" },
//                 property_id: { $first: "$property_id" },
//             }
//         }

//         pipeline.push(projection);
//         pipeline.push({
//             $match: query
//         });
//         pipeline.push({
//             $sort: sortquery
//         });
//         pipeline.push(grouped);
//         pipeline.push({
//             $sort: sortquery
//         });
//         let totalResult = await db.roommembers.aggregate(pipeline);

//         pipeline.push({
//             $skip: Number(skipNo)
//         });
//         pipeline.push({
//             $limit: Number(count)
//         });

//         let result = await db.roommembers.aggregate(pipeline);

//         if (admin_data) {
//             if (result && result.length > 0) {

//                 for await (let single of result) {
//                     single.admin_details = admin_data[0]
//                 }
//             }
//         }

//         let resData = {
//             total: totalResult ? totalResult.length : 0,
//             data: result ? result : []
//         }
//         if (!req.query.page && !req.query.count) {
//             if (admin_data && totalResult && totalResult.length > 0) {

//                 for await (let single of totalResult) {
//                     single.admin_details = admin_data[0]
//                     // console.log(single,'single');
//                 }
//             }
//             resData.data = totalResult ? totalResult : []
//         }
//         return response.success(resData, "Fetched all room members", req, res);

//     } catch (error) {
//         return response.failed(null, `${error}`, req, res);
//     }
// }

exports.getAllRecentChats = async (req, res, next) => {
    try {
        if (isGuestRequest(req)) {
            const room_id = req.query.room_id || 'guest-room-1';
            const property_id = req.query.property_id || 'guest-prop-1';
            const chats = buildGuestRecentChats(room_id, property_id);
            const page = req.query.page ? Number(req.query.page) : 1;
            const count = req.query.count ? Number(req.query.count) : chats.length;
            const skipNo = (page - 1) * count;
            const paginated = chats.slice(skipNo, skipNo + count);
            return response.success({ total: chats.length, data: paginated }, constants.USER.RECENT_CHAT_FETCHED, req, res);
        }

        let { user_id, room_id, search, property_id, sortBy, isGroupChat, login_user_id } = req.query;
        let page = req.query.page || 1;
        let count = req.query.count || 10;
        let skipNo = (Number(page) - 1) * Number(count);
        let query = {};

        if (search) {
            // search = await Services.Utils.remove_special_char_exept_underscores(search);
            query.$or = [
                { content: { $regex: search, '$options': 'i' } },
                { "room_members.user_name": { $regex: search, '$options': 'i' } },
            ]
        }


        let sortquery = {};
        if (sortBy) {
            let typeArr = [];
            typeArr = sortBy.split(" ");
            let sortType = typeArr[1];
            let field = typeArr[0];
            sortquery[field ? field : 'createdAt'] = sortType ? (sortType == 'desc' ? -1 : 1) : -1;
        } else {
            sortquery = { last_message_at: -1 }
        }

        if (isGroupChat) {
            if (isGroupChat === 'true') {
                isGroupChat = true;
            } else {
                isGroupChat = false;
            }
            query.isGroupChat = isGroupChat;
        } else {
            query.isGroupChat = false;
        }

        if (user_id) {
            user_id = new mongoose.Types.ObjectId(user_id);
            query.user_id = user_id;
        }

        if (room_id) {
            query.room_id = new mongoose.Types.ObjectId(room_id);
        }

        if (login_user_id) {
            login_user_id = new mongoose.Types.ObjectId(login_user_id);
        }
        if (property_id) {
            property_id = new mongoose.Types.ObjectId(property_id);

        }

        let pipeline = [
            {
                $lookup: {
                    from: "rooms",
                    localField: "room_id",
                    foreignField: "_id",
                    as: "room_id_details"
                }
            },
            {
                $unwind: {
                    path: '$room_id_details',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "properties",
                    localField: "property_id",
                    foreignField: "_id",
                    as: "property_details"
                }
            },
            {
                $unwind: {
                    path: '$property_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            // ----------- Last message details --------------//

            {
                $lookup: {
                    from: "messages",
                    let: { room_id: "$room_id" },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$room_id", "$$room_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "chatcommonoperations",
                            let: { message_id: "$_id", user_id: login_user_id, type: "message" },
                            pipeline: [{
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$message_id", "$$message_id"] },
                                            { $eq: ["$user_id", "$$user_id"] },
                                            { $eq: ["$type", "$$type"] },
                                        ]
                                    }
                                }
                            }],
                            as: "deleted_message_details"
                        }
                    },
                    {
                        $unwind: {
                            path: '$deleted_message_details',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $addFields: {
                            isDeleted: {
                                $cond: [{ $ifNull: ['$deleted_message_details', false] }, "$deleted_message_details.isDeleted", false]
                            },
                        }
                    },
                    {
                        $unset: ["deleted_message_details"]
                    },
                    {
                        $match: {
                            isDeleted: false,
                        }
                    },
                    {
                        $sort: { createdAt: -1 }
                    },
                    {
                        $limit: 1
                    }
                    ],
                    as: "messages_details"
                }
            },
            {
                $unwind: {
                    path: '$messages_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            // ----------- Last message details --------------//



            // ----------- room members details exprect login user --------------//
            {
                $lookup: {
                    from: "roommembers",
                    let: { room_id: "$room_id", user_id: user_id },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$room_id", "$$room_id"] },
                                    { $ne: ["$user_id", "$$user_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "user_id",
                            foreignField: "_id",
                            as: "user_id_details"
                        }
                    },
                    {
                        $unwind: {
                            path: '$user_id_details',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            id: "$_id",
                            user_id: "$user_id",
                            user_role: "$user_id_details.role",
                            user_name: "$user_id_details.fullName",
                            user_logo: "$user_id_details.logo",
                            user_image: "$user_id_details.image",
                            isOnline: "$user_id_details.isOnline",
                        }
                    }
                    ],
                    as: "room_members_details"
                }
            },
            // ----------- room members details exprect login user --------------//


            // ----------- unread message count --------------//
            {
                $lookup: {
                    from: "messages",
                    let: { room_id: "$room_id", user_id: user_id },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$room_id", "$$room_id"] },
                                    { $ne: ["$user_id", "$$user_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "chatcommonoperations",
                            let: { message_id: "$_id", user_id: user_id, type: "message" },
                            pipeline: [{
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$message_id", "$$message_id"] },
                                            { $eq: ["$user_id", "$$user_id"] },
                                            { $eq: ["$type", "$$type"] },
                                        ]
                                    }
                                }
                            }],
                            as: "chatcommonoperations_details"
                        }
                    },
                    {
                        $unwind: {
                            path: '$chatcommonoperations_details',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            isRead: "$chatcommonoperations_details.isRead",
                            isDeleted: "$chatcommonoperations_details.isDeleted",
                        }
                    },
                    {
                        $match: {
                            isDeleted: false,
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            read_count: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$isRead", true] }, 1, 0
                                    ]
                                }
                            },
                            unread_count: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$isRead", false] }, 1, 0
                                    ]
                                }
                            }
                        }
                    },
                    ],
                    as: "chatoperations_details"
                }
            },
            {
                $unwind: {
                    path: '$chatoperations_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            // ----------- unread message count --------------//
        ];

        let projection = {
            $project: {
                isGroupChat: "$isGroupChat",
                room_id: "$room_id",
                room_name: "$room_id_details.name",
                user_id: "$user_id",
                last_message: "$messages_details",
                last_message_at: "$messages_details.createdAt",
                room_members: "$room_members_details",
                unread_count: "$chatoperations_details.unread_count",
                read_count: "$chatoperations_details.read_count",
                property_id: "$property_id",
                property_details: "$property_details"
                // chatoperations_details
            }
        }
        pipeline.push(projection);
        pipeline.push({
            $match: query
        });
        pipeline.push({
            $sort: sortquery
        });

        let totalResult = await db.roommembers.aggregate(pipeline);

        pipeline.push({
            $skip: Number(skipNo)
        });
        pipeline.push({
            $limit: Number(count)
        });

        let result = await db.roommembers.aggregate(pipeline);
        let resData = {
            total: totalResult ? totalResult.length : 0,
            data: result ? result : []
        }
        if (!req.query.page && !req.query.count) {
            resData.data = totalResult ? totalResult : []
        }
        return response.success(resData, constants.USER.RECENT_CHAT_FETCHED, req, res);

    } catch (error) {
        return response.failed(null, `${error}`, req, res);
    }
}

exports.getAllUnreadCounts = async (req, res, next) => {
    try {
        let { user_id } = req.query;
        if (!user_id) {
            throw constants.USER.USER_ID_REQUIRED;
        }

        let query = {
            type: "message",
            user_id: user_id,
            isRead: false,
            isDeleted: false
        }

        let get_count = await Services.message.get_unread_messages_count_with_user_id(query)
        let resData = {
            user_id: user_id,
            unread_count: get_count ? get_count : 0
        }
        return response.success(resData, constants.messages.FETCHED_ALL, req, res);
    } catch (error) {
        return response.failed(null, `${error}`, req, res);
    }
}

exports.debugGuest = async (req, res, next) => {
    try {
        const room_id = req.query.room_id || 'guest-room-1';
        const property_id = req.query.property_id || 'guest-prop-1';
        const data = {
            headers: {
                authorization: !!req.headers.authorization,
                guestMode: req.headers['x-guest-mode'],
                guestQuery: req.query?.guest,
            },
            query: req.query,
            isGuest: !!req.isGuest,
            isGuestRequest: isGuestRequest(req),
            identity: {
                id: req.identity?.id,
                _id: req.identity?._id,
                fullName: req.identity?.fullName,
                role: req.identity?.role,
                isGuest: req.identity?.isGuest,
            },
            originalUrl: req.originalUrl,
            guestMock: {
                property_chats: buildGuestPropertyChats(room_id, property_id),
                room_members: buildGuestRoomMembers(room_id, property_id),
                messages: buildGuestChatMessages(room_id),
            },
        };
        return response.success(data, "Chat guest debug", req, res);
    } catch (error) {
        return response.failed(null, `${error}`, req, res);
    }
}

exports.debugGuestFull = async (req, res, next) => {
    try {
        const room_id = req.query.room_id || 'guest-room-1';
        const property_id = req.query.property_id || 'guest-prop-1';

        const messages = buildGuestChatMessages(room_id);
        const recentChats = buildGuestRecentChats(room_id, property_id);
        const propertyChats = buildGuestPropertyChats(room_id, property_id);
        const roomMembers = buildGuestRoomMembers(room_id, property_id);

        const payload = {
            headers: {
                authorization: !!req.headers.authorization,
                guestMode: req.headers['x-guest-mode'],
                guestQuery: req.query?.guest,
            },
            query: req.query,
            isGuest: !!req.isGuest,
            isGuestRequest: isGuestRequest(req),
            identity: {
                id: req.identity?.id,
                _id: req.identity?._id,
                fullName: req.identity?.fullName,
                role: req.identity?.role,
                isGuest: req.identity?.isGuest,
            },
            originalUrl: req.originalUrl,
            responses: {
                messages: {
                    total: messages.length,
                    data: messages,
                },
                recent_chats: {
                    total: recentChats.length,
                    data: recentChats,
                },
                property_chats: {
                    total: propertyChats.length,
                    total_unread_count: propertyChats.reduce((sum, item) => sum + (item.unread_count || 0), 0),
                    data: propertyChats,
                },
                room_members: {
                    total: roomMembers.length,
                    data: roomMembers,
                },
            },
        };
        return response.success(payload, "Chat guest debug full", req, res);
    } catch (error) {
        return response.failed(null, `${error}`, req, res);
    }
}

exports.getAllPropertyChats = async (req, res, next) => {
    try {
        if (isGuestRequest(req)) {
            const room_id = req.query.room_id || 'guest-room-1';
            const property_id = req.query.property_id || 'guest-prop-1';
            const chats = buildGuestPropertyChats(room_id, property_id);
            const page = req.query.page ? Number(req.query.page) : 1;
            const count = req.query.count ? Number(req.query.count) : chats.length;
            const skipNo = (page - 1) * count;
            const paginated = chats.slice(skipNo, skipNo + count);
            const total_unread_count = chats.reduce((sum, item) => sum + (item.unread_count || 0), 0);
            return response.success({ total: chats.length, total_unread_count, data: paginated }, constants.USER.RECENT_CHAT_FETCHED, req, res);
        }

        let { user_id, room_id, search, property_id, sortBy, login_user_id } = req.query;
        let page = req.query.page || 1;
        let count = req.query.count || 10;
        let skipNo = (Number(page) - 1) * Number(count);
        let query = {};

        if (search) {
            query.$or = [
                { content: { $regex: search, '$options': 'i' } },
                { "room_members.user_name": { $regex: search, '$options': 'i' } },
            ]
        }

        let sortquery = {};
        if (sortBy) {
            let typeArr = [];
            typeArr = sortBy.split(" ");
            let sortType = typeArr[1];
            let field = typeArr[0];
            sortquery[field ? field : 'createdAt'] = sortType ? (sortType == 'desc' ? -1 : 1) : -1;
        } else {
            // sortquery = { last_message_at: -1 }
            sortquery = { property_chatSorting: -1 }
        }

        if (user_id) {
            user_id = new mongoose.Types.ObjectId(user_id);
            query.user_id = user_id;
        }

        if (room_id) {
            query.room_id = new mongoose.Types.ObjectId(room_id);
        }

        if (login_user_id) {
            login_user_id = new mongoose.Types.ObjectId(login_user_id);
        }
        if (property_id) {
            property_id = new mongoose.Types.ObjectId(property_id);
        }
        let pipeline = [
            {
                $lookup: {
                    from: "rooms",
                    localField: "room_id",
                    foreignField: "_id",
                    as: "room_id_details"
                }
            },
            {
                $unwind: {
                    path: '$room_id_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "properties",
                    localField: "property_id",
                    foreignField: "_id",
                    as: "property_details"
                }
            },
            {
                $unwind: {
                    path: '$property_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            // ----------- Last message details --------------//

            {
                $lookup: {
                    from: "messages",
                    let: { room_id: "$room_id" },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$room_id", "$$room_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "chatcommonoperations",
                            let: { user_id: login_user_id, property_id: "$property_id" },
                            pipeline: [{
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$user_id", "$$user_id"] },
                                            { $eq: ["$property_id", "$$property_id"] },
                                        ]
                                    }
                                }
                            }],
                            as: "deleted_message_details"
                        }
                    },
                    {
                        $unwind: {
                            path: '$deleted_message_details',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $addFields: {
                            isDeleted: {
                                $cond: [{ $ifNull: ['$deleted_message_details', false] }, "$deleted_message_details.isDeleted", false]
                            },
                        }
                    },
                    {
                        $unset: ["deleted_message_details"]
                    },
                    {
                        $match: {
                            isDeleted: false,
                        }
                    },
                    {
                        $sort: { createdAt: -1 }
                    },
                    {
                        $limit: 1
                    }
                    ],
                    as: "messages_details"
                }
            },
            {
                $unwind: {
                    path: '$messages_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            // ----------- Last message details --------------//



            // ----------- unread message count --------------//
            {
                $lookup: {
                    from: "messages",
                    let: { room_id: "$room_id", property_id: property_id },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$room_id", "$$room_id"] },
                                    { $ne: ["$property_id", "$$property_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "chatcommonoperations",
                            let: { message_id: "$_id", user_id: login_user_id, type: "message" },
                            pipeline: [{
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$message_id", "$$message_id"] },
                                            { $eq: ["$type", "$$type"] },
                                            { $eq: ["$user_id", "$$user_id"] },
                                        ]
                                    }
                                }
                            }],
                            as: "chatcommonoperations_details"
                        }
                    },
                    {
                        $unwind: {
                            path: '$chatcommonoperations_details',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            isRead: "$chatcommonoperations_details.isRead",
                            isDeleted: "$chatcommonoperations_details.isDeleted",
                        }
                    },
                    {
                        $match: {
                            isDeleted: false,
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            read_count: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$isRead", true] }, 1, 0
                                    ]
                                }
                            },
                            unread_count: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$isRead", false] }, 1, 0
                                    ]
                                }
                            }
                        }
                    },
                    ],
                    as: "chatoperations_details"
                }
            },
            {
                $unwind: {
                    path: '$chatoperations_details',
                    preserveNullAndEmptyArrays: true
                }
            }, {

                $project: {
                    isGroupChat: "$isGroupChat",
                    room_id: "$room_id",
                    room_name: "$room_id_details.name",
                    user_id: "$user_id",
                    last_message: "$messages_details",
                    last_message_at: "$messages_details.createdAt",
                    room_members: "$room_members_details",
                    unread_count: "$chatoperations_details.unread_count",
                    read_count: "$chatoperations_details.read_count",
                    property_id: "$property_id",
                    property_name: "$property_details.name",
                    property_images: "$property_details.images",
                    property_address: "$property_details.address",
                    propertyType: "$property_details.propertyType",
                    content: "$property_details.content",
                    propertyTitle: "$property_details.propertyTitle",
                    property_addedby: "$property_details.addedBy",
                    property_chatSorting: "$property_details.chatSorting"
                }
            },
            {
                $match: query,

            }

            // ----------- unread message count --------------//
        ];
        let group_stage = {
            $group: {
                _id: "$property_id",
                isGroupChat: { $first: "$isGroupChat" },
                room_id: { $first: "$room_id" },
                room_name: { $first: "$room_name" },
                user_id: { $push: "$user_id" },
                last_message: { $first: "$last_message" },
                last_message_at: { $first: "$last_message_at" },
                room_members: { $first: "$room_members" },
                unread_count: { $first: "$unread_count" },
                read_count: { $first: "$read_count" },
                property_id: { $first: "$property_id" },
                property_name: { $first: "$property_name" },
                property_images: { $first: "$property_images" },
                property_address: { $first: "$property_address" },
                propertyType: { $first: "$propertyType" },
                content: { $first: "$content" },
                propertyTitle: { $first: "$propertyTitle" },
                property_addedby: { $first: "$property_addedby" },
                property_chatSorting: { $first: "$property_chatSorting" }
            }
        };
        let unread_count_group_stage = {
            $group: {
                _id: null,
                total_unread_count: { $sum: "$unread_count" },
                results: { $push: "$$ROOT" }
            }
        };
        // pipeline.push(projection);
        pipeline.push(group_stage);
        // pipeline.push({
        //     $match: query
        // });
        pipeline.push({
            $sort: sortquery
        });
        let totalUnreadCountResult = await db.roommembers.aggregate([...pipeline, unread_count_group_stage]);
        let totalUnreadCount = totalUnreadCountResult.length > 0 ? totalUnreadCountResult[0].total_unread_count : 0;
        let totalResult = await db.roommembers.aggregate(pipeline);
        pipeline.push({
            $skip: Number(skipNo)
        });
        pipeline.push({
            $limit: Number(count)
        });
        let result = await db.roommembers.aggregate(pipeline);
        let resData = {
            total: totalResult ? totalResult.length : 0,
            total_unread_count: totalUnreadCount,
            data: result ? result : []
        };
        if (!req.query.page && !req.query.count) {
            resData.data = totalResult ? totalResult : [];
        }
        return response.success(resData, constants.USER.RECENT_CHAT_FETCHED, req, res);
    } catch (error) {
        return response.failed(null, `${error}`, req, res);
    }
}


// exports.getAllRoomMembers = async (req, res, next) => {
//     try {
//         let { user_id, room_id, search, property_id, sortBy, isGroupChat, quickChat } = req.query;
//         let page = req.query.page || 1;
//         let count = req.query.count || 10;
//         let skipNo = (Number(page) - 1) * Number(count);
//         let query = {};

//         if (search) {
//             // search = await Services.Utils.remove_special_char_exept_underscores(search);
//             query.$or = [
//                 { subject: { $regex: search, '$options': 'i' } },
//                 { fullName: { $regex: search, '$options': 'i' } },
//                 { email: { $regex: search, '$options': 'i' } },
//             ]
//         }

//         let sortquery = {};
//         if (sortBy) {
//             let typeArr = [];
//             typeArr = sortBy.split(" ");
//             let sortType = typeArr[1];
//             let field = typeArr[0];
//             sortquery[field ? field : 'updatedAt'] = sortType ? (sortType == 'desc' ? -1 : 1) : -1;
//         } else {
//             sortquery = { updatedAt: -1 }
//         }

//         if (isGroupChat) {
//             if (isGroupChat === 'true') {
//                 isGroupChat = true;
//             } else {
//                 isGroupChat = false;
//             }
//             query.isGroupChat = isGroupChat;
//         } else {
//             query.isGroupChat = false;
//         }

//         if (quickChat == "true") {
//             query.quickChat = true
//         } else if (quickChat == "false") {
//             query.quickChat = false
//         }
//         if (user_id) {
//             query.user_id = new mongoose.Types.ObjectId(user_id);

//         }

//         if (room_id) {
//             query.room_id = new mongoose.Types.ObjectId(room_id);
//         }
//         if (property_id) {
//             query.property_id = new mongoose.Types.ObjectId(property_id);

//         }


//         let pipeline = [
//             {
//                 $lookup: {
//                     from: "users",
//                     localField: "user_id",
//                     foreignField: "_id",
//                     as: "user_id_details"
//                 }
//             },
//             {
//                 $unwind: {
//                     path: '$user_id_details',
//                     preserveNullAndEmptyArrays: true
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "rooms",
//                     localField: "room_id",
//                     foreignField: "_id",
//                     as: "room_id_details"
//                 }
//             },
//             {
//                 $unwind: {
//                     path: '$room_id_details',
//                     preserveNullAndEmptyArrays: true
//                 }
//             },
//         ];

//         let projection = {
//             $project: {
//                 id: "$_id",
//                 isGroupChat: "$isGroupChat",
//                 room_id: "$room_id",
//                 room_details: "$room_id_details",
//                 subject: "$room_id_details.subject",
//                 user_id: "$user_id",
//                 user_details: "$user_id_details",
//                 fullName: "$user_id_details.fullName",
//                 email: "$user_id_details.email",
//                 isOnline: "$user_id_details.isOnline",
//                 quickChat: "$quickChat",
//                 admin_chat_count: "$admin_chat_count",
//                 user_chat_count: "$user_chat_count",
//                 createdAt: "$createdAt",
//                 updatedAt: "$updatedAt",
//                 property_id: "$property_id"
//             }
//         }

//         let grouped = {
//             $group: {
//                 _id: "$user_id_details._id",
//                 isGroupChat: { $first: "$isGroupChat" },
//                 room_id: { $push: "$room_id" },
//                 room_details: { $push: "$room_details" },
//                 user_id: { $first: "$user_id" },
//                 quickChat: { $first: "$quickChat" },
//                 fullName: { $first: "$fullName" },
//                 user_details: { $first: "$user_details" },
//                 user_chat_count: { $first: "$user_chat_count" },
//                 admin_chat_count: { $first: "$admin_chat_count" },
//                 issOnline: { $first: "$isOnline" },
//                 // admin_chat_count: {$first:"$admin_chat_count"},
//                 createdAt: { $first: "$createdAt" },
//                 updatedAt: { $first: "$updatedAt" },
//                 property_id: { $first: "$property_id" },
//             }
//         }

//         pipeline.push(projection);
//         pipeline.push({
//             $match: query
//         });
//         pipeline.push({
//             $sort: sortquery
//         });
//         pipeline.push(grouped);
//         pipeline.push({
//             $sort: sortquery
//         });
//         let totalResult = await db.roommembers.aggregate(pipeline);

//         pipeline.push({
//             $skip: Number(skipNo)
//         });
//         pipeline.push({
//             $limit: Number(count)
//         });

//         let result = await db.roommembers.aggregate(pipeline);


//         let resData = {
//             total: totalResult ? totalResult.length : 0,
//             data: result ? result : []
//         }
//         if (!req.query.page && !req.query.count) {

//             resData.data = totalResult ? totalResult : []
//         }
//         return response.success(resData, "Fetched all room members", req, res);

//     } catch (error) {
//         return response.failed(null, `${error}`, req, res);
//     }
// }
exports.getAllRoomMembers = async (req, res, next) => {
    try {
        if (isGuestRequest(req)) {
            const room_id = req.query.room_id || 'guest-room-1';
            const property_id = req.query.property_id || 'guest-prop-1';
            const members = buildGuestRoomMembers(room_id, property_id);
            const visibleMembers = members.filter(
                (itm) => itm?.user_id !== 'guest-user-000' && itm?.user_role !== 'owner'
            );
            return response.success({ total: visibleMembers.length, data: visibleMembers }, "Fetched all room members", req, res);
        }

        let { user_id, room_id, search, property_id, login_user_id, sortBy, isGroupChat, quickChat } = req.query;
        let page = req.query.page || 1;
        let count = req.query.count || 10;
        let skipNo = (Number(page) - 1) * Number(count);
        let query = {};

        if (search) {
            query.$or = [
                { subject: { $regex: search, '$options': 'i' } },
                { fullName: { $regex: search, '$options': 'i' } },
                { email: { $regex: search, '$options': 'i' } },
            ]
        }

        let sortquery = {};
        if (sortBy) {
            let typeArr = sortBy.split(" ");
            let sortType = typeArr[1];
            let field = typeArr[0];
            sortquery[field ? field : 'updatedAt'] = sortType ? (sortType == 'desc' ? -1 : 1) : -1;
        } else {
            sortquery = { updatedAt: -1 }
        }

        if (isGroupChat) {
            isGroupChat = isGroupChat === 'true';
            query.isGroupChat = isGroupChat;
        }

        if (quickChat == "true") {
            query.quickChat = true;
        } else if (quickChat == "false") {
            query.quickChat = false;
        }

        if (user_id) {
            query.user_id = new mongoose.Types.ObjectId(user_id);
        }

        if (room_id) {
            query.room_id = new mongoose.Types.ObjectId(room_id);
        }

        if (property_id) {
            query.property_id = new mongoose.Types.ObjectId(property_id);
        }
        if (login_user_id) {
            login_user_id = new mongoose.Types.ObjectId(login_user_id);
        }

        let pipeline = [
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user_id_details"
                }
            },
            {
                $unwind: {
                    path: '$user_id_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "rooms",
                    localField: "room_id",
                    foreignField: "_id",
                    as: "room_id_details"
                }
            },
            {
                $unwind: {
                    path: '$room_id_details',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "messages",
                    let: { room_id: "$room_id" },
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$room_id", "$$room_id"] },
                                ]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: "chatcommonoperations",
                            let: { message_id: "$_id", user_id: login_user_id, type: "message" },
                            pipeline: [{
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$message_id", "$$message_id"] },
                                            { $eq: ["$user_id", "$$user_id"] },
                                            { $eq: ["$type", "$$type"] },
                                        ]
                                    }
                                }
                            }],
                            as: "deleted_message_details"
                        }
                    },
                    {
                        $unwind: {
                            path: '$deleted_message_details',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $addFields: {
                            isDeleted: {
                                $cond: [{ $ifNull: ['$deleted_message_details', false] }, "$deleted_message_details.isDeleted", false]
                            },
                        }
                    },
                    {
                        $unset: ["deleted_message_details"]
                    },
                    {
                        $match: {
                            isDeleted: false,
                        }
                    },
                    {
                        $sort: { createdAt: -1 }
                    },
                    {
                        $limit: 1
                    }
                    ],
                    as: "messages_details"
                }
            },
            {
                $unwind: {
                    path: '$messages_details',
                    preserveNullAndEmptyArrays: true
                }
            },
            // ----------- Last message details --------------//

            {
                $project: {
                    id: "$_id",
                    isGroupChat: "$isGroupChat",
                    room_id: "$room_id",
                    room_details: "$room_id_details",
                    subject: "$room_id_details.subject",
                    user_id: "$user_id",
                    user_details: "$user_id_details",
                    fullName: "$user_id_details.fullName",
                    email: "$user_id_details.email",
                    isOnline: "$user_id_details.isOnline",
                    quickChat: "$quickChat",
                    admin_chat_count: "$admin_chat_count",
                    user_chat_count: "$user_chat_count",
                    createdAt: "$createdAt",
                    updatedAt: "$updatedAt",
                    property_id: "$property_id",
                    messages_details: "$messages_details"
                },
            },
            {
                $match: query
            }
        ];

        let grouped = {
            $group: {
                _id: "$user_id",
                isGroupChat: { $first: "$isGroupChat" },
                room_id: { $push: "$room_id" },
                room_details: { $push: "$room_details" },
                user_id: { $first: "$user_id" },
                fullName: { $first: "$fullName" },
                user_details: { $first: "$user_details" },
                user_chat_count: { $sum: "$user_chat_count" },
                admin_chat_count: { $first: "$admin_chat_count" },
                isOnline: { $first: "$isOnline" },
                createdAt: { $first: "$createdAt" },
                updatedAt: { $first: "$updatedAt" },
                property_id: { $first: "$property_id" },
                messages_details: { $first: "$messages_details" },
            }
        };

        pipeline.push(grouped);
        pipeline.push({ $sort: sortquery });
        let totalResult = await db.roommembers.aggregate(pipeline);
        pipeline.push({ $skip: Number(skipNo) });
        pipeline.push({ $limit: Number(count) });
        let result = await db.roommembers.aggregate(pipeline);

        let resData = {
            total: totalResult ? totalResult.length : 0,
            data: result ? result : []
        };

        if (!req.query.page && !req.query.count) {
            resData.data = totalResult ? totalResult : [];
        }

        return response.success(resData, "Fetched all room members", req, res);

    } catch (error) {
        return response.failed(null, `${error}`, req, res);
    }
};
