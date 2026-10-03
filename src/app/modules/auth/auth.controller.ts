import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AuthService } from './auth.service';
import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../errors/ApiError';
import config from '../../../config';

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { ...verifyData } = req.body;
  const result = await AuthService.verifyEmailToDB(verifyData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
    data: result.data,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const { ...loginData } = req.body;
  const result = await AuthService.loginUserFromDB(loginData);

  const { refreshToken, accessToken, rememberMe } = result;

  // set refresh token into cookie
  const cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    maxAge?: number;
  } = {
    secure: config.node_env === 'production',
    httpOnly: true,
  };

  if (rememberMe) {
    // 90 days for persistent session
    cookieOptions.maxAge = 90 * 24 * 60 * 60 * 1000;
  } else {
    // 1 day for non-persistent session
    cookieOptions.maxAge = 1 * 24 * 60 * 60 * 1000;
  }

  res.cookie('refreshToken', refreshToken, cookieOptions);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User logged in successfully.',
    data: {
      accessToken,
      refreshToken,
      rememberMe,
    },
  });
});

const socialLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.socialLoginFromDB(req.body);
  const { refreshToken, accessToken, rememberMe } = result;

  // set refresh token into cookie
  const cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    maxAge?: number;
  } = {
    secure: config.node_env === 'production',
    httpOnly: true,
  };

  if (rememberMe) {
    // 90 days for persistent session
    cookieOptions.maxAge = 90 * 24 * 60 * 60 * 1000;
  } else {
    // 1 day for non-persistent session
    cookieOptions.maxAge = 1 * 24 * 60 * 60 * 1000;
  }

  res.cookie('refreshToken', refreshToken, cookieOptions);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Login successful',
    data: {
      accessToken,
      refreshToken,
      rememberMe,
    },
  });
});

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const email = req.body.email;
  const result = await AuthService.forgetPasswordToDB(email);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      'Please check your email. We have sent you a one-time passcode (OTP).',
    data: result,
  });
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await AuthService.resendOtpToDB(email);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const tokenWithBearer = req.headers.authorization;
  if (!tokenWithBearer) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
  }

  // Handle both "Bearer <token>" and raw "<token>"
  let token: string;
  if (tokenWithBearer.startsWith('Bearer ')) {
    token = tokenWithBearer.substring(7).trim();
  } else {
    token = tokenWithBearer.trim();
  }

  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
  }

  const { ...resetData } = req.body;
  const result = await AuthService.resetPasswordToDB(token, resetData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your password has been successfully reset.',
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload | undefined;
  const { ...passwordData } = req.body;
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not authenticated');
  }
  await AuthService.changePasswordToDB(user as JwtPayload, passwordData);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Your password has been successfully changed',
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  const result = await AuthService.refreshToken(refreshToken);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Access token generated successfully!',
    data: result,
  });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const { deviceToken } = req.body;

  const result = await AuthService.logoutUserFromDB(
    user.id,
    user.role,
    deviceToken,
  );

  res.clearCookie('refreshToken');

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: result.message || 'User logged out successfully.',
  });
});

export const AuthController = {
  verifyEmail,
  loginUser,
  socialLogin,
  forgetPassword,
  resendOtp,
  resetPassword,
  changePassword,
  refreshToken,
  logoutUser,
};
