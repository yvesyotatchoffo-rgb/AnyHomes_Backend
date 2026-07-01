const { sendEmail } = require("../config/brevo.config");
const SmtpController = require("../controllers/SmtpController");
const dotenv = require("dotenv");
dotenv.config();
const constants = require("../utls/constants");

const { BACK_WEB_URL, FRONT_WEB_URL, ADMIN_WEB_URL } = process.env;

const forgotPasswordEmail = (options) => {
  let email = options.email;
  let verificationCode = options.verificationCode;
  let firstName = options.fullName;
  let userId = options.id;

  let message = "";

  message += `<!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>
                   
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid 
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid 
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                    class="fz-20">Hi ${firstName},
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    If you've lost your password or wish to reset it.Use the link below to get started.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            

                                       <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${ADMIN_WEB_URL}/reset-password?code=${verificationCode}&id=${userId}"
          style="
                            font-size: 14px;
                            padding: 14px 30px;
                       text-align:center;
                       margin:0 auto;
                            background: #976DD0!important;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                            display:inline-block;
                            border-radius:5px;
                          "
        >
         Reset Your Password
        </a>
      </td>
                        </tr>



                        <tr>
                            <td style="height:60px;">

                            </td>
                        </tr>
                       
                     
            
                   
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>

`;

  // SmtpController.sendEmail(email, "Reset Password", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Reset Password",
    htmlContent: message,
  });
};

const changeEmail = (options) => {
  console.log(options, "===============options");
  let email = options.email;
  let firstName = options.fullName;
  let generateOtp = options.generateOtp;
  let newEmail = options.newEmail;
  let mode = options.mode;
  let message = "";
  if (mode === "mobile") {
    // Email template for mobile mode
    message += `<!DOCTYPE html>
        <html>
        <head>
            <title>Bookaroo</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <style>
                @media (max-width:767px) {
                    .w-100 {
                        width: 100%;
                    }

                    .fz-20 {
                        font-size: 25px !important;
                    }
                }
            </style>
        </head>
        <body style="font-family: 'Poppins', sans-serif; background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>
                    <tr>
                        <td style="padding: 50px 20px;">
                            <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
                                <tr><td style="height:40px;"></td></tr>
                                <tr>
                                    <td style="text-align:center; padding-bottom: 10px;">
                                        <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 120px; margin: 0 auto;" />
                                    </td>
                                </tr>
                                <tr><td style="padding: 20px 60px; border-bottom: 1px solid #E2E8F0;"></td></tr>
                                <tr>
                                    <td style="text-align:center; padding-bottom: 10px;">
                                        <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width: 340px; margin: 0 auto;" />
                                    </td>
                                </tr>
                                <tr><td style="padding: 20px 60px; border-bottom: 1px solid #E2E8F0;"></td></tr>
                                <tr>
                                    <td style="text-align:center;">
                                        <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;" class="fz-20">
                                            Hi ${firstName},
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 25px 0;">
                                        <p style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                            We received a request to update your registered email address. This is your OTP: 
                                        </p>
                                        <p style="font-size:20px; font-weight:bold; text-align:center; color: #976dd0;">
                                            ${generateOtp}
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="text-align:center; margin-top:10px;">
                                        <p style="color: #454242;font-size: 12px; font-weight:600; margin:0px;">Warm regards,</p>
                                        <p style="color: #454242;font-size: 14px;  margin-top: 6px;">Bookaroo Team</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>`;
  } else {
    // Default email template with "Click Here"
    message += `<!DOCTYPE html>
        <html>
        <head>
            <title>Bookaroo</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <style>
                @media (max-width:767px) {
                    .w-100 {
                        width: 100%;
                    }

                    .fz-20 {
                        font-size: 25px !important;
                    }
                }
            </style>
        </head>
        <body style="font-family: 'Poppins', sans-serif; background:#fff;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>
                    <tr>
                        <td style="padding: 50px 20px;">
                            <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
                                <tr><td style="height:40px;"></td></tr>
                                <tr>
                                    <td style="text-align:center; padding-bottom: 10px;">
                                        <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 120px; margin: 0 auto;" />
                                    </td>
                                </tr>
                                <tr><td style="padding: 20px 60px; border-bottom: 1px solid #E2E8F0;"></td></tr>
                                <tr>
                                    <td style="text-align:center; padding-bottom: 10px;">
                                        <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width: 340px; margin: 0 auto;" />
                                    </td>
                                </tr>
                                <tr><td style="padding: 20px 60px; border-bottom: 1px solid #E2E8F0;"></td></tr>
                                <tr>
                                    <td style="text-align:center;">
                                        <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;" class="fz-20">
                                            Hi ${firstName},
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 15px 0 25px 0;">
                                        <p style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                            We received a request to update your registered email address. To complete this process, please click the following button.
                                        </p>
                                        <a href="${FRONT_WEB_URL}/reset-email?otp=${generateOtp}&email=${newEmail}"
                                           style="font-size: 14px; padding: 14px 30px;text-align:center;margin:16px auto; background: #976DD0!important;
                                                  cursor: pointer; border: none; color: #fff;display:inline-block; border-radius:5px; max-width:150px; display:block;">
                                            Click Here
                                        </a>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="text-align:center; margin-top:10px;">
                                        <p style="color: #454242;font-size: 12px; font-weight:600; margin:0px;">Warm regards,</p>
                                        <p style="color: #454242;font-size: 14px;  margin-top: 6px;">Bookaroo Team</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>`;
  }

  // SmtpController.sendEmail(email, "Change Email Confirmation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Change Email Confirmation",
    htmlContent: message,
  });
};

const changeEmailOtp = (options) => {
  console.log(options, "===============options");
  let email = options.email;
  let firstName = options.fullName;
  let generateOtp = options.generateOtp;
  let newEmail = options.email;
  let currentEmail = options.currentEmail;
  let mode = options.mode;
  let message = "";
  if (mode === "mobile") {
    message += `<!DOCTYPE html>
        <html>
  <head>
      <title>Bookaroo</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet">
  
      <style>
          @media (max-width:767px) {
              .w-100 {
                  width: 100%;
              }
  
              .fz-20 {
                  font-size: 25px !important;
              }
          }
      </style>
  
  </head>
  
  <body style="font-family: 'Poppins', sans-serif; background:#fff;">
      <table width="100%" cellpadding:"0" cellspacing="0">
          <tbody>
              <tr>
                  <td style="padding: 50px 20px;">
                      <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                      ;"
                          class="w-100">
                          <tr>
                              <td style="height:40px;">generateOtp
  
                              </td>
                          </tr>
                     
                          <tr>
                              <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                  <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                  style="width: 120px; margin: 0 auto;" />
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 20px 60px;">
                                  <table width="100%;cellpadding:"0" cellspacing="0" ">
                                      <tr>
                                          <td style="border-bottom: 1px solid 
                              #E2E8F0; ">
  
                              </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td style="text-align:center; padding-bottom: 10px; ">
                                  <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                  style="width: 340px; margin: 0 auto;" />
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 20px 60px;">
                                  <table width="100%;cellpadding:"0" cellspacing="0" ">
                                      <tr>
                                          <td style="border-bottom: 1px solid 
                              #E2E8F0; ">
  
                              </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td style="text-align:center;">
                                  <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                      class="fz-20">Hi ${firstName},
                                  </p>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 15px 0 25px 0;">
                                  <p
                                      style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                      We received a request to update your registered email address${currentEmail} to ${newEmail} . To complete this process, please click the following button.
                                  </p>
                               <p style="font-size:20px; font-weight:bold; text-align:center; color: #976dd0;">
                                            ${generateOtp}
                                </p>
                              </td>
                          </tr>
                          <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
                            <p  style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                     Thank you for using our service.
                                  </p>
                                </td>
                          </tr>
                           <tr>
                              <td style=" text-align:center;margin-top:10px;">
                                  <p style="color: #454242;font-size: 12px; font-weight:600; margin:0px; " >Warm regards,</p>
                                  <p style="color: #454242;font-size: 14px;  margin-top: 6px;  ">Bookaroo Team</p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </tbody>
      </table>
  </body>
  
  </html>
  
  `;
  } else {
    message += `<!DOCTYPE html>
    <html>
<head>
  <title>Bookaroo</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
      href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
      rel="stylesheet">

  <style>
      @media (max-width:767px) {
          .w-100 {
              width: 100%;
          }

          .fz-20 {
              font-size: 25px !important;
          }
      }
  </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
  <table width="100%" cellpadding:"0" cellspacing="0">
      <tbody>
          <tr>
              <td style="padding: 50px 20px;">
                  <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                  ;"
                      class="w-100">
                      <tr>
                          <td style="height:40px;">

                          </td>
                      </tr>
                 
                      <tr>
                          <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                              <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                              style="width: 120px; margin: 0 auto;" />
                          </td>
                      </tr>
                      <tr>
                          <td style="padding: 20px 60px;">
                              <table width="100%;cellpadding:"0" cellspacing="0" ">
                                  <tr>
                                      <td style="border-bottom: 1px solid 
                          #E2E8F0; ">

                          </td>
                                  </tr>
                              </table>
                          </td>
                      </tr>
                      <tr>
                          <td style="text-align:center; padding-bottom: 10px; ">
                              <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                              style="width: 340px; margin: 0 auto;" />
                          </td>
                      </tr>
                      <tr>
                          <td style="padding: 20px 60px;">
                              <table width="100%;cellpadding:"0" cellspacing="0" ">
                                  <tr>
                                      <td style="border-bottom: 1px solid 
                          #E2E8F0; ">

                          </td>
                                  </tr>
                              </table>
                          </td>
                      </tr>
                      <tr>
                          <td style="text-align:center;">
                              <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                  class="fz-20">Hi ${firstName},
                              </p>
                          </td>
                      </tr>
                      <tr>
                          <td style="padding: 15px 0 25px 0;">
                              <p
                                  style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                  We received a request to update your registered email address. To complete this process, please click the following button.
                              </p>
                               <a href="${FRONT_WEB_URL}/reset-new-email?otp=${generateOtp}&email=${newEmail}&currentEmail=${currentEmail}"
                     style="font-size:15px; padding:14px 30px; text-align:center; margin:16px auto;  background: #976DD0!important;
                        cursor: pointer; border: none;  color: #fff; display:inline-block; border-radius:5px; max-width:150px; display:block;">
                          Click Here
                          </a>
                          </td>
                      </tr>
                      <tr>
                        <td style="display: flex; justify-content: center; gap: 10px;">
                        <p  style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                 Thank you for using our service.
                              </p>
                            </td>
                      </tr>
                       <tr>
                          <td style=" text-align:center;margin-top:10px;">
                              <p style="color: #454242;font-size: 12px; font-weight:600; margin:0px; " >Warm regards,</p>
                              <p style="color: #454242;font-size: 14px;  margin-top: 6px;  ">Bookaroo Team</p>
                          </td>
                      </tr>
                  </table>
              </td>
          </tr>
      </tbody>
  </table>
</body>

</html>

`;
  }
  // SmtpController.sendEmail(email, "Change Password Confirmation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Change Password Confirmation",
    htmlContent: message,
  });
};
const changePasswordConfirmation = (options) => {
  let email = options.email;
  let firstName = options.fullName;
  let message = "";
  message += `<!DOCTYPE html>
<html>
<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>
                   
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid 
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid 
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                    class="fz-20">Hi ${firstName},
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    This is to confirm that the password for your account has been successfully changed. Your account is now secured with the new password that you have set.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            

                                       <td style="display: flex; justify-content: center; gap: 10px;">
          <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                   Thank you for using our service.
                                </p>
      </td>
                        </tr>


                 <tr>
                            <td style=" text-align:center;margin-top:10px;">
                                <p style="color: #454242;font-size: 12px; font-weight:600; margin:0px; " >Warm regards,</p>
                                <p style="color: #454242;font-size: 14px;  margin-top: 6px;  ">Bookaroo Team</p>
                            </td>
                        </tr>
                       
                     
            
                   
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>

`;

  // SmtpController.sendEmail(email, "Change Password Confirmation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Change Password Confirmation",
    htmlContent: message,
  });
};

const contactUsEmail = (options) => {
  let email = options.email;
  let fullName = options.fullName;
  let userName = options.userName;
  let useremail = options.useremail;

  let message = "";

  message += `<!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>
                   
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid 
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid 
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                    class="fz-20">Hi ${fullName},
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    A user has just submitted a "Contact Us" request. Please see the user details below:.
                                </p>
                            </td>
                        </tr>
                        <tr> <td style="display: flex; justify-content: center; gap: 10px;"> 
                         <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    User Name: ${userName},<br>
                                    Email Address: ${useremail}
                                    
                                </p>
                        </td>
                        </tr>
                        <tr>
                            <td style="height:60px;">
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>

`;

  // SmtpController.sendEmail(
  //     email,
  //     " New Contact Us Request Submitted by User",
  //     message
  // );
  sendEmail({
    module: "auth",
    to: email,
    subject: "New Contact Us Request Submitted by User",
    htmlContent: message,
  });
};

const addUserEmail = (options) => {
  let email = options.email;
  let fullName = options.fullName;
  let password = options.password;
  let roleName = options.role;

  if (!fullName) {
    fullName = email;
  }
  let message = "";
  message += `
 <!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>

                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #384860; line-height: 24px;"
                                    class="fz-20">Hi ${fullName},
                                </p>
                            </td>
                        </tr>
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;"> `;
  if (roleName == "agency") {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Your agency account is ready!</h2>
                          `;
  } else if (roleName == "staff") {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Your staff account is ready!</h2> `;
  } else {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Congratulations!</h2> `;
  }

  message += `</div>
                          <p  
                            style="
                              font-size: 16px;
                              line-height: 20px;
                              text-align: center;
                              margin-bottom:0;
                            "
                          >
                       
                         <span style="display: block; text-align:center; font-size:15px; padding:0 20px; margin-bottom:2px; color:#2d2b2b;">  Your ${roleName} account has been set up by the Bookaroo Administrator.</span>
                        <div style = "text-align:center;" >
                         <p style="font-size:15px; margin-bottom:5px; margin:0 auto; text-align:center; color:#2d2b2b;">Please use the following credentials to log in:</p>
                       <div>
                        <p style="text-align:center; font-size:15px; margin-bottom:7px;"> <b style=" font-size:15px;">Email :</b> ${email} </p>
                         <p style="text-align:center; font-size:15px;"><b style=" font-size:15px;">Password :</b> ${password}</p>
                       </div>
                        </div>
                       
                          </p>
                        </div>
                      </td>
  
  </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${FRONT_WEB_URL}/login"
          style="
                            font-size: 14px;
                            padding: 14px 30px;
                       text-align:center;
                       margin:0 auto;
                            background: #976DD0!important;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                            display:inline-block;
                            border-radius:5px;
                          "
        >
          Login To Your Account
        </a>
      </td>
                        </tr>



                        <tr>
                            <td style="height:60px;">

                            </td>
                        </tr>




                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>`;

  // SmtpController.sendEmail(email, `Registeration`, message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Registration",
    htmlContent: message,
  });
};

const addStaffEmail = (options) => {
  let email = options.email;
  let fullName = options.fullName;
  let password = options.password;
  let roleName = options.role;

  if (!fullName) {
    fullName = email;
  }
  let message = "";
  message += `
  <!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>

                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #384860; line-height: 24px;"
                                    class="fz-20">Hi ${fullName},
                                </p>
                            </td>
                        </tr>
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;"> `;
  if (roleName == "agency") {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Your agency account is ready!</h2>
                          `;
  } else if (roleName == "staff") {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Your staff account is ready!</h2> `;
  } else {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Congratulations!</h2> `;
  }

  message += `</div>
                          <p  
                            style="
                              font-size: 16px;
                              line-height: 20px;
                              text-align: center;
                              margin-bottom:0;
                            "
                          >
                       
                         <span style="display: block; text-align:center; font-size:15px; padding:0 20px; margin-bottom:2px; color:#2d2b2b;">  Your ${roleName} account has been set up by the Bookaroo Administrator.</span>
                        <div style = "text-align:center;" >
                         <p style="font-size:15px; margin-bottom:5px; margin:0 auto; text-align:center; color:#2d2b2b;">Please use the following credentials to log in:</p>
                       <div>
                        <p style="text-align:center; font-size:15px; margin-bottom:7px;"> <b style=" font-size:15px;">Email :</b> ${email} </p>
                         <p style="text-align:center; font-size:15px;"><b style=" font-size:15px;">Password :</b> ${password}</p>
                       </div>
                        </div>
                       
                          </p>
                        </div>
                      </td>
  
  </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${ADMIN_WEB_URL}/login"
          style="
                            font-size: 14px;
                            padding: 14px 30px;
                       text-align:center;
                       margin:0 auto;
                            background: #976DD0!important;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                            display:inline-block;
                            border-radius:5px;
                          "
        >
          Login To Your Account
        </a>
      </td>
                        </tr>



                        <tr>
                            <td style="height:60px;">

                            </td>
                        </tr>




                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>`;

  // SmtpController.sendEmail(email, `Registeration`, message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Registration",
    htmlContent: message,
  });
};

const welcomeUser = (options) => {
  let email = options.email;

  let message = `
<!DOCTYPE html>
<html>

<head>
    <title>Welcome to Shroom Groove</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>

<body style="font-family: 'Poppins', sans-serif; background: #f3f3f3;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #fff;">
                        <tr>
                            <td style="height: 28px;"></td>
                        </tr>
                        <tr>
                            <td style="text-align: center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 150px; object-fit: contain; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: center; padding-bottom: 10px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="max-width: 278px; width: 100%; margin: 15px auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: center;">
                                <p style="font-size: 20px; max-width: 400px; margin: 0 auto; font-weight: bold; padding: 0 20px; color: #393C3D; line-height: 24px;">
                                    Welcome to Bookaroo,
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p style="font-size: 16px; max-width: 500px; margin: 0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    You’re now part of a Bookaroo. To begin, log in to your account and discover the exciting features waiting for you.
                                </p>
                            </td>
                        </tr>
                    
                        <tr>
                            <td style="height: 60px;"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>`;

  // SmtpController.sendEmail(email, "Welcome to Bookaroo", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Welcome to Bookaroo",
    htmlContent: message,
  });
};

const invite_user_email = (options) => {
  let email = options.email;
  let type = options.type;
  let fullName = options.fullName;
  let password = options.password;

  if (!fullName) {
    firstName = email;
  }
  let message = "";
  message += `
  <!DOCTYPE html>
  <html>
  
  <head>
      <title>Doc-Expiration</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet">
  
      <style>
          @media (max-width:767px) {
              .w-100 {
                  width: 100%;
              }
  
              .fz-20 {
                  font-size: 25px !important;
              }
          }
      </style>
  
  </head>
  
  <body style="font-family: 'Poppins', sans-serif; background:#fff;">
      <table width="100%" cellpadding:"0" cellspacing="0">
          <tbody>
              <tr>
                  <td style="padding: 50px 20px;">
                      <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                      ;"
                          class="w-100">
                          <tr>
                              <td style="height:40px;">
  
                              </td>
                          </tr>
                     
                          <tr>
                              <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                  <img src="${FRONT_WEB_URL}/assets/img/logo.png"
                                  style="width: 120px; margin: 0 auto;" />
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 20px 60px;">
                                  <table width="100%;cellpadding:"0" cellspacing="0" ">
                                      <tr>
                                          <td style="border-bottom: 1px solid 
                              #E2E8F0; ">
  
                              </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td style="text-align:center; padding-bottom: 10px; ">
                                  <img src="${BACK_WEB_URL}/static/banner.png"
                                  style="width: 340px; margin: 0 auto;" />
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 20px 60px;">
                                  <table width="100%;cellpadding:"0" cellspacing="0" ">
                                      <tr>
                                          <td style="border-bottom: 1px solid
                              #E2E8F0; ">
  
                              </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td style="text-align:center;">
                                  <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #384860; line-height: 24px;"
                                      class="fz-20">Hi ${options.fullName},
                                  </p>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 15px 0 25px 0;">
                                  <p
                                      style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                       <span style="font-weight: 600;"> Email </span>
                                       ${email}
                                  </p>
                                  <p
                                      style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                       <span style="font-weight: 600;"> Password </span>
                                       ${password}.
                                  </p>
                                  <p>
                                    

                                  </p>
                              </td>
                          </tr>

                          <tr>
                              <td>`;
  if (type == "new_talent") {
    message += `    <a href="${STAGING_FRONTEND_URL}/sign-in?id=${options.id}""
                                style="background: #3F559E
                        ; display:block;color:#fff;padding:12px 10px; width: 220px; margin: 0 auto 0; box-shadow: none; border: 0; font-size: 15px; text-decoration: none; font-weight: 400; text-align: center;">Click here to log in</a>`;
  } else {
    message += `    <a href="${STAGING_FRONTEND_URL}/organization""
                                style="background: #3F559E
                        ; display:block;color:#fff;padding:12px 10px; width: 220px; margin: 0 auto 0; box-shadow: none; border: 0; font-size: 15px; text-decoration: none; font-weight: 400; text-align: center;">Click here to log in</a>`;
  }

  message += `</td>
                              
                          </tr>
  
  
  
                          <tr>
                              <td style="height:60px;">
                                <p> You are going to Love it here.</p>
                              </td>
                          </tr>
                         
                       
              
                     
                      </table>
                  </td>
              </tr>
          </tbody>
      </table>
  </body>
  
  </html>`;

  // SmtpController.sendEmail(email, "Invitation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Invitation",
    htmlContent: message,
  });
};

const userVerifyLink = async (options) => {
  let email = options.email;
  let fullName = options.fullName;
  let message = "";

  //     message += `
  //  <!DOCTYPE html>
  // <html>

  // <head>
  //     <title>Bookaroo</title>
  //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
  //     <link rel="preconnect" href="https://fonts.googleapis.com">
  //     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  //     <link rel="preconnect" href="https://fonts.googleapis.com">
  //     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  //     <link
  //         href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
  //         rel="stylesheet">

  //     <style>
  //         @media (max-width:767px) {
  //             .w-100 {
  //                 width: 100%;
  //             }

  //             .fz-20 {
  //                 font-size: 25px !important;
  //             }
  //         }
  //     </style>

  // </head>

  // <body style="font-family: 'Poppins', sans-serif; background:#fff;">
  //     <table width="100%" cellpadding:"0" cellspacing="0">
  //         <tbody>
  //             <tr>
  //                 <td style="padding: 50px 20px;">
  //                     <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
  //                     ;"
  //                         class="w-100">

  //                        <tr>
  //                             <td style="height:40px;">

  //                             </td>
  //                         </tr>

  //                         <tr>
  //                             <td style="text-align:center; padding-bottom: 10px; height: 50px;">
  //                                 <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
  //                                 style="width: 120px; margin: 0 auto;" />
  //                             </td>
  //                         </tr>
  //                         <tr>
  //                             <td style="padding: 20px 60px;">
  //                                 <table width="100%;cellpadding:"0" cellspacing="0" ">
  //                                     <tr>
  //                                         <td style="border-bottom: 1px solid
  //                             #E2E8F0; ">

  //                             </td>
  //                                     </tr>
  //                                 </table>
  //                             </td>
  //                         </tr>
  //                         <tr>
  //                             <td style="text-align:center; padding-bottom: 10px; ">
  //                                 <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
  //                                 style="width: 340px; margin: 0 auto;" />
  //                             </td>
  //                         </tr>
  //                         <tr>
  //                             <td style="padding: 20px 60px;">
  //                                 <table width="100%;cellpadding:"0" cellspacing="0" ">
  //                                     <tr>
  //                                         <td style="border-bottom: 1px solid
  //                             #E2E8F0; ">

  //                             </td>
  //                                     </tr>
  //                                 </table>
  //                             </td>
  //                         </tr>
  //                         <tr>
  //                             <td style="text-align:center;">
  //                                 <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
  //                                     class="fz-20">Hi ${fullName},
  //                                 </p>
  //                             </td>
  //                         </tr>
  //                         <tr>
  //                             <td style="padding: 15px 0 25px 0;">
  //                                 <p
  //                                     style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
  //                                     Thank's for registering on our platform.Please verify the email using this otp.
  //                                 </p>
  //                             </td>
  //                         </tr>
  //                         <tr>
  //                                                  <td style="display: flex; justify-content: center; gap: 10px;">

  //         <a
  //           style="
  //                             font-size: 14px;
  //                             padding: 14px 30px;
  //                        text-align:center;
  //                        margin:0 auto;
  //                             background: #976DD0!important;
  //                             cursor: pointer;
  //                             border: none;
  //                             color: #fff;
  //                             display:inline-block;
  //                             border-radius:5px;
  //                           "
  //         >
  //          ${options.otp}
  //         </a>
  //       </td>
  //                         </tr>

  //                         <tr>
  //                             <td style="height:60px;">

  //                             </td>
  //                         </tr>

  //                     </table>
  //                 </td>
  //             </tr>
  //         </tbody>
  //     </table>
  // </body>

  // </html>
  // `;

  let message1;

  message1 += `
<!DOCTYPE html>
<html>
<head>
  <title>Bookaroo</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media (max-width:767px) {
      .w-100 { width: 100% !important; }
      .fz-20 { font-size: 25px !important; }
    }
  </style>
</head>
<body style="font-family: 'Poppins', sans-serif; background:#fff; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding: 50px 20px;">
        <table width="676" cellpadding="0" cellspacing="0" border="0" align="center" style="background:#F2F5FF;" class="w-100">
          <tr><td style="height:40px;"></td></tr>
          
          <tr>
            <td style="text-align:center; padding-bottom:10px;">
              <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width:120px;" alt="Logo"/>
            </td>
          </tr>
          
          <tr>
            <td style="padding:20px 60px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-bottom:1px solid #E2E8F0;"></td></tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="text-align:center; padding-bottom:10px;">
              <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width:340px;" alt="Banner"/>
            </td>
          </tr>
          
          <tr>
            <td style="padding:20px 60px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-bottom:1px solid #E2E8F0;"></td></tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="text-align:center;">
              <p style="font-size:22px; max-width:400px; margin:0 auto; font-weight:600; padding:0 20px; color:#976dd0; line-height:24px;" class="fz-20">
                Hi ${fullName},
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding:15px 0 25px 0;">
              <p style="font-size:16px; max-width:400px; margin:0 auto; text-align:center; color:#6D6D6D; line-height:25px; padding:0 20px;">
                Thanks for registering on our platform. Please verify your email using this OTP:
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="text-align:center;">
              <span style="font-size:14px; padding:14px 30px; background:#976DD0; color:#fff; border-radius:5px; display:inline-block;">
                ${options.otp}
              </span>
            </td>
          </tr>
          
          <tr><td style="height:60px;"></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>

`;

  // SmtpController.sendEmail(email, "Email Verification", message1);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Email Verification",
    htmlContent: message1,
  });
};
const DocumentVerifyLink = async (options) => {
  adminEmail = options.adminEmail;
  let message = "";

  message += `
  <!DOCTYPE html>
  <html
    lang="en"
    xmlns="http://www.w3.org/1999/xhtml"
    xmlns:o="urn:schemas-microsoft-com:office:office"
  >
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <title></title>
  
      <style>
        table,
        td,
        div,
        h1,
        p {
          font-family: Arial, sans-serif;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0">
      <table
        role="presentation"
        style="
          width: 100%;
          border-collapse: collapse;
          border: 0;
          border-spacing: 0;
          background: #ffffff;
          margin: 20px 0px;
        "
      >
        <tr>
          <td align="center" style="padding: 0">
            <table
              role="presentation"
              style="
                width: 700px;
                border-collapse: collapse;
                border: 1px solid #cccccc;
                border-spacing: 0;
                text-align: left;
              "
            >
              <tr>
              <div style="padding: 40px; ">
                  <td style="text-align: center">
                      <div style="padding: 40px 0px 0px 0px;">
                          <img src="/images/logo.png" style="
                            width: 165px;
                            object-fit: cover;
                            height: auto;" />
                      </div>
                                    </td>
              </div>
              </tr>
              <tr>
              <div style="padding: 0px 40px; ">
              
                  <td align="center" style="padding: 20px 40px 30px 40px; color: #fff">
                      <div style="text-align: center; padding-top: 40px;border-top: 1px solid #80808063;">  </div>
                      <img src="/images/forget.png" style="    max-width: 220px;
                      height: auto;
                      object-fit: cover;
                      width: 100%;">                
                    </div>
              </tr>
              <tr>
                <td style="padding: 0px 30px 42px 30px">
                  <table
                    role="presentation"
                    style="
                      width: 100%;
                      border-collapse: collapse;
                      border: 0;
                      border-spacing: 0;
                    "
                  >
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;">  <h2 style="    color: #1e429f;
                          font-size: 26px; margin: 0;">Verify Venue Documents?</h2>
                        
                          </div>
                          <p
                            style="
                              font-size: 18px;
                              line-height: 30px;
                              text-align: center;
                            "
                          >
                         New Venue registered on platform .
                         <span style="display: block;"> Click the below button to verify venue document.  </span>
                       
                          </p>
                        </div>
                      </td>
  
  </tr>
  
                    <tr>
                      
 
     <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${ADMIN_WEB_URL}/login"
          style="
                            font-size: 18px;
                            padding: 18px 40px;
                       
                            background: #1e429f;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                          "
        >
          Verify Venue Document
        </a>
      </td>
  </tr>
   
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  // SmtpController.sendEmail(adminEmail, " Document Verification", message);
  sendEmail({
    module: "auth",
    to: adminEmail,
    subject: "Document Verification",
    htmlContent: message,
  });
};
const updatePasswordEmail = (options) => {
  let email = options.email;
  let fullName = options.fullName;
  userId = options.userId;

  if (!fullName) {
    fullName = email;
  }
  let message = "";

  message += `
  <!DOCTYPE html>
  <html>
  
  <head>
      <title>MARC</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet">
  
      <style>
          @media (max-width:767px) {
              .w-100 {
                  width: 100%;
              }
  
              .fz-20 {
                  font-size: 25px !important;
              }
          }
      </style>
  
  </head>
  
  <body style="font-family: 'Poppins', sans-serif; background:#fff;">
      <table width="100%" cellpadding:"0" cellspacing="0">
          <tbody>
              <tr>
                  <td style="padding: 50px 20px;">
                      <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                      ;"
                          class="w-100">
                          <tr>
                              <td style="height:40px;">
  
                              </td>
                          </tr>
                     
                          <tr>
                              <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                  <img src="${BACK_WEB_URL}/static/logo.png"
                                  style="width: 120px; margin: 0 auto;" />
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 20px 60px;">
                                  <table width="100%;cellpadding:"0" cellspacing="0" ">
                                      <tr>
                                          <td style="border-bottom: 1px solid 
                              #E2E8F0; ">
  
                              </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td style="text-align:center; padding-bottom: 10px; ">
                                  <img src="${BACK_WEB_URL}/static/banner.png"
                                  style="width: 340px; margin: 0 auto;" />
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 20px 60px;">
                                  <table width="100%;cellpadding:"0" cellspacing="0" ">
                                      <tr>
                                          <td style="border-bottom: 1px solid 
                              #E2E8F0; ">
  
                              </td>
                                      </tr>
                                  </table>
                              </td>
                          </tr>
                          <tr>
                              <td style="text-align:center;">
                                  <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #384860; line-height: 24px;"
                                      class="fz-20">Hi ${options.fullName},
                                  </p>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 15px 0 25px 0;">
                                  <p
                                      style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                      Your updated password is <b> ${options.password}</b>
                                  </p>
                              </td>
                          </tr>
                          <tr>
                              <td>
                                  <a href="#"
                                      style="background: #3F559E
                              ; display:block;color:#fff;padding:12px 10px; width: 220px; margin: 0 auto 0; box-shadow: none; border: 0; font-size: 15px; text-decoration: none; font-weight: 400; text-align: center;">Verify your email address</a>
                              </td>
                          </tr>
  
  
  
                          <tr>
                              <td style="height:60px;">
  
                              </td>
                          </tr>
                         
                       
              
                     
                      </table>
                  </td>
              </tr>
          </tbody>
      </table>
  </body>
  
  </html>`;

  // SmtpController.sendEmail(email, "Password Update", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Password Update",
    htmlContent: message,
  });
};

const verificationOtp = (options) => {
  let email = options.email;
  let fullName = options.firstName ? options.firstName : options.fullName;
  userId = options.userId;
  let deviceToken = options.deviceToken;
  let deviceId = options.deviceId;
  if (!fullName) {
    fullName = email;
  }
  let message = "";

  message += `
  <!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>

                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="images/logo.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="images/banner.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                    class="fz-20">Hi ${fullName},
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    Your otp for account verification is below here.
                                </p>
                            </td>
                        </tr>
                        <tr>
                                                 <td style="display: flex; justify-content: center; gap: 10px;">

        <a
          style="
                            font-size: 14px;
                            padding: 14px 30px;
                       text-align:center;
                       margin:0 auto;
                            background: #976DD0!important;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                            display:inline-block;
                            border-radius:5px;
                          "
        >
         ${options.otp}
        </a>
      </td>
                        </tr>



                        <tr>
                            <td style="height:60px;">

                            </td>
                        </tr>
                       
                     
            
                   
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
    ${deviceToken} ${deviceId}
</body>

</html>`;

  // SmtpController.sendEmail(email, "Verify otp", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Verify otp",
    htmlContent: message,
  });
};

const forgotPasswordEmailForUser = (options) => {
  let email = options.email;
  let fullName = options.firstName ? options.firstName : options.fullName;
  userId = options.userId;

  if (!fullName) {
    fullName = email;
  }
  let message = "";

  message += `
  <!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>

                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                    class="fz-20">Hi ${fullName},
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    You have requested to reset the password of your Bookaroo account.Please verify the otp to change the password.
                                </p>
                                <p style="text-align:center; font-size:15px;"><b style=" font-size:15px;">OTP :</b> ${options.verificationCode}</p>
                            </td>
                        </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
     
        <a href="${FRONT_WEB_URL}/reset-password?id=${options.id}&verificationCode=${options.verificationCode}"
          style="
                            font-size: 14px;
                            padding: 14px 30px;
                       text-align:center;
                       margin:0 auto;
                            background: #976DD0!important;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                            display:inline-block;
                            border-radius:5px;
                          "
        >
         Change Password
        </a>
      </td>
                        </tr>



                        <tr>
                            <td style="height:60px;">

                            </td>
                        </tr>
                       
                     
            
                   
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
`;

  // SmtpController.sendEmail(email, "Reset Password otp", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Reset Password otp",
    htmlContent: message,
  });
};

const ClaimVenueRequest = async (options) => {
  email = options.email;
  venueId = options.venueId;
  venueEmail = options.venueEmail;
  venueName = options.venueName;
  venueAddress = options.venueAddress;
  let message = "";

  message += `
  <!DOCTYPE html>
  <html
    lang="en"
    xmlns="http://www.w3.org/1999/xhtml"
    xmlns:o="urn:schemas-microsoft-com:office:office"
  >
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <title></title>
  
      <style>
        table,
        td,
        div,
        h1,
        p {
          font-family: Arial, sans-serif;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0">
      <table
        role="presentation"
        style="
          width: 100%;
          border-collapse: collapse;
          border: 0;
          border-spacing: 0;
          background: #ffffff;
          margin: 20px 0px;
        "
      >
        <tr>
          <td align="center" style="padding: 0">
            <table
              role="presentation"
              style="
                width: 700px;
                border-collapse: collapse;
                border: 1px solid #cccccc;
                border-spacing: 0;
                text-align: left;
              "
            >
              <tr>
              <div style="padding: 40px; ">
                  <td style="text-align: center">
                      <div style="padding: 40px 0px 0px 0px;">
                          <img src="/images/logo.png" style="
                            width: 165px;
                            object-fit: cover;
                            height: auto;" />
                      </div>
                                    </td>
              </div>
              </tr>
              <tr>
              <div style="padding: 0px 40px; ">
              
                  <td align="center" style="padding: 20px 40px 30px 40px; color: #fff">
                      <div style="text-align: center; padding-top: 40px;border-top: 1px solid #80808063;">  </div>
                      <img src="/images/forget.png" style="    max-width: 220px;
                      height: auto;
                      object-fit: cover;
                      width: 100%;">                
                    </div>
              </tr>
              <tr>
                <td style="padding: 0px 30px 42px 30px">
                  <table
                    role="presentation"
                    style="
                      width: 100%;
                      border-collapse: collapse;
                      border: 0;
                      border-spacing: 0;
                    "
                  >
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;">  <h2 style="    color: #1e429f;
                          font-size: 26px; margin: 0;"> Request to Claim Venue</h2>
                        
                          </div>
                          <p  
                            style="
                              font-size: 18px;
                              line-height: 30px;
                              text-align: center;
                            "
                          >
                        Venue Name : ${venueName} <br></br> Address : ${venueAddress}.<br></br> It appears that the venue is currently registered under another account.
                         <span style="display: block;">I am requesting you to provide credential of venue. </span>
                       
                          </p>
                        </div>
                      </td>
  
  </tr>
  
                    <tr>
                      
 
     <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${ADMIN_WEB_URL}/login"
          style="
                            font-size: 18px;
                            padding: 18px 40px;
                       
                            background: #1e429f;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                          "
        >
          Verify Venue
        </a>
      </td>
  </tr>
   
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  // SmtpController.sendEmail(email, "Request To Claim Venue", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Request To Claim Venue",
    htmlContent: message,
  });
};
const sendCredential = async (options) => {
  email = options.email;
  password = options.password;
  type = options.type;
  let message = "";

  message += `
  <!DOCTYPE html>
  <html
    lang="en"
    xmlns="http://www.w3.org/1999/xhtml"
    xmlns:o="urn:schemas-microsoft-com:office:office"
  >
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <title></title>
  
      <style>
        table,
        td,
        div,
        h1,
        p {
          font-family: Arial, sans-serif;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0">
      <table
        role="presentation"
        style="
          width: 100%;
          border-collapse: collapse;
          border: 0;
          border-spacing: 0;
          background: #ffffff;
          margin: 20px 0px;
        "
      >
        <tr>
          <td align="center" style="padding: 0">
            <table
              role="presentation"
              style="
                width: 700px;
                border-collapse: collapse;
                border: 1px solid #cccccc;
                border-spacing: 0;
                text-align: left;
              "
            >
              <tr>
              <div style="padding: 40px; ">
                  <td style="text-align: center">
                      <div style="padding: 40px 0px 0px 0px;">
                          <img src="/images/logo.png" style="
                            width: 165px;
                            object-fit: cover;
                            height: auto;" />
                      </div>
                                    </td>
              </div>
              </tr>
              <tr>
              <div style="padding: 0px 40px; ">
              
                  <td align="center" style="padding: 20px 40px 30px 40px; color: #fff">
                      <div style="text-align: center; padding-top: 40px;border-top: 1px solid #80808063;">  </div>
                      <img src="/images/forget.png" style="    max-width: 220px;
                      height: auto;
                      object-fit: cover;
                      width: 100%;">                
                    </div>
              </tr>
              <tr>
                <td style="padding: 0px 30px 42px 30px">
                  <table
                    role="presentation"
                    style="
                      width: 100%;
                      border-collapse: collapse;
                      border: 0;
                      border-spacing: 0;
                    "
                  >
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;">  <h2 style="    color: #1e429f;
                          font-size: 26px; margin: 0;">Confirmation Mail</h2>
                        
                          </div>`;
  if (type == "verify") {
    message += `
                           <p  
                            style="
                              font-size: 18px;
                              line-height: 30px;
                              text-align: center;
                            "
                          >
                       Your venue claim request is accepted successfully. Your login credential are given below. <br></br>
                       Email : ${email} <br></br>
                       Password : ${password} <br></br>
                         <span style="display: block;">Please login to your account by clicking the below button </span>
                       
                          </p>`;
  } else {
    message += `<p  
    style="
      font-size: 18px;
      line-height: 30px;
      text-align: center;
    "
  >
Your venue claim request is rejected  <br></br>
  </p>`;
  }
  `</div>
                      </td>
  
  </tr>`;

  if (type == "verify") {
    message += `
                <tr>
                      
 
     <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${FRONT_WEB_URL}/signin"
          style="
                            font-size: 18px;
                            padding: 18px 40px;
                       
                            background: #1e429f;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                          "
        >
          Login To Your Account
        </a>
      </td>
  </tr>`;
  } else {
    message += ``;
  }

  `</table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  // SmtpController.sendEmail(email, "Confirmation Mail", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Confirmation Mail",
    htmlContent: message,
  });
};
const sendVerificationMail = async (options) => {
  email = options.email;
  password = options.password;
  type = options.type;
  let message = "";

  message += `
  <!DOCTYPE html>
  <html
    lang="en"
    xmlns="http://www.w3.org/1999/xhtml"
    xmlns:o="urn:schemas-microsoft-com:office:office"
  >
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <title></title>
  
      <style>
        table,
        td,
        div,
        h1,
        p {
          font-family: Arial, sans-serif;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0">
      <table
        role="presentation"
        style="
          width: 100%;
          border-collapse: collapse;
          border: 0;
          border-spacing: 0;
          background: #ffffff;
          margin: 20px 0px;
        "
      >
        <tr>
          <td align="center" style="padding: 0">
            <table
              role="presentation"
              style="
                width: 700px;
                border-collapse: collapse;
                border: 1px solid #cccccc;
                border-spacing: 0;
                text-align: left;
              "
            >
              <tr>
              <div style="padding: 40px; ">
                  <td style="text-align: center">
                      <div style="padding: 40px 0px 0px 0px;">
                          <img src="/images/logo.png" style="
                            width: 165px;
                            object-fit: cover;
                            height: auto;" />
                      </div>
                                    </td>
              </div>
              </tr>
              <tr>
              <div style="padding: 0px 40px; ">
              
                  <td align="center" style="padding: 20px 40px 30px 40px; color: #fff">
                      <div style="text-align: center; padding-top: 40px;border-top: 1px solid #80808063;">  </div>
                      <img src="/images/forget.png" style="    max-width: 220px;
                      height: auto;
                      object-fit: cover;
                      width: 100%;">                
                    </div>
              </tr>
              <tr>
                <td style="padding: 0px 30px 42px 30px">
                  <table
                    role="presentation"
                    style="
                      width: 100%;
                      border-collapse: collapse;
                      border: 0;
                      border-spacing: 0;
                    "
                  >
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;">  <h2 style="    color: #1e429f;
                          font-size: 26px; margin: 0;">Confirmation Mail</h2>
                        
                          </div>`;
  if (type == "verify") {
    message += `
                           <p  
                            style="
                              font-size: 18px;
                              line-height: 30px;
                              text-align: center;
                            "
                          >
                       Your venue documents are verified successfully by admin. <br></br>
                    
                       
                       
                          </p>`;
  } else {
    message += `<p  
    style="
      font-size: 18px;
      line-height: 30px;
      text-align: center;
    "
  >
Your venue documents are rejected by admin .<br></br>
  </p>`;
  }
  `</div>
                      </td>
  
  </tr>`;

  if (type == "verify") {
    message += `<tr>
                      
 
     <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${FRONT_WEB_URL}/signin"
          style="
                            font-size: 18px;
                            padding: 18px 40px;
                       
                            background: #1e429f;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                          "
        >
          Login To Your Account
        </a>
      </td>
  </tr>
      `;
  } else {
    message += ``;
  }

  `</table >
                </td >
              </tr >
            </table >
          </td >
        </tr >
      </table > "
    </body >
  </html >
  `;

  // SmtpController.sendEmail(email, "Confirmation Mail", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Confirmation Mail",
    htmlContent: message,
  });
};

const loginCredentialEmail = (options) => {
  let email = options.email;
  let fullName = options.fullName;
  let password = options.password;
  let roleName = options.role;

  if (!fullName) {
    fullName = email;
  }
  let message = "";
  message += `
 <!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding:"0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding:"0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF
                    ;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;">

                            </td>
                        </tr>

                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; ">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%;cellpadding:"0" cellspacing="0" ">
                                    <tr>
                                        <td style="border-bottom: 1px solid
                            #E2E8F0; ">

                            </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #384860; line-height: 24px;"
                                    class="fz-20">Hi ${fullName},
                                </p>
                            </td>
                        </tr>
                    <tr>
  <td>
                        <div style="margin-bottom: 30px; border-radius: 5px">
                        <div style="text-align: center; padding-top: 30px;"> `;
  if (roleName == "agency") {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Your agency account is ready!</h2>
                          `;
  } else if (roleName == "staff") {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Your staff account is ready!</h2> `;
  } else {
    message += ` <h2 style="    color: #976dd0!important;
                          font-size: 26px; margin: 0;"> Congratulations!</h2> `;
  }

  message += `</div>
                          <p  
                            style="
                              font-size: 16px;
                              line-height: 20px;
                              text-align: center;
                              margin-bottom:0;
                            "
                          >
                       
                         <span style="display: block; text-align:center; font-size:15px; padding:0 20px; margin-bottom:2px; color:#2d2b2b;">  Your ${roleName} account has been set up in the Bookaroo Administrator.</span>
                        <div style = "text-align:center;" >
                         <p style="font-size:15px; margin-bottom:5px; margin:0 auto; text-align:center; color:#2d2b2b;">Please use the following credentials to log in:</p>
                       <div>
                        <p style="text-align:center; font-size:15px; margin-bottom:7px;"> <b style=" font-size:15px;">Email :</b> ${email} </p>
                         <p style="text-align:center; font-size:15px;"><b style=" font-size:15px;">Password :</b> ${password}</p>
                       </div>
                        </div>
                       
                          </p>
                        </div>
                      </td>
  
  </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
        <a
          href="${FRONT_WEB_URL}/login"
          style="
                            font-size: 14px;
                            padding: 14px 30px;
                       text-align:center;
                       margin:0 auto;
                            background: #976DD0!important;
                            cursor: pointer;
                            border: none;
                            color: #fff;
                            display:inline-block;
                            border-radius:5px;
                          "
        >
          Login To Your Account
        </a>
      </td>
                        </tr>



                        <tr>
                            <td style="height:60px;">

                            </td>
                        </tr>




                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>`;

  // SmtpController.sendEmail(email, `Registeration`, message);
  sendEmail({
    module: "AUTH",
    to: email,
    subject: "Registeration",
    htmlContent: message,
    // templateId:
  });
};
const SendPersonalDataIndividual = (options) => {
  let firstName = options.firstName;
  let lastName = options.lastName;
  let email = options.email;
  let images = options.images;
  let city = options.city;
  let street = options.street;
  let state = options.state;
  let country = options.country;
  let pinCode = options.pinCode;
  let mobileNo = options.mobileNo;
  let username = options.username;
  let message = "";

  const addressParts = [street, city, state, country, pinCode].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  message = `
   <!DOCTYPE html>
   <html>
   <head>
       <title>Bookaroo - Personal Information</title>
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
       <style>
           @media (max-width: 767px) {
               .w-100 { width: 100%; }
               .fz-20 { font-size: 25px !important; }
           }
       </style>
   </head>
   
   <body style="font-family: 'Poppins', sans-serif; background: #fff;">
       <table width="100%" cellpadding="0" cellspacing="0">
           <tr>
               <td style="padding: 50px 20px;">
                   <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #F2F5FF;" class="w-100">
                       <tr><td style="height: 40px;"></td></tr>
                       
                       <tr>
                           <td style="text-align: center; padding-bottom: 10px;">
                               <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 120px; margin: 0 auto;" alt="Bookaroo Logo"/>
                           </td>
                       </tr>
   
                       <tr><td style="padding: 0 60px;"><hr style="border: none; border-top: 1px solid #E2E8F0;"></td></tr>
   
                       <tr>
                           <td style="text-align: center; padding: 20px 0;">
                               <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width: 340px; margin: 0 auto;" alt="Bookaroo Banner"/>
                           </td>
                       </tr>
   
                       <tr><td style="padding: 0 60px;"><hr style="border: none; border-top: 1px solid #E2E8F0;"></td></tr>
   
                       <tr>
                           <td style="text-align: center;">
                               <p class="fz-20" style="font-size: 22px; font-weight: 600; color: #976DD0; margin: 20px 0;">Hi ${firstName},</p>
                           </td>
                       </tr>
   
                       <tr>
                           <td style="padding: 15px 20px;">
                               <p style="font-size: 16px; color: #6D6D6D; text-align: center; line-height: 25px; max-width: 500px; margin: 0 auto;">
                                   As requested, here are your personal details registered with your Bookaroo account.
                               </p>
                           </td>
                       </tr>
   
                       <tr>
                           <td style="padding: 20px 40px;">
                               <table width="100%" style="font-size: 15px; color: #333; line-height: 24px;">
                                   <tr><td><strong>Full Name:</strong> ${firstName} ${lastName}</td></tr>
                                   <tr><td><strong>Username:</strong> ${username}</td></tr>
                                   <tr><td><strong>Email:</strong> ${email}</td></tr>
                                    ${mobileNo ? `<tr><td><strong>Mobile Number:</strong> ${mobileNo}</td></tr>` : ""}
                                ${fullAddress ? `<tr><td><strong>Address:</strong> ${fullAddress}</td></tr>` : ""}
                               </table>
                           </td>
                       </tr>
   
                      
                        <tr>
                            <td style="padding: 20px 40px; text-align: center;">
                                <p style="font-size: 14px; color: #999;">
                                    Thank you for being a valued member of Bookaroo!
                                </p>
                            </td>
                        </tr>
    
                        <tr>
                            <td style="height: 40px;"></td>
                        </tr>
                   </table>
               </td>
           </tr>
       </table>
   </body>
   </html>
   `;

  // SmtpController.sendEmail(email, "Personal Information Mail", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Personal Information Mail",
    htmlContent: message,
  });
};

const SendPersonalDataPro = (options) => {
  let firstName = options.firstName;
  let lastName = options.lastName;
  let email = options.email;
  let images = options.images;
  let city = options.city;
  let street = options.street;
  let state = options.state;
  let country = options.country;
  let pinCode = options.pinCode;
  let mobileNo = options.mobileNo;
  let username = options.username;
  let companyRole = options.companyRole;
  let companyName = options.companyName;
  let companyEmail = options.companyEmail;
  let companyContactNumber = options.companyContactNumber;
  let website = options.website;
  let coverImage = options.coverImage;
  let companyLogo = options.companyLogo;

  let message = "";
  message = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Personal Information - Bookaroo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @media (max-width:767px) {
                .w-100 { width: 100%; }
                .fz-20 { font-size: 22px !important; }
            }
        </style>
    </head>
    <body style="font-family: 'Poppins', sans-serif; background-color: #fff; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" align="center" cellpadding="0" cellspacing="0" style="background-color: #F2F5FF;" class="w-100">
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 40px;">
                                <h2 style="text-align: center; color: #976DD0; font-size: 24px;">Hello ${firstName} ${lastName},</h2>
                                <p style="text-align: center; color: #6D6D6D; font-size: 16px; line-height: 24px;">
                                    Please find below your personal information associated with your Pro account at Bookaroo.
                                </p>
                            </td>
                        </tr>
    
                        <tr>
                            <td style="padding: 0 40px;">
                                <table width="100%" style="font-size: 14px; color: #333;">
                                    <tr><td><strong>Username:</strong> ${username || "-"}</td></tr>
                                    <tr><td><strong>Email:</strong> ${email || "-"}</td></tr>
                                    <tr><td><strong>Mobile Number:</strong> ${mobileNo || "-"}</td></tr>
                                    <tr><td><strong>Address:</strong> ${street || ""}, ${city || ""}, ${state || ""}, ${country || ""} - ${pinCode || ""}</td></tr>
                                    <tr><td><strong>Company Name:</strong> ${companyName || "-"}</td></tr>
                                    <tr><td><strong>Company Role:</strong> ${companyRole || "-"}</td></tr>
                                    <tr><td><strong>Company Email:</strong> ${companyEmail || "-"}</td></tr>
                                    <tr><td><strong>Company Contact Number:</strong> ${companyContactNumber || "-"}</td></tr>
                                    <tr><td><strong>Website:</strong> <a href="${website}" style="color: #976DD0;">${website || "-"}</a></td></tr>
                                </table>
                            </td>
                        </tr>
    
                        ${
                          companyLogo || coverImage
                            ? `
                        <tr>
                            <td style="padding: 20px 40px; text-align: center;">
                                ${companyLogo ? `<img src="${companyLogo}" alt="Company Logo" style="max-width: 150px; margin-bottom: 10px;" />` : ""}
                                ${coverImage ? `<img src="${coverImage}" alt="Cover Image" style="max-width: 100%; margin-top: 10px;" />` : ""}
                            </td>
                        </tr>
                        `
                            : ""
                        }
    
                        <tr>
                            <td style="padding: 20px 40px; text-align: center;">
                                <p style="font-size: 14px; color: #999;">
                                    Thank you for being a valued member of Bookaroo!
                                </p>
                            </td>
                        </tr>
    
                        <tr>
                            <td style="height: 40px;"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

  // SmtpController.sendEmail(email, "Personal Information Mail", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Personal Information Mail",
    htmlContent: message,
  });
};

const existingUserShare = (options) => {
  let email = options.email;
  let senderName = options.name;
  let userId = options.userId;
  let propertyLink = options.propertyLink;
  let propertyId = options.propertyId;
  let message = "";

  message += `
    <!DOCTYPE html>
    <html>
    
    <head>
        <title>Bookaroo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link
            href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
            rel="stylesheet">
    
        <style>
            @media (max-width:767px) {
                .w-100 {
                    width: 100%;
                }
                .fz-20 {
                    font-size: 25px !important;
                }
                .property-btn {
                    width: 100% !important;
                    padding: 12px 0 !important;
                }
            }
        </style>
    </head>
    
    <body style="font-family: 'Poppins', sans-serif; background:#fff;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tbody>
                <tr>
                    <td style="padding: 40px 20px;">
                        <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
                            <tr>
                                <td style="text-align:center; padding: 40px 0 20px 0;">
                                    <img src="images/logo.png" style="width: 120px; margin: 0 auto;" />
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="text-align:center; padding-bottom: 20px;">
                                    <img src="images/banner.png" style="width: 340px; margin: 0 auto;" />
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="text-align:center;">
                                    <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;">
                                        ${senderName} shared a property with you
                                    </p>
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="padding: 15px 0 30px 0;">
                                    <p style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                        Click below to view the property details:
                                    </p>
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="text-align:center; padding-bottom: 30px;">
                                    <a href="${propertyLink}" 
                                       style="font-size: 16px; 
                                              padding: 14px 40px;
                                              background: #976DD0;
                                              cursor: pointer;
                                              border: none;
                                              color: #fff;
                                              display: inline-block;
                                              border-radius: 5px;
                                              text-decoration: none;
                                              font-weight: 500;"
                                       class="property-btn">
                                        View Property
                                    </a>
                                </td>
                            </tr>
                            
                            <tr>
                                <td style="padding: 0 0 40px 0; text-align:center;">
                                    <p style="font-size:13px; color: #A0A0A0; max-width: 400px; margin:0 auto;">
                                        You're receiving this email because ${senderName} wants you to see this property.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    </body>
    </html>`;

  // SmtpController.sendEmail(email, "A property has been shared with you", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "A property has been shared with you",
    htmlContent: message,
  });
};

const nonExistingUserShare = async (options) => {
  let email = options.email;
  let senderName = options.name;
  let userId = options.userId;
  let propertyLink = options.propertyLink;
  let propertyId = options.propertyId;
  let signUpLink = options.signUpLink;
  let message = "";

  message += `
<!DOCTYPE html>
<html>
<head>
    <title>Property Shared with You</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; background:#ffffff; font-family: Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:20px;">

<!-- Main Container -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#F2F5FF;">
    
    <!-- Top Spacer -->
    <tr>
        <td height="40"></td>
    </tr>

    <!-- Logo -->
    <tr>
        <td align="center">
            <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" width="120" style="display:block;" />
        </td>
    </tr>

    <!-- Divider -->
    <tr>
        <td align="center" style="padding:20px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="border-bottom:1px solid #E2E8F0;"></td>
                </tr>
            </table>
        </td>
    </tr>

    <!-- Banner -->
    <tr>
        <td align="center">
            <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" width="340" style="display:block; max-width:100%;" />
        </td>
    </tr>

    <!-- Divider -->
    <tr>
        <td align="center" style="padding:20px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="border-bottom:1px solid #E2E8F0;"></td>
                </tr>
            </table>
        </td>
    </tr>

    <!-- Content -->
    <tr>
        <td align="center" style="padding:20px 30px;">
            <h2 style="color:#976DD0; font-size:22px; margin:0 0 15px 0;">Hello,</h2>

            <p style="color:#6D6D6D; font-size:16px; line-height:24px; margin:0 0 15px 0;">
                <strong>${senderName}</strong> has shared a property with you, but it looks like you're not registered on our platform yet.
            </p>

            <p style="color:#6D6D6D; font-size:16px; line-height:24px; margin:0;">
                To view the shared property, sign up first by clicking the button below.
                Once registered, you can explore the property details shared with you.
            </p>
        </td>
    </tr>

    <!-- Sign Up Button -->
    <tr>
        <td align="center" style="padding:20px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td align="center" bgcolor="#976DD0" style="border-radius:5px;">
                        <a href="${signUpLink}"
                           target="_blank"
                           style="display:inline-block; padding:14px 30px; font-size:16px; color:#ffffff; text-decoration:none; border-radius:5px;">
                            Sign Up Now
                        </a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>

    <!-- View Property Button (Fixed) -->
    <tr>
        <td align="center" style="padding:10px 0 20px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td align="center" bgcolor="#5A67D8" style="border-radius:5px;">
                        <a href="${propertyLink}"
                           target="_blank"
                           style="display:inline-block; padding:12px 26px; font-size:15px; color:#ffffff; text-decoration:none; border-radius:5px;">
                            View Property
                        </a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>

    <!-- Footer Text -->
    <tr>
        <td align="center" style="padding:10px 30px 20px 30px;">
            <p style="color:#999999; font-size:14px; margin:0;">
                If you didn’t expect this email, you can safely ignore it.
            </p>
        </td>
    </tr>

</table>
<!-- End Main Container -->

</td>
</tr>
</table>

</body>
</html>
`;

  // SmtpController.sendEmail(email, "A property has been shared with you", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "A property has been shared with you",
    htmlContent: message,
  });
};

const interestUpdateEmail = async (options) => {
  const {
    buyerName,
    price,
    ownerName,
    type,
    propertyTitle,
    email,
    propertyLink,
    buyerPrice,
    ownerPrice,
  } = options;

  let primaryMessage = "";
  let mainMessage = "";
  let secondaryMessage =
    "Vous pouvez toujours consulter la propriété pour voir plus de détails et suivre les dernières mises à jour.";

  let emailSubject = "";
  let previewText = "";

  switch (type) {
    case "funnelOfferAccepted":
      primaryMessage = "Offre acceptée";

      mainMessage = `Excellente nouvelle ! ${ownerName} a accepté l'offre de ${buyerName} pour le bien "${propertyTitle}" au prix de ${price}$.`;

      emailSubject = "Offre acceptée - Bookaroo";

      previewText = `Votre offre pour ${propertyTitle} a été acceptée.`;

      break;

    case "funnelOfferRefused":
      primaryMessage = "Offre refusée";

      mainMessage = `Nous sommes désolés de vous informer que ${ownerName} a refusé l'offre de ${buyerName} pour le bien "${propertyTitle}" au prix proposé de ${price}$.`;

      emailSubject = "Offre refusée - Bookaroo";

      previewText = `Votre offre pour ${propertyTitle} a été refusée.`;

      break;

    case "funnelApplicationAccepted":
      primaryMessage = "Candidature acceptée";

      mainMessage = `Félicitations ! ${ownerName} a accepté la candidature de ${buyerName} pour le bien "${propertyTitle}".`;

      emailSubject = "Candidature acceptée - Bookaroo";

      previewText = `Votre candidature pour ${propertyTitle} a été acceptée.`;

      break;

    case "funnelApplicationRefused":
      primaryMessage = "Candidature refusée";

      mainMessage = `Nous sommes désolés de vous informer que ${ownerName} a refusé la candidature de ${buyerName} pour le bien "${propertyTitle}".`;

      emailSubject = "Candidature refusée - Bookaroo";

      previewText = `Votre candidature pour ${propertyTitle} a été refusée.`;

      break;

    case "funnelReviewSubmitted":
      primaryMessage = "Nouvel avis soumis";

      mainMessage = `${buyerName} a soumis un avis pour le bien "${propertyTitle}". Vous pouvez consulter les détails et les commentaires depuis votre tableau de bord.`;

      emailSubject = "Nouvel avis reçu - Bookaroo";

      previewText = `Un nouvel avis a été soumis pour ${propertyTitle}.`;

      break;

    case "visitInvitation":
      primaryMessage = "Invitation à visiter la propriété";

      mainMessage = `${buyerName} souhaite visiter votre propriété "${propertyTitle}". Veuillez consulter votre tableau de bord pour confirmer ou gérer cette demande de visite.`;

      emailSubject = "Invitation à visiter la propriété - Bookaroo";

      previewText = `Nouvelle demande de visite pour ${propertyTitle}.`;

      break;

    case "buyerRequestedDocument":
      primaryMessage = "Demande de documents";

      mainMessage = `${buyerName} a demandé les documents vendeur pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour gérer cette demande.`;

      emailSubject = "Demande de documents - Bookaroo";

      previewText = `Nouvelle demande de documents pour ${propertyTitle}.`;

      break;

    // case "ownerOfferSubmitted":

    // primaryMessage = "Offre soumise";

    // mainMessage = `${ownerName} a soumis une offre pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour examiner et gérer cette offre.`;

    // emailSubject = "Offre soumise - Bookaroo";

    // previewText = `Une nouvelle offre a été soumise pour ${propertyTitle}.`;

    // break;

    case "ownerOfferSubmitted":

        primaryMessage = "Offre soumise";

        mainMessage = `${ownerName} a soumis une offre pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour examiner et gérer cette offre.`;

        const ownerFundingTypeText = Array.isArray(buyerPrice?.fundingType)
            ? buyerPrice.fundingType.join(", ")
            : (buyerPrice?.fundingType || "-");

        const ownerConditionsText = Array.isArray(buyerPrice?.conditions)
            ? buyerPrice.conditions.join(", ")
            : (buyerPrice?.conditions || "-");

        secondaryMessage = `
            Détails de l'offre :
            - Montant : ${ownerPrice || buyerPrice?.amount || "-"}
            - Date de validité : ${buyerPrice?.validity_date || "-"}
            - Date d'emménagement : ${buyerPrice?.move_in || "-"}
            - Type de financement : ${ownerFundingTypeText}
            - Conditions suspensives : ${ownerConditionsText}
            `;

        emailSubject = "Offre soumise - Bookaroo";

        previewText = `Une nouvelle offre a été soumise pour ${propertyTitle}.`;

        break;

    case "preslotBookedByOwner":

    primaryMessage = "Créneau de pré-état des lieux réservé";

    mainMessage = `${ownerName} a réservé un créneau de pré-état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et suivre les dernières mises à jour.`;

    emailSubject = "Créneau de pré-état des lieux réservé - Bookaroo";

    previewText = `Un créneau de pré-état des lieux a été réservé pour ${propertyTitle}.`;

    break;

    case "signingDateBookedByOwner":

    primaryMessage = "Date de signature réservée";

    mainMessage = `${ownerName} a réservé une date de signature pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et suivre les dernières mises à jour.`;

    emailSubject = "Date de signature réservée - Bookaroo";

    previewText = `Une date de signature a été réservée pour ${propertyTitle}.`;

    break;
    
    case "ownerChangedSlot":
    primaryMessage = "Créneau modifié par le propriétaire";
    mainMessage = `${ownerName} a modifié le créneau de visite pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir le nouveau créneau.`;
    emailSubject = "Créneau de visite modifié - Bookaroo";
    previewText = `Le créneau de visite pour ${propertyTitle} a été modifié.`;
    break;
   
    case "visitHosted":
    primaryMessage = "Comment s'est passée votre visite ?";

    mainMessage = `Nous espérons que votre visite du bien "${propertyTitle}" s'est bien déroulée. Votre avis est précieux et aidera le propriétaire à améliorer sa présentation et sa stratégie.`;

    secondaryMessage = `Vous pouvez maintenant laisser un avis sur la visite, demander des documents complémentaires pour approfondir votre analyse, soumettre une offre ou informer le propriétaire si vous ne souhaitez pas poursuivre.`;

    emailSubject = "Votre visite est terminée - Quelle est la prochaine étape ?";

    previewText = `Donnez votre avis sur la visite et découvrez les prochaines étapes.`;

    break;

    case "documentSentByOwner":
    primaryMessage = "Documents envoyés par le propriétaire";
    mainMessage = `${ownerName} a envoyé les documents pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour les télécharger et les examiner.`;
    emailSubject = "Documents reçus - Bookaroo";
    previewText = `Les documents pour ${propertyTitle} ont été envoyés.`;
    break;

    case "offerRefusedByUser":
    primaryMessage = "Offre refusée par l'acheteur";
    mainMessage = `${buyerName} a refusé votre offre pour le bien "${propertyTitle}". Vous pouvez consulter votre tableau de bord pour plus de détails.`;
    emailSubject = "Offre refusée par l'acheteur - Bookaroo";
    previewText = `Votre offre pour ${propertyTitle} a été refusée.`;
    break;
    
    case "offerSent":
    primaryMessage = "Nouvelle offre reçue";
    mainMessage = `${buyerName} a envoyé une offre pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour examiner et répondre à cette offre.`;
    emailSubject = "Nouvelle offre reçue - Bookaroo";
    previewText = `Nouvelle offre reçue pour ${propertyTitle}.`;
    break;
    
    case "saleslotBookedByOwner":
        primaryMessage = "Nouvelle demande de créneau de vente";
        mainMessage = `${ownerName} a demandé un créneau de vente pour le bien "${propertyTitle}". Veuillez examiner la demande et confirmer votre disponibilité depuis votre tableau de bord.`;
        emailSubject = "Nouvelle demande de créneau de vente - Bookaroo";
        previewText = `Une nouvelle demande de créneau de vente a été soumise pour ${propertyTitle}.`;
        break;
// primaryMessage = "Créneau de vente réservé";
//     mainMessage = `${ownerName} a réservé un créneau de vente pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et confirmer votre disponibilité.`;
//     emailSubject = "Créneau de vente réservé - Bookaroo";
//     previewText = `Un créneau de vente a été réservé pour ${propertyTitle}.`;
//     break;
    case "requestToChangePresaleSlot":
        primaryMessage = "Demande de modification du créneau de pré-vente";
        mainMessage = `${buyerName} a demandé une modification du créneau de pré-vente pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour examiner et gérer cette demande.`;
        emailSubject = "Demande de modification du créneau - Bookaroo";
        previewText = `Demande de modification du créneau de pré-vente pour ${propertyTitle}.`;
        break;

    case "ownerChangedPresigningSlot":
        primaryMessage = "Créneau de pré-signature modifié";
        mainMessage = `${ownerName} a modifié le créneau de pré-signature pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir le nouveau créneau et confirmer votre disponibilité.`;
        emailSubject = "Créneau de pré-signature modifié - Bookaroo";
        previewText = `Le créneau de pré-signature pour ${propertyTitle} a été modifié.`;
        break;

    case "preslotAcceptByUser":
        primaryMessage = "Créneau de pré-état des lieux accepté";
        mainMessage = `${buyerName} a accepté le créneau de pré-état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et les prochaines étapes.`;
        emailSubject = "Créneau accepté - Bookaroo";
        previewText = `Le créneau de pré-état des lieux pour ${propertyTitle} a été accepté.`;
        break;
    
    case "preslotBookedByUser":
        primaryMessage = "Créneau de pré-état des lieux réservé par l'acheteur";
        mainMessage = `${buyerName} a réservé un créneau de pré-état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et confirmer votre disponibilité.`;
        emailSubject = "Créneau de pré-état des lieux réservé - Bookaroo";
        previewText = `${buyerName} a réservé un créneau de pré-état des lieux pour ${propertyTitle}.`;
        break;
    
    case "preslotAcceptByOwner":
        primaryMessage = "Créneau de pré-état des lieux accepté par le propriétaire";
        mainMessage = `${ownerName} a accepté le créneau de pré-état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et les prochaines étapes.`;
        emailSubject = "Créneau accepté par le propriétaire - Bookaroo";
        previewText = `${ownerName} a accepté le créneau de pré-état des lieux pour ${propertyTitle}.`;
        break;
   
    case "homeInventoryAcceptByUser":
        primaryMessage = "État des lieux accepté par l'acheteur";
        mainMessage = `${buyerName} a accepté l'état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails et les prochaines étapes.`;
        emailSubject = "État des lieux accepté - Bookaroo";
        previewText = `${buyerName} a accepté l'état des lieux pour ${propertyTitle}.`;
        break;
   
    case "requestToChangeHomeInventorySlot":
        primaryMessage = "Demande de modification du créneau d'état des lieux";
        mainMessage = `${buyerName} a demandé une modification du créneau d'état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour examiner et gérer cette demande.`;
        emailSubject = "Demande de modification du créneau d'état des lieux - Bookaroo";
        previewText = `${buyerName} a demandé une modification du créneau d'état des lieux pour ${propertyTitle}.`;
        break;
    
    case "visitAcceptByUser":
        primaryMessage = "Visite confirmée par l'acheteur";
        mainMessage = `${buyerName} a confirmé la visite pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour voir les détails.`;
        emailSubject = "Visite confirmée - Bookaroo";
        previewText = `${buyerName} a confirmé la visite pour ${propertyTitle}.`;
        break;

    case "offerSubmitByUser":
        primaryMessage = "Offre soumise par l'acheteur";
        mainMessage = `${buyerName} a soumis une offre pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour examiner et répondre à cette offre.`;
        emailSubject = "Nouvelle offre soumise - Bookaroo";
        previewText = `${buyerName} a soumis une offre pour ${propertyTitle}.`;
        break;

    case "offerSubmittedByUser":
        primaryMessage = "Offre envoyée";

        mainMessage = `${buyerName} a soumis une offre pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour l'examiner et y répondre.`;
        const fundingTypeText = Array.isArray(buyerPrice?.fundingType)
            ? buyerPrice.fundingType.join(", ")
            : (buyerPrice?.fundingType || "-");

        const conditionsText = Array.isArray(buyerPrice?.conditions)
            ? buyerPrice.conditions.join(", ")
            : (buyerPrice?.conditions || "-");

        secondaryMessage = `
            Détails de votre offre :
            - Montant : ${buyerPrice?.amount || "-"}
            - Date de validité : ${buyerPrice?.validity_date || "-"}
            - Date d'emménagement : ${buyerPrice?.move_in || "-"}
            - Type de financement : ${fundingTypeText}
            - Conditions suspensives : ${conditionsText}
            `;

        emailSubject = "Nouvelle offre soumise - Bookaroo";
        previewText = `${buyerName} a soumis une offre pour ${propertyTitle}.`;

        break;

    case "offerAcceptByUser":
        primaryMessage = "Offre acceptée par l'acheteur";
        mainMessage = `${buyerName} a accepté votre offre pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour les prochaines étapes.`;
        emailSubject = "Offre acceptée par l'acheteur - Bookaroo";
        previewText = `${buyerName} a accepté votre offre pour ${propertyTitle}.`;
        break;

    case "preslotOpenedByOwner":
        primaryMessage = "Créneau de pré-état des lieux ouvert";
        mainMessage = `${ownerName} a ouvert un créneau de pré-état des lieux pour le bien "${propertyTitle}". Veuillez consulter votre tableau de bord pour choisir votre créneau.`;
        emailSubject = "Créneau de pré-état des lieux disponible - Bookaroo";
        previewText = `Un créneau de pré-état des lieux est disponible pour ${propertyTitle}.`;
        break;

    case "saleslotAcceptedByUser":
        primaryMessage = "Créneau de vente accepté";
        mainMessage = `${buyerName} a accepté le créneau de vente proposé pour le bien "${propertyTitle}". Vous pouvez désormais poursuivre les prochaines étapes de la transaction.`;
        emailSubject = "Créneau de vente accepté - Bookaroo";
        previewText = `${buyerName} a accepté le créneau de vente pour ${propertyTitle}.`;
        break;

    case "saleslotAcceptedByOwner":
        primaryMessage = "Créneau de vente confirmé";
        mainMessage = `${ownerName} a accepté le créneau de vente pour le bien "${propertyTitle}". La transaction progresse et les deux parties peuvent se préparer à la prochaine étape.`;
        emailSubject = "Créneau de vente confirmé - Bookaroo";
        previewText = `${ownerName} a confirmé le créneau de vente pour ${propertyTitle}.`;
        break;

    case "confirmationByUser":
        primaryMessage = "Confirmation reçue";
        mainMessage = `${buyerName} a confirmé les détails de la transaction concernant le bien "${propertyTitle}". Toutes les parties sont désormais prêtes pour la finalisation du processus.`;
        emailSubject = "Confirmation de transaction reçue - Bookaroo";
        previewText = `${buyerName} a confirmé la transaction pour ${propertyTitle}.`;
        break;

    case "confirmationByOwner":
        primaryMessage = "Confirmation du propriétaire";
        mainMessage = `${ownerName} a confirmé les détails de la transaction pour le bien "${propertyTitle}". La vente est désormais prête à être finalisée.`;
        emailSubject = "Confirmation de transaction - Bookaroo";
        previewText = `${ownerName} a confirmé la transaction pour ${propertyTitle}.`;
        break;

    case "offerAcceptByOwner":
        primaryMessage = "Offre acceptée";
        mainMessage = `${ownerName} a accepté votre offre pour le bien "${propertyTitle}". Vous pouvez maintenant poursuivre les prochaines étapes de la transaction depuis votre tableau de bord.`;
        emailSubject = "Offre acceptée - Bookaroo";
        previewText = `Votre offre pour ${propertyTitle} a été acceptée.`;
        break;

    case "offerRefusedByOwner":
        primaryMessage = "Offre refusée";
        mainMessage = `${ownerName} a refusé votre offre pour le bien "${propertyTitle}". Vous pouvez consulter d'autres opportunités ou contacter le propriétaire pour davantage d'informations.`;
        emailSubject = "Offre refusée - Bookaroo";
        previewText = `Votre offre pour ${propertyTitle} n'a pas été acceptée.`;
        break;

    case "applicationAcceptedByOwner":
        primaryMessage = "Candidature acceptée";
        mainMessage = `${ownerName} a accepté votre candidature pour le bien "${propertyTitle}". Vous pouvez désormais poursuivre les prochaines étapes du processus depuis votre tableau de bord.`;
        emailSubject = "Candidature acceptée - Bookaroo";
        previewText = `Votre candidature pour ${propertyTitle} a été acceptée.`;
        break;

    case "applicationRejectedByOwner":
        primaryMessage = "Candidature refusée";
        mainMessage = `${ownerName} a refusé votre candidature pour le bien "${propertyTitle}". Nous vous encourageons à explorer d'autres opportunités disponibles sur Bookaroo.`;
        emailSubject = "Candidature refusée - Bookaroo";
        previewText = `Votre candidature pour ${propertyTitle} n'a pas été retenue.`;
        break;

    case "requestToChangeFinalSigningSlot":
        primaryMessage = "Demande de modification du créneau de signature";
        mainMessage = `${buyerName} a demandé la modification du créneau de signature finale pour le bien "${propertyTitle}". Veuillez consulter la demande et proposer un nouveau créneau si nécessaire.`;
        emailSubject = "Demande de modification du créneau de signature - Bookaroo";
        previewText = `Une demande de modification du créneau de signature a été soumise pour ${propertyTitle}.`;
        break;
    
    case "requestToChangeVisitSlot":
        primaryMessage = "Demande de modification du créneau de visite";
        mainMessage = `${buyerName} a demandé la modification du créneau de visite pour le bien "${propertyTitle}". Veuillez consulter la demande et mettre à jour votre disponibilité.`;
        emailSubject = "Demande de modification du créneau de visite - Bookaroo";
        previewText = `Une demande de modification du créneau de visite a été soumise pour ${propertyTitle}.`;
        break;
    
    case "ownerChangedFinalSigningSlot":
        primaryMessage = "Créneau de signature mis à jour";
        mainMessage = `${ownerName} a mis à jour le créneau de signature finale pour le bien "${propertyTitle}". Veuillez consulter les nouveaux détails et confirmer votre disponibilité.`;
        emailSubject = "Mise à jour du créneau de signature - Bookaroo";
        previewText = `Le créneau de signature finale a été modifié pour ${propertyTitle}.`;
        break;

    case "saleslotBookedByUser":
        primaryMessage = "Nouveau créneau de vente réservé";
        mainMessage = `${buyerName} a réservé un créneau de vente pour le bien "${propertyTitle}". Veuillez consulter les détails et confirmer votre disponibilité depuis votre tableau de bord.`;
        emailSubject = "Nouveau créneau de vente réservé - Bookaroo";
        previewText = `Un nouveau créneau de vente a été réservé pour ${propertyTitle}.`;
        break;

    case "homeInventoryOpenedByOwner":
        primaryMessage = "Inventaire du logement disponible";
        mainMessage = `${ownerName} a ouvert l’inventaire du logement pour le bien "${propertyTitle}". Vous pouvez désormais consulter les informations et éléments renseignés par le propriétaire depuis votre tableau de bord.`;
        emailSubject = "Inventaire du logement disponible - Bookaroo";
        previewText = `L’inventaire du logement est désormais disponible pour ${propertyTitle}.`;
        break;


    default:
      primaryMessage = "Mise à jour de propriété";

      mainMessage = `Une nouvelle activité a été enregistrée concernant le bien "${propertyTitle}".`;

      emailSubject = "Mise à jour - Bookaroo";

      previewText = `Nouvelle activité concernant ${propertyTitle}.`;

      break;
  }
  console.log({
    email: email,
    subject: emailSubject,
    type: type,
  });
  let subject = emailSubject

  await sendEmail({
    module: "AUTH",

    to: email,

    subject: emailSubject,

    templateId: constants.BREVO.INTEREST_UPDATE_EMAIL,

    params: {
      subject,
      previewText,
      primaryMessage,
      mainMessage,
      secondaryMessage,
      propertyLink,
    },
  });
};

// const interestUpdateEmail = (options) => {
//     const { buyerName, price, ownerName, type, propertyTitle, email, propertyLink } = options;
//     let primayMessage = "";
//     let mainMessage = "";
//     let secondaryMessage = "You can still visit the property to explore more details and check its updates. Stay connected for further updates.";
//     let emailSubject = "";

//     // Determine content based on email type
//     switch (type) {
//         case "funnelOfferAccepted":
//             primayMessage = "Offer Accepted";
//             mainMessage = `Great news! <strong>${ownerName}</strong> has accepted the offer from <strong>${buyerName}</strong> for the property titled <strong>${propertyTitle}</strong> at the price of <strong>$${price}</strong>.`;
//             emailSubject = "Offer Accepted - Bookaroo";
//             break;

//         case "funnelOfferRefused":
//             primayMessage = "Offer Refused";
//             mainMessage = `We regret to inform you that <strong>${ownerName}</strong> has refused the offer from <strong>${buyerName}</strong> for the property titled <strong>${propertyTitle}</strong> at the proposed price of <strong>$${price}</strong>.`;
//             emailSubject = "Offer Declined - Bookaroo";
//             break;

//         case "funnelApplicationAccepted":
//             primayMessage = "Application Accepted";
//             mainMessage = `Congratulations! <strong>${ownerName}</strong> has accepted the application from <strong>${buyerName}</strong> for the property titled <strong>${propertyTitle}</strong>.`;
//             emailSubject = "Application Approved - Bookaroo";
//             break;

//         case "funnelApplicationRefused":
//             primayMessage = "Application Refused";
//             mainMessage = `We regret to inform you that <strong>${ownerName}</strong> has refused the application from <strong>${buyerName}</strong> for the property titled <strong>${propertyTitle}</strong>.`;
//             emailSubject = "Application Declined - Bookaroo";
//             break;

//         default:
//             mainMessage = `There has been activity regarding <strong>${propertyTitle}</strong> between <strong>${buyerName}</strong> and <strong>${ownerName}</strong>.`;
//             emailSubject = "Activity Update - Bookaroo";
//     }

//     const message = `<!DOCTYPE html>
//     <html>
//     <head>
//         <title>Bookaroo</title>
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <link rel="preconnect" href="https://fonts.googleapis.com">
//         <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
//         <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
//         <style>
//             @media (max-width:767px) {
//                 .w-100 { width: 100%; }
//                 .fz-20 { font-size: 25px !important; }
//             }
//         </style>
//     </head>
//     <body style="font-family: 'Poppins', sans-serif; background:#fff;">
//         <table width="100%" cellpadding="0" cellspacing="0">
//             <tbody>
//                 <tr>
//                     <td style="padding: 50px 20px;">
//                         <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
//                             <tr><td style="height:40px;"></td></tr>
//                             <tr>
//                                 <td style="text-align:center; padding-bottom: 10px; height: 50px;">
//                                     <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 120px; margin: 0 auto;" />
//                                 </td>
//                             </tr>
//                             <tr>
//                                 <td style="padding: 20px 60px;">
//                                     <table width="100%" cellpadding="0" cellspacing="0">
//                                         <tr><td style="border-bottom: 1px solid #E2E8F0;"></td></tr>
//                                     </table>
//                                 </td>
//                             </tr>
//                             <tr>
//                                 <td style="text-align:center; padding-bottom: 10px;">
//                                     <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width: 340px; margin: 0 auto;" />
//                                 </td>
//                             </tr>
//                             <tr>
//                                 <td style="padding: 20px 60px;">
//                                     <table width="100%" cellpadding="0" cellspacing="0">
//                                         <tr><td style="border-bottom: 1px solid #E2E8F0;"></td></tr>
//                                     </table>
//                                 </td>
//                             </tr>
//                             <tr>
//                                 <td style="padding: 15px 0 25px 0;">
//                                 <h2 style="text-align: center; color: #6D6D6D">${primayMessage}</h2>
//                                     <p style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
//                                         ${mainMessage}
//                                     </p>
//                                     <p style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
//                                         ${secondaryMessage}
//                                     </p>
//                                 </td>
//                             </tr>
//                             <tr>
//                                 <td style="display: flex; justify-content: center; gap: 10px;">
//                                     <a href="${propertyLink}" style="font-size: 14px; padding: 14px 30px; text-align:center; margin:0 auto; background: #976DD0!important; cursor: pointer; border: none; color: #fff; display:inline-block; border-radius:5px;">
//                                         Visit Property
//                                     </a>
//                                 </td>
//                             </tr>
//                             <tr><td style="height:60px;"></td></tr>
//                         </table>
//                     </td>
//                 </tr>
//             </tbody>
//         </table>
//     </body>
//     </html>`;

//     // SmtpController.sendEmail(email, emailSubject, message);
//     sendEmail({
//         module: "auth",
//         to: email,
//         subject: emailSubject,
//         htmlContent: message
//     });

// }

const propertyTransferEmail = (options) => {
  let email = options.email;
  let propertyTitle = options.propertyTitle;
  let transferorName = options.ownerName; // Name of the user transferring the property
  let transfereeName = options.buyerName; // Name of the recipient of the property
  let propertyLink = options.propertyLink;

  let message = "";

  message += `<!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;"></td>
                        </tr>
                       
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                           <td style="text-align:center;">
                           <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                  class="fz-20">Transaction Funnel News,
                              </p>
                          </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    We're delighted to inform you that <strong>${transferorName}</strong> has successfully transferred the property titled <strong>${propertyTitle}</strong> to ${transfereeName}.
                                </p>
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    You can still view other properties using the link below.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
                                <a
                                  href="${propertyLink}"
                                  style="
                                    font-size: 14px;
                                    padding: 14px 30px;
                                    text-align:center;
                                    margin:0 auto;
                                    background: #976DD0!important;
                                    cursor: pointer;
                                    border: none;
                                    color: #fff;
                                    display:inline-block;
                                    border-radius:5px;">
                                    View Property Details
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:60px;"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
`;

  // SmtpController.sendEmail(email, "Property Transfer Confirmation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Property Transfer Confirmation",
    htmlContent: message,
  });
};

const renterTransferEmail = (options) => {
  let email = options.email;
  let propertyTitle = options.propertyTitle;
  let transferorName = options.ownerName; // Name of the user transferring the property
  let transfereeName = options.renterName; // Name of the recipient of the property
  let propertyLink = options.propertyLink;

  let message = "";

  message += `<!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;"></td>
                        </tr>
                       
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                         <tr>
                             <td style="text-align:center;">
                             <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                     class="fz-20">Transaction Funnel News,
                                 </p>
                             </td>
                         </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    We're delighted to inform you that <strong>${transferorName}</strong> has successfully rented the property titled <strong>${propertyTitle}</strong>.
                                </p>
                                <p
                                    style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    You can visit the property details using the link below.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
                                <a
                                  href="${propertyLink}"
                                  style="
                                    font-size: 14px;
                                    padding: 14px 30px;
                                    text-align:center;
                                    margin:0 auto;
                                    background: #976DD0!important;
                                    cursor: pointer;
                                    border: none;
                                    color: #fff;
                                    display:inline-block;
                                    border-radius:5px;">
                                    View Property Details
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:60px;"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
`;

  // SmtpController.sendEmail(email, "Renter Confirmation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Renter Confirmation",
    htmlContent: message,
  });
};

const ownerCongratsEmail = (options) => {
  let email = options.email;
  let propertyTitle = options.propertyTitle;
  let ownerName = options.ownerName; // Name of the user transferring the property
  let renterName = options.renterName; // Name of the recipient of the property
  // let buyerName = options.buyerName;
  let propertyLink = options.propertyLink;
  let type = options.type;
  if (type === "renterCase") {
    dynamicContent = `
            <p
                style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                We're delighted to inform you that you have successfully rented the property titled <strong>${propertyTitle}</strong> from <strong>${ownerName}</strong>.
            </p>
            <p
                style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                Stay connected with us like this. Visit your new renter property below.
            </p>
        `;
  } else {
    dynamicContent = `
            <p
                style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                We're delighted to inform you that you have successfully purchased the property titled <strong>${propertyTitle}</strong> from <strong>${ownerName}</strong>.
            </p>
            <p
                style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                Congratulations on your new property! Visit your new property below.
            </p>
        `;
  }

  let message = "";

  message += `<!DOCTYPE html>
<html>

<head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;"
                        class="w-100">
                        <tr>
                            <td style="height:40px;"></td>
                        </tr>
                       
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                         <tr>
                             <td style="text-align:center;">
                             <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;"
                                     class="fz-20">Transaction Funnel News
                                 </p>
                                 <p style="font-size:18px; max-width: 600px; margin:0 auto; font-weight: 400; padding: 0 20px; color: #6D6D6D; line-height: 24px;"
                                     class="fz-20">Hi ${renterName}
                                 </p>
                             </td>
                         </tr>
                         
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                            ${dynamicContent}
                            </td>
                        </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
                                <a
                                  href="${propertyLink}"
                                  style="
                                    font-size: 14px;
                                    padding: 14px 30px;
                                    text-align:center;
                                    margin:0 auto;
                                    background: #976DD0!important;
                                    cursor: pointer;
                                    border: none;
                                    color: #fff;
                                    display:inline-block;
                                    border-radius:5px;">
                                    View Property Details
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:60px;"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>
`;

  // SmtpController.sendEmail(email, "Buyer Confirmation", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Buyer Confirmation",
    htmlContent: message,
  });
};

const notifyOwner = (options) => {
  let { email, buyerName, propertyTitle, ownerName } = options;

  let message = "";

  message += `<!DOCTYPE html>
<html>

<head>
    <title>Property Transfer Request</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap"
        rel="stylesheet">

    <style>
        @media (max-width:767px) {
            .w-100 {
                width: 100%;
            }

            .fz-20 {
                font-size: 25px !important;
            }
        }
    </style>

</head>

<body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
            <tr>
                <td style="padding: 50px 20px;">
                    <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
                        <tr>
                            <td style="height:40px;"></td>
                        </tr>
                          <tr>
                            <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png"
                                style="width: 120px; margin: 0 auto;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center; padding-bottom: 10px;">
                                <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png"
                                style="width: 340px; margin: 0 auto;" />
                            </td>
                        </tr>
                            <td style="padding: 20px 60px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="border-bottom: 1px solid #E2E8F0;"></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;" class="fz-20">
                                    Hi ${ownerName},
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 0 25px 0;">
                                <p style="font-size:16px; max-width: 400px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                    ${buyerName} has requested to transfer ownership of the property titled <strong>${propertyTitle}</strong>.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="display: flex; justify-content: center; gap: 10px;">
                                <a href="https://book.jcsoftwaresolution.in/" style="
                                    font-size: 14px;
                                    padding: 14px 30px;
                                    text-align:center;
                                    margin:0 auto;
                                    background: #976DD0!important;
                                    cursor: pointer;
                                    border: none;
                                    color: #fff;
                                    display:inline-block;
                                    border-radius:5px;">
                                    Review Request
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:60px;"></td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>

</html>`;

  // SmtpController.sendEmail(email, "Property Transfer Request", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Property Transfer Request",
    htmlContent: message,
  });
};

const ownerDocsNotify = (options) => {
  let { email, buyerName, propertyTitle, OwnerName } = options;

  let message = "";
  message = `<!DOCTYPE html>
    <html>
    
    <head>
        <title>Bookaroo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
        <style>
            @media (max-width:767px) {
                .w-100 { width: 100%; }
                .fz-20 { font-size: 25px !important; }
            }
        </style>
    </head>
    
    <body style="font-family: 'Poppins', sans-serif; background:#fff;">
        <table width="100%">
            <tbody>
                <tr>
                    <td style="padding: 50px 20px;">
                        <table width="676px" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
                            <tr><td style="height:40px;"></td></tr>
                            <tr>
                                <td style="text-align:center; padding-bottom: 10px; height: 50px;">
                                    <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 120px;" />
                                </td>
                            </tr>
                            <tr><td style="padding: 20px 60px; border-bottom: 1px solid #E2E8F0;"></td></tr>
                            <tr>
                                <td style="text-align:center; padding-bottom: 10px;">
                                    <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width: 340px;" />
                                </td>
                            </tr>
                            <tr><td style="padding: 20px 60px; border-bottom: 1px solid #E2E8F0;"></td></tr>
                            <tr>
                                <td style="text-align:center;">
                                    <p style="font-size:22px; max-width: 400px; margin:0 auto; font-weight: 600; padding: 0 20px; color: #976dd0; line-height: 24px;">Hi ${OwnerName},</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 15px 0 25px 0; text-align:center;">
                                    <p style="font-size:16px; max-width: 400px; margin:0 auto; color: #6D6D6D; line-height: 25px; padding: 0 20px;">
                                        ${buyerName} has shared relevant documents regarding the property <strong>${propertyTitle}</strong>.
                                        You can view them in your funnel.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="text-align:center;">
                                    <a href="${FRONT_WEB_URL}/funnel" style="font-size: 14px; padding: 14px 30px; background: #976DD0; color: #fff; border-radius:5px; text-decoration: none;">
                                        View Documents
                                    </a>
                                </td>
                            </tr>
                            <tr><td style="height:60px;"></td></tr>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    </body>
    
    </html>`;

  // SmtpController.sendEmail(email, "Documents Shared Notification", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Documents Shared Notification",
    htmlContent: message,
  });
};

const contractSignedEmail = (options) => {
  const { propertyTitle, buyerName, ownerName, signerName } = options;
  let email = options.ownerEmail;

  let message = "";

  message += `<!DOCTYPE html>
  <html>
  <head>
    <title>Bookaroo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <style>
      @media (max-width: 767px) {
        .w-100 { width: 100%; }
        .fz-20 { font-size: 25px !important; }
      }
    </style>
  </head>
  <body style="font-family: 'Poppins', sans-serif; background:#fff;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tbody>
        <tr>
          <td style="padding: 50px 20px;">
            <table width="676px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#F2F5FF;" class="w-100">
              <tr><td style="height:40px;"></td></tr>
              <tr>
                <td style="text-align:center; padding-bottom: 10px;">
                  <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 120px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 60px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-bottom: 1px solid #E2E8F0;"></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="text-align:center; padding-bottom: 10px;">
                  <img src="${BACK_WEB_URL}/img/image-1728022760309-8794.png" style="width: 340px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 60px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-bottom: 1px solid #E2E8F0;"></td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <p style="font-size:22px; max-width: 500px; margin:0 auto; font-weight: 600; color: #976dd0; line-height: 24px;" class="fz-20">
                    Hello ${ownerName},
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 15px 0 25px 0;">
                  <p style="font-size:16px; max-width: 500px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px;">
                    Good news! <strong>${signerName}</strong> has signed the contract for property titled <strong>${propertyTitle}</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 15px 0 25px 0;">
                  <p style="font-size:16px; max-width: 500px; margin:0 auto; text-align: center; color: #6D6D6D; line-height: 25px;">
                    Check your latest funnel activity.NOW!
                  </p>
                </td>
              </tr>
              <tr><td style="height:60px;"></td></tr>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
  </html>`;
  // SmtpController.sendEmail(email, "Contract Signed Notification", message);
  sendEmail({
    module: "auth",
    to: email,
    subject: "Contract Signed Notification",
    htmlContent: message,
  });
};

module.exports = {
  forgotPasswordEmail,
  addUserEmail,
  userVerifyLink,
  updatePasswordEmail,
  invite_user_email,
  verificationOtp,
  DocumentVerifyLink,
  ClaimVenueRequest,
  sendCredential,
  sendVerificationMail,
  addStaffEmail,
  welcomeUser,
  forgotPasswordEmailForUser,
  loginCredentialEmail,
  contactUsEmail,
  changePasswordConfirmation,
  changeEmail,
  changeEmailOtp,
  SendPersonalDataPro,
  SendPersonalDataIndividual,
  nonExistingUserShare,
  existingUserShare,
  interestUpdateEmail,
  propertyTransferEmail,
  renterTransferEmail,
  ownerCongratsEmail,
  notifyOwner,
  ownerDocsNotify,
  contractSignedEmail,
};
