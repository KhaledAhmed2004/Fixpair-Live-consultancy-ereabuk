/* eslint-disable @typescript-eslint/no-explicit-any */
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enums/user';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import unlinkFile from '../../../shared/unlinkFile';
import generateOTP from '../../../util/generateOTP';
import QueryBuilder from '../../builder/QueryBuilder';
import { IUser } from './user.interface';
import { User } from './user.model';
import { ReviewService } from '../review/review.service';
import { ConsultantOverviewService } from '../consultantOverview/consultantOverview.service';
import { cacheHelper } from '../../utils/cache';
import { ConsultancyType } from '../consultancyType/consultancyType.model';

const getAllUsersToDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(
    User.find().select(
      '-authentication -password -paymentMethods -fcmTokens -stripeCustomerId -paypalPayerId',
    ).populate('consultancyType'),
    query,
  )
    .search(['name', 'email', 'contact'])
    .filter()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery.lean();
  const meta = await userQuery.getPaginationInfo();

  // If fetching consultants, attach their stats efficiently
  const consultantIds = result
    .filter((user: any) => user.role === USER_ROLES.CONSULTANT)
    .map((user: any) => user._id.toString());

  const statsMap = await ReviewService.getBulkConsultantStats(consultantIds);

  const resultWithStats = result.map((user: any) => {
    if (user.role === USER_ROLES.CONSULTANT) {
      const stats = statsMap[user._id.toString()] || {
        avgRating: 0,
        totalReviews: 0,
      };
      return { ...user, stats };
    }
    return user;
  });

  return { result: resultWithStats, meta };
};

const createUserToDB = async (payload: Partial<IUser>): Promise<IUser> => {
  //set role
  payload.role = payload.role || USER_ROLES.USER;
  
  if (payload.role === USER_ROLES.CONSULTANT) {
    payload.verified = true;
    
    if (payload.consultancyType) {
      const isExistType = await ConsultancyType.findOne({ _id: payload.consultancyType, status: 'active' });
      if (!isExistType) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or inactive consultancy type');
      }
    }
  }

  const createUser = await User.create(payload);
  if (!createUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user');
  }

  if (payload.role !== USER_ROLES.CONSULTANT) {
    //send email
    const otp = generateOTP();
    const values = {
      name: createUser.name,
      otp: otp,
      email: createUser.email!,
    };
    const createAccountTemplate = emailTemplate.createAccount(values);
    emailHelper.sendEmail(createAccountTemplate);

    //save to DB
    await User.findOneAndUpdate(
      { _id: createUser._id },
      {
        $set: {
          'authentication.oneTimeCode': otp,
          'authentication.expireAt': new Date(Date.now() + 3 * 60000),
        },
      },
    );
  }

  return createUser;
};

const getUserProfileFromDB = async (
  user: JwtPayload,
): Promise<Partial<IUser>> => {
  const { id } = user;
  const isExistUser = await User.findById(id).select(
    '-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId',
  ).populate('consultancyType');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const userObj = isExistUser.toObject();

  // If user is a consultant, attach stats
  if (userObj.role === USER_ROLES.CONSULTANT) {
    const stats = await ReviewService.getConsultantStats(id);
    (userObj as any).stats = stats;
  }

  return userObj;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>,
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.findById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  // Prevent users from manually updating sensitive fields via profile update
  const protectedFields = [
    'role',
    'verified',
    'stripeCustomerId',
    'paypalPayerId',
    'authentication',
    'fcmTokens',
  ];
  protectedFields.forEach(field => {
    delete (payload as any)[field];
  });

  if (payload.consultancyType) {
    const isExistType = await ConsultancyType.findOne({ _id: payload.consultancyType, status: 'active' });
    if (!isExistType) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or inactive consultancy type');
    }
  }

  //unlink file here
  if (payload.image) {
    if (isExistUser.image) {
      unlinkFile(isExistUser.image);
    }
  }

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  }).select(
    '-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId',
  ).populate('consultancyType');

  if (updateDoc) {
    // Invalidate consultant related caches
    cacheHelper.clearByPrefix('consultants:recommended');
    cacheHelper.clearByPrefix(`consultants:list`);
  }

  return updateDoc;
};

const updateUserToDB = async (
  id: string,
  payload: Partial<IUser>,
): Promise<Partial<IUser | null>> => {
  const isExistUser = await User.findById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  if (payload.consultancyType) {
    const isExistType = await ConsultancyType.findOne({ _id: payload.consultancyType, status: 'active' });
    if (!isExistType) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or inactive consultancy type');
    }
  }

  //unlink file here
  if (payload.image) {
    if (isExistUser.image) {
      unlinkFile(isExistUser.image);
    }
  }

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  }).select(
    '-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId',
  ).populate('consultancyType');

  if (updateDoc) {
    // Invalidate consultant related caches
    cacheHelper.clearByPrefix('consultants:recommended');
    cacheHelper.clearByPrefix(`consultants:list`);
  }

  return updateDoc;
};

const deleteAccountFromDB = async (user: JwtPayload) => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (isExistUser.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Super Admin account cannot be deleted!',
    );
  }

  //unlink file here
  if (isExistUser.image) {
    unlinkFile(isExistUser.image);
  }

  const deleteDoc = await User.findByIdAndDelete(id);
  return deleteDoc;
};

const deleteUserFromDB = async (adminId: string, targetId: string) => {
  const adminUser = await User.findById(adminId);
  const targetUser = await User.findById(targetId);

  if (!targetUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // Requirement: Super Admin cannot be deleted by anyone
  if (targetUser.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Super Admin account cannot be deleted!',
    );
  }

  if (adminUser?.role === USER_ROLES.ADMIN) {
    // Admin cannot delete other Admins
    if (targetUser.role === USER_ROLES.ADMIN) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'Admin cannot delete another Admin account!',
      );
    }
  }

  // Unlink image if exists
  if (targetUser.image) {
    unlinkFile(targetUser.image);
  }

  const result = await User.findByIdAndDelete(targetId);
  return result;
};

const getSingleUserFromDB = async (id: string): Promise<Partial<IUser>> => {
  const isExistUser = await User.findById(id).select(
    '-authentication -password -fcmTokens -stripeCustomerId -paypalPayerId',
  ).populate('consultancyType');
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const userObj = isExistUser.toObject();

  // If user is a consultant, attach stats
  if (userObj.role === USER_ROLES.CONSULTANT) {
    const [reviewStats, dashboardStats, reviewsResponse, trendResponse] = await Promise.all([
      ReviewService.getConsultantStats(id),
      ConsultantOverviewService.getDashboardSummary(id),
      ReviewService.getReviewsByConsultant(id, { limit: '5', sort: '-createdAt' }),
      ConsultantOverviewService.getConsultationTrend(id, 7) // Last 7 days for the chart
    ]);

    (userObj as any).stats = {
      averageRating: reviewStats.avgRating,
      ...dashboardStats
    };

    (userObj as any).reviews = reviewsResponse.result.map((r: any) => ({
      _id: r._id,
      name: r.user?.name || 'Anonymous',
      rating: r.rating,
      date: new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      comment: r.comment
    }));

    (userObj as any).chartData = trendResponse.points.map(p => {
      // p.date is usually "YYYY-MM-DD"
      // p.label is like "15 Aug", we convert to "Aug 15"
      const parts = p.label.split(' ');
      const formattedDate = parts.length === 2 ? `${parts[1]} ${parts[0]}` : p.label;
      
      return {
        rawDate: p.date, // Best practice: keep the raw date for sorting/filtering
        date: formattedDate, // Display date for X-axis
        upcoming: p.upcoming,
        completed: p.completed,
        cancelled: p.cancelled
      };
    });
  }

  return userObj;
};

const getConsultantsFromDB = async (query: Record<string, unknown>) => {
  const cacheKey = `consultants:list:${JSON.stringify(query)}`;
  const cachedData = cacheHelper.get<any>(cacheKey);
  if (cachedData) return cachedData;

  // Use searchTerm for name filtering if name is provided in query
  const queryData = { ...query };
  if (queryData.name) {
    queryData.searchTerm = queryData.name;
    delete queryData.name;
  }

  if (queryData.minPrice !== undefined || queryData.maxPrice !== undefined) {
    queryData.perMinuteRate = {};
    if (queryData.minPrice !== undefined) {
      (queryData.perMinuteRate as any).$gte = Number(queryData.minPrice);
      delete queryData.minPrice;
    }
    if (queryData.maxPrice !== undefined) {
      (queryData.perMinuteRate as any).$lte = Number(queryData.maxPrice);
      delete queryData.maxPrice;
    }
  }

  if (queryData.minRating !== undefined) {
    queryData.averageRating = { $gte: Number(queryData.minRating) };
    delete queryData.minRating;
  }

  const consultantQuery = new QueryBuilder(
    User.find({
      role: USER_ROLES.CONSULTANT,
      status: 'active',
    }).select(
      'name image bio consultancyType experience languages expertise perMinuteRate currency activeStatus averageRating totalReviews createdAt updatedAt',
    ).populate('consultancyType'),
    queryData,
  )
    .search(['name', 'email', 'expertise'])
    .filter()
    .paginate()
    .fields();

  const result = await consultantQuery.modelQuery.lean();
  const meta = await consultantQuery.getPaginationInfo();

  const response = { result, meta };
  cacheHelper.set(cacheKey, response, 300); // 5 mins
  return response;
};

const updateDeviceTokenToDB = async (
  userId: string,
  payload: {
    deviceToken: string;
    deviceType: 'android' | 'ios';
    action?: 'add' | 'remove';
  },
) => {
  const { deviceToken, deviceType, action = 'add' } = payload;

  let updateOperation;
  if (action === 'add') {
    updateOperation = {
      $addToSet: { fcmTokens: deviceToken },
      $set: { deviceType },
    };
  } else {
    updateOperation = {
      $pull: { fcmTokens: deviceToken },
    };
  }

  const result = await User.findByIdAndUpdate(userId, updateOperation, {
    new: true,
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return result;
};

const toggleStatusInDB = async (userId: string, activeStatus: boolean) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { activeStatus },
    { new: true, runValidators: true }
  ).select('name email activeStatus role');
  
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // Clear cache if they are a consultant
  if (user.role === 'CONSULTANT') {
    cacheHelper.clearByPrefix('consultants:recommended');
    cacheHelper.clearByPrefix('consultants:list');
  }

  return user;
};

export const UserService = {
  getAllUsersToDB,
  createUserToDB,
  getUserProfileFromDB,
  updateProfileToDB,
  deleteAccountFromDB,
  deleteUserFromDB,
  getSingleUserFromDB,
  getConsultantsFromDB,
  updateDeviceTokenToDB,
  toggleStatusInDB,
  updateUserToDB,
};
