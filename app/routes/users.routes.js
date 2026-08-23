var user = require("../controllers/UsersController");
var adminCompany = require("../controllers/AdminCompanyController");

var router = require("express").Router();

router.post("/admin/login", user.adminLogin);

/**
 * User Login
 *
 * Used to login in the application. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "User Loging successfully."
 */
router.post("/login", user.userLogin);

/**
 * Auto Login
 *
 * Used to login in the application. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "User Loging successfully."
 */
router.post("/auto/login", user.autoLogin);
router.post("/auto/loginbyid", user.autoLoginById);
/**
 * User Detail
 *
 * Used to get detail of user using id. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField data:  {"fullName":"devmerff","email":"devmarff@xyz.com","address":"","image":"","status":"active"}
 */

router.get("/admin/profile", user.adminProfileData);
// router.get("/manager/profile/:id", user.ManagerProfileData);

/**
 * User Detail
 *
 * Used to get detail of user using id. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField data:  {"fullName":"devmerff","email":"devmarff@xyz.com","address":"","image":"","status":"active"}
 */

router.get("/detail", user.userDetail);

/**
 *Update Profile
 *
 * Used to update user profile data. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField Success : true
 * @responseField message: "User updated successfully."
 */
router.put("/admin/update-profile", user.adminUpdateProfile);
router.get("/partner/listing", user.getPartnerPros);
// router.put("/manager/update-profile", user.ManagerUpdateProfile);

/** Manager
 *
 * Used to Delete Manager. if everything is okay you'll get 200 OK response
 */

router.put("/statusChange", user.activateDeactivateProfile);
/**
 *Users's Listing
 *
 * If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField Success : true
 *
 */
router.get("/listing", user.getAllUsers);
router.get("/manager/list", user.getList);
router.get("/admin-detail", user.getAdminDetail);

/**
 * Change Password
 *
 * Used to change the password using current password. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "Password changed successfully."
 */
router.put("/change/password", user.changePassword);

/**
 * Forgot Password
 *P
 * Used to send verification code on email in case if user forgot password and try to reset the password. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "Please check your email for verification code."
 */
router.post("/admin/forgot/password", user.forgotPasswordAdmin);

/**
 * Forgot Password User
 *
 * Used to send verification code on email in case if user forgot password and try to reset the password. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "Please check your email for verification code."
 */
router.post("/forgot/password", user.forgotPasswordUser);
/**
 *Verify Forgot Password User Otp
 *
 * Used to send verification code on email in case if user forgot password and try to reset the password. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "Please check your email for verification code."
 */
router.post("/verify/forgot-otp", user.verifyForgotOtp);

/**
 * Reset Password
 *
 * Reset the account password using verification code recived on email. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "Password reset successfully."
 */
router.put("/admin/reset/password", user.adminResetPassword);

/** user register */

router.post("/registerUser", user.userRegister);
/**
 * Reset Password
 *
 * Reset the account password using verification code recived on email. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "Password reset successfully."
 */
router.put("/reset/user-password", user.userResetPassword);

/**verify otp  */

router.post("/verifyOtp", user.verifyOtp);

/**
 * Creating Users
 *
 * Used to add user in the application from admin pannel. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField success: true
 * @responseField message: "User added successfully."
 */
router.post("/add", user.addUser);

router.put("/editUserDetails", user.editUserDetails);

// edit email otp send to old email 1st step
router.put("/editUserEmail", user.editUserEmail);

// edit email otp send to new email 2nd step
router.put("/sendOtpOnNewEmail", user.sendOtpOnNewEmail);

// edit email otp send to verify otp from new email 3rd step
router.post("/verifyOtpOnNewEmail", user.verifyOtpOnNewEmail);








/**
 *Delete User
 *
 * Used to delete a user using id in query param. If everything is okay, you'll get a 200 OK response.
 *
 * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
 *
 * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
 * @responseField Success : true
 * @responseField message:"User deleted successfully."
 */
router.delete("/delete", user.deleteUser);

/**
   *Export Users Data
   *
   * Used to export All users Data in Excel sheet. If everything is okay, you'll get a 200 OK response.
   *
   * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
   *
   * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
   * @responseField Success : true

   */
// router.get("/export/user", user.exportUserData);

/**
   *Check availablity of email
   *
   * If everything is okay, you'll get a 200 OK response.
   *
   * Otherwise, the request will fail with a 400 error, and a response listing the failed services.
   *
   * @response 400 scenario="Service is unhealthy" {success:false,error:{code:400,message:"Server is down currently . Please try after some time."}}
   * @responseField Success : true

   */
router.get("/check/email", user.checkEmail);

router.post("/invite", user.inviteUser);

/**
 * social signupapi api
 * google log in
 */

router.post("/google/signup/login", user.logInSignUpSocialMedia)

router.post("/resend-otp", user.sendVerificationOtp);

router.post("/verify-otp", user.verifyOtp);

router.post("/add-by-admin/lisitng", user.getAdminUsers);

router.get("/admin/lisitng", user.getAdminUsers);
router.get("/admin/activity", user.listUserActivity);
router.get("/pro/listing", user.getAllProUsers);


/**logout routes */

router.get("/logout", user.logout);

/////staff routes
router.post("/addStaff", user.addStaff);
router.get("/staffListing", user.staffListing);
router.get("/staffDetails", user.staffDetails);
router.delete("/staff/deleteProfile", user.deleteProfile);
router.put("/editStaffDetails", user.editStaffDetails);
// router.get("/frontend/lisitng", user.getfrontEndUsers);
// router.post('/import-users', user.importUsers)
// app.use('/api', router);
router.get("/emiision-detail", user.getQuaterlyEmissionValue)


// api for  soical login
router.post("/checkAccount", user.checkAccount)
router.get("/sendMyPersonalData", user.sendMyPersonalData) // sending personal info via email

//2 step verification login for user enabled 
router.post("/verificationLogin", user.verificationLogin);

//handle login history in case of session expire
router.put("/expireSession", user.expireSession)

//get current login details for this account by all the loggedin users
router.get("/sessionList", user.sessionList)


// api where one user can block another user
router.post("/blockuser", user.blockAnotherUser);


//list of those users who have been blocked by you
router.get("/blockedList", user.getBlockList)


//get active plans for users
router.get("/activeplan", user.activePlan)


//get list of all the documents of all users 
router.get("/admin/documents", user.getAllUserDocuments);

router.post("/admin/rateUser", user.rateUserAndVerify);

router.delete("/delete-by-credentials", user.deleteUserByEmailPassword);

// Admin Company detail (profil complet d'un pro/eventOrganizer)
router.get("/admin/company-detail/:id", adminCompany.companyAdminDetail);
router.put("/admin/company-detail/:id/commission", adminCompany.updateUserCommission);
router.put("/admin/company-detail/:id/learning-center", adminCompany.updateUserLearningCenter);
router.put("/admin/company-detail/:id/marketplace", adminCompany.updateUserMarketplace);
router.get("/admin/company-detail/:id/white-label-overview", adminCompany.whiteLabelOverview);
router.put("/admin/company-detail/:id/white-label-commission", adminCompany.updateUserWhiteLabelCommission);

module.exports = router;
