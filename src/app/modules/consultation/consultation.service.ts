/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Availability, Consultation } from './consultation.model';
import { ISlot } from './consultation.interface';
import { User } from '../user/user.model';
import { USER_ROLES } from '../../../enums/user';
import config from '../../../config';
import { NotificationService } from '../notification/notification.service';
import { cacheHelper } from '../../utils/cache';
import { VideoSessionService } from '../videoSession/videoSession.service';
import { VideoSession } from '../videoSession/videoSession.model';
import { socketHelper } from '../../../helpers/socketHelper';
import { Review } from '../review/review.model';

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const setUnavailability = async (user: JwtPayload, slots: ISlot[]) => {
  const consultantId = user.id;

  // 1. Validate slots are within the next 30 days
  const today = startOfDay(new Date());

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  slots.forEach(slot => {
    const slotDate = startOfDay(new Date(slot.date));

    if (slotDate < today || slotDate > maxDate) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Unavailable slots must be within the next 30 days',
      );
    }
  });

  // 2. Upsert availability (Unavailable slots)
  const result = await Availability.findOneAndUpdate(
    { consultant: consultantId },
    {
      $set: {
        consultant: consultantId,
        slots: slots.map(s => ({
          date: startOfDay(new Date(s.date)),
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      },
    },
    { upsert: true, new: true },
  );

  return result;
};

const getMyUnavailability = async (user: JwtPayload) => {
  const consultantId = user.id;

  const availability = await Availability.findOne({ consultant: consultantId });

  if (!availability) {
    return { slots: [] };
  }

  return availability;
};

const removeUnavailability = async (
  user: JwtPayload,
  slotId?: string,
  payload?: { date?: string; startTime?: string; endTime?: string; slotId?: string },
) => {
  const consultantId = user.id;
  const targetSlotId = slotId || payload?.slotId;

  if (targetSlotId) {
    const result = await Availability.findOneAndUpdate(
      { consultant: consultantId },
      {
        $pull: {
          slots: { _id: targetSlotId },
        },
      },
      { new: true },
    );
    return result || { slots: [] };
  }

  if (payload?.date && payload?.startTime && payload?.endTime) {
    const slotDate = startOfDay(new Date(payload.date));
    const result = await Availability.findOneAndUpdate(
      { consultant: consultantId },
      {
        $pull: {
          slots: {
            date: slotDate,
            startTime: payload.startTime,
            endTime: payload.endTime,
          },
        },
      },
      { new: true },
    );
    return result || { slots: [] };
  }

  // If no specific slot passed, clear all unavailable slots
  const result = await Availability.findOneAndUpdate(
    { consultant: consultantId },
    { $set: { slots: [] } },
    { new: true },
  );

  return result || { slots: [] };
};

const getAvailableSlots = async (consultantId: string, date?: string) => {
  // 1. Find the unavailable slots for the consultant
  const availability = await Availability.findOne({ consultant: consultantId });
  let unavailableSlots = availability ? availability.slots : [];

  // 2. Find already booked slots (accepted, confirmed, completed)
  const filter: any = {
    consultant: new mongoose.Types.ObjectId(consultantId),
    status: { $in: ['accepted', 'confirmed', 'completed', 'pending'] },
    bookingType: 'scheduled',
  };

  if (date) {
    const targetDate = startOfDay(new Date(date));
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    filter.date = { $gte: targetDate, $lt: nextDay };

    // Filter unavailableSlots for the specific date
    unavailableSlots = unavailableSlots.filter(s => {
      const sDate = new Date(s.date);
      return sDate >= targetDate && sDate < nextDay;
    });
  } else {
    const today = startOfDay(new Date());
    filter.date = { $gte: today };

    // Optional: Only return upcoming unavailable slots
    unavailableSlots = unavailableSlots.filter(s => {
      return new Date(s.date) >= today;
    });
  }

  const bookedConsultations = await Consultation.find(filter).select(
    'date startTime endTime',
  );

  return {
    unavailableSlots: unavailableSlots.map(s => ({
      _id: (s as any)._id || undefined,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    bookedSlots: bookedConsultations.map(c => ({
      _id: c._id,
      date: c.date,
      startTime: c.startTime,
      endTime: c.endTime,
    })),
  };
};

const createBooking = async (
  user: JwtPayload,
  payload: {
    consultantId: string;
    bookingType: 'scheduled' | 'instant' | 'callback';
    date?: string;
    startTime?: string;
    endTime?: string;
    preferredWindow?: 'asap' | 'today' | 'tomorrow';
    notes?: string;
  },
) => {
  const {
    consultantId,
    bookingType,
    date,
    startTime,
    endTime,
    preferredWindow,
    notes,
  } = payload;
  const userId = user.id;

  // 0. Validate if consultantId is a valid consultant
  const consultant = await User.findById(consultantId);
  if (!consultant || consultant.role !== USER_ROLES.CONSULTANT) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid consultant ID');
  }

  const perMinuteRate = consultant.perMinuteRate || 0;
  const platformFee = config.payment.billing.platformFee;

  if (bookingType === 'scheduled') {
    if (!date || !startTime || !endTime) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Date, startTime, and endTime are required for scheduled booking',
      );
    }

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // 1. Check if slot is marked as UNAVAILABLE by consultant
    const availability = await Availability.findOne({
      consultant: new mongoose.Types.ObjectId(consultantId),
      slots: {
        $elemMatch: {
          date: slotDate,
          startTime: startTime,
          endTime: endTime,
        },
      },
    });

    if (availability) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'This slot is marked unavailable by the consultant',
      );
    }

    // 2. Check if slot is ALREADY BOOKED
    const existingBooking = await Consultation.findOne({
      consultant: new mongoose.Types.ObjectId(consultantId),
      date: slotDate,
      startTime: startTime,
      endTime: endTime,
      status: {
        $in: ['pending', 'accepted', 'confirmed', 'completed'],
      },
    });

    if (existingBooking) {
      throw new ApiError(StatusCodes.CONFLICT, 'This slot is already booked');
    }

    // 3. Validate 30-day window
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    if (slotDate < now && slotDate.toDateString() !== now.toDateString()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Booking date cannot be in the past',
      );
    }

    if (slotDate > thirtyDaysLater) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Booking must be within the next 30 days',
      );
    }

    // 4. Create the consultation record
    const consultationData: any = {
      user: new mongoose.Types.ObjectId(userId),
      consultant: new mongoose.Types.ObjectId(consultantId),
      bookingType: 'scheduled',
      date: slotDate,
      startTime: startTime,
      endTime: endTime,
      status: 'pending',
      paymentStatus: 'pending',
      perMinuteRate,
      platformFee,
    };
    if (notes) consultationData.notes = notes;

    const result = await Consultation.create(consultationData);

    const client = await User.findById(userId).select('name');
    const clientName = client?.name || 'A user';

    await NotificationService.sendNotification({
      user: consultantId,
      title: 'New Consultation Request',
      message: `${clientName} has requested a scheduled consultation for ${slotDate.toLocaleDateString()} at ${startTime}.`,
      type: 'NEW_BOOKING_REQUEST',
      relatedBooking: result._id.toString(),
      idempotencyKey: `new_consultation_request_${result._id}`,
      metadata: {
        userName: clientName,
        bookingType: 'scheduled',
        date: slotDate.toLocaleDateString(),
        time: startTime,
      },
    });

    return { consultation: result, session: null };
  } else if (bookingType === 'instant') {
    if (!consultant.activeStatus) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Consultant is currently unavailable for instant consultation.',
      );
    }

    // Clean up any stale pending instant consultations for this consultant (> 60s old)
    const staleThreshold = new Date(Date.now() - 60 * 1000);
    const staleConsultations = await Consultation.find({
      consultant: new mongoose.Types.ObjectId(consultantId),
      bookingType: 'instant',
      status: 'pending',
      createdAt: { $lt: staleThreshold },
    });

    if (staleConsultations.length > 0) {
      const staleIds = staleConsultations.map((c) => c._id);
      await Consultation.updateMany(
        { _id: { $in: staleIds } },
        { $set: { status: 'expired' } },
      );
      await VideoSession.updateMany(
        { consultation: { $in: staleIds }, status: 'pending' },
        { $set: { status: 'cancelled' } },
      );
    }

    // Check if the current user already has an active ongoing request
    const existingPending = await Consultation.findOne({
      user: new mongoose.Types.ObjectId(userId),
      consultant: new mongoose.Types.ObjectId(consultantId),
      bookingType: 'instant',
      status: 'pending',
    });

    if (existingPending) {
      // Check if there is an active ongoing video session (already connected)
      const activeOngoingSession = await VideoSession.findOne({
        consultation: existingPending._id,
        status: 'ongoing',
      });

      if (activeOngoingSession) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'You already have an ongoing call request with this consultant.',
        );
      }

      // If the pending request was created more than 45 seconds ago (or disconnected/stale),
      // auto-cancel the orphaned pending request so user isn't stuck
      const isStale = existingPending.createdAt
        ? Date.now() - new Date(existingPending.createdAt).getTime() > 45 * 1000
        : false;
      if (isStale) {
        await Consultation.findByIdAndUpdate(existingPending._id, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'superseded_by_new_call',
        });
        await VideoSession.updateMany(
          { consultation: existingPending._id, status: 'pending' },
          { status: 'cancelled' },
        );
      } else {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'You already have an ongoing call request with this consultant.',
        );
      }
    }

    // Check if consultant is busy with anyone else
    const busyConsultant = await Consultation.findOne({
      consultant: new mongoose.Types.ObjectId(consultantId),
      user: { $ne: new mongoose.Types.ObjectId(userId) },
      $or: [
        { status: 'ongoing' },
        {
          bookingType: 'instant',
          status: { $in: ['pending', 'accepted', 'confirmed'] },
          createdAt: { $gte: staleThreshold },
        },
      ],
    });

    if (busyConsultant) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'Consultant is currently busy on another call',
      );
    }

    // Instant booking: starts as pending
    const instantBookingData: any = {
      user: new mongoose.Types.ObjectId(userId),
      consultant: new mongoose.Types.ObjectId(consultantId),
      bookingType: 'instant',
      status: 'pending',
      paymentStatus: 'pending',
      perMinuteRate,
      platformFee,
    };
    if (notes) instantBookingData.notes = notes;

    const consultation = await Consultation.create(instantBookingData);

    const client = await User.findById(userId).select('name');
    const clientName = client?.name || 'A user';

    await NotificationService.sendNotification({
      user: consultantId,
      title: 'Incoming Instant Call',
      message: `${clientName} is requesting an instant consultation right now.`,
      type: 'INSTANT_CALL_REQUEST',
      relatedBooking: consultation._id.toString(),
      metadata: {
        userName: clientName,
        bookingType: 'instant',
      },
    });

    // Delegate to VideoSessionService to handle session creation, token, and signaling
    const session = await VideoSessionService.createSession(
      user,
      consultation._id.toString(),
    );

    return { consultation, session };
  } else if (bookingType === 'callback') {
    if (!preferredWindow) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Preferred window is required for callback request',
      );
    }

    // Callback request: starts as pending
    const callbackBookingData: any = {
      user: new mongoose.Types.ObjectId(userId),
      consultant: new mongoose.Types.ObjectId(consultantId),
      bookingType: 'callback',
      preferredWindow,
      status: 'pending',
      paymentStatus: 'pending',
      perMinuteRate,
      platformFee,
    };
    if (notes) callbackBookingData.notes = notes;

    const result = await Consultation.create(callbackBookingData);

    const client = await User.findById(userId).select('name');
    const clientName = client?.name || 'A user';

    await NotificationService.sendNotification({
      user: consultantId,
      title: 'New Callback Request',
      message: `${clientName} has requested a callback (${preferredWindow}).`,
      type: 'NEW_BOOKING_REQUEST',
      relatedBooking: result._id.toString(),
      metadata: {
        userName: clientName,
        bookingType: 'callback',
      },
    });

    return { consultation: result, session: null };
  }
};

const getMyBookings = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const filter: Record<string, any> = {};
  if (user.role === 'USER') {
    filter.user = new mongoose.Types.ObjectId(user.id);
  } else if (user.role === 'CONSULTANT') {
    filter.consultant = new mongoose.Types.ObjectId(user.id);
  }

  const bookingQuery = new QueryBuilder(Consultation.find(filter), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  // Ensure user and consultant fields are always selected for population
  bookingQuery.modelQuery.select('user consultant');

  const resultList = await bookingQuery.modelQuery.populate([
    { path: 'user', select: 'name image avatar email' },
    { 
      path: 'consultant', 
      select: 'name image avatar email tags consultancyType',
      populate: { path: 'consultancyType' }
    },
    { path: 'report', select: '_id pdfUrl createdAt' },
  ]);
  const meta = await bookingQuery.getPaginationInfo();

  // Fetch reviews for these bookings to add isReviewed flag
  const bookingIds = resultList.map(b => b._id);
  const reviews = await Review.find({ consultation: { $in: bookingIds } }).select('consultation');
  const reviewedBookingIds = new Set(reviews.map(r => r.consultation.toString()));

  const result = resultList.map(b => {
    const obj = b.toObject() as any;
    obj.isReviewed = reviewedBookingIds.has(b._id.toString());
    return obj;
  });

  return { result, meta };
};

const getMyAppointments = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const filter: Record<string, any> = {};

  // 1. Role-aware filtering
  if (user.role === 'USER') {
    filter.user = new mongoose.Types.ObjectId(user.id);
  } else if (user.role === 'CONSULTANT') {
    filter.consultant = new mongoose.Types.ObjectId(user.id);
  }

  // Clone query to avoid mutating original and prevent QueryBuilder from querying unmapped keys
  const queryObj = { ...query };

  // 2. Status & Tab handling (Defaults to upcoming/active, excludes completed/done sessions)
  const tab = queryObj.tab as string;
  delete queryObj.tab;

  if (queryObj.status) {
    const statuses = (queryObj.status as string)
      .split(',')
      .map(s => s.trim());
    if (statuses.length === 1) {
      filter.status = statuses[0];
    } else {
      filter.status = { $in: statuses };
    }
    delete queryObj.status;
  } else if (tab === 'history') {
    filter.status = { $in: ['completed', 'cancelled', 'rejected', 'expired'] };
  } else if (tab === 'requests') {
    filter.status = 'pending';
  } else if (tab === 'all') {
    // No status constraint
  } else {
    // Default (e.g. upcoming bookings): ONLY active/upcoming bookings
    filter.status = { $in: ['pending', 'accepted', 'confirmed'] };
  }

  // 3. Booking Type handling
  if (queryObj.bookingType) {
    const types = (queryObj.bookingType as string)
      .split(',')
      .map(t => t.trim());
    if (types.length === 1) {
      filter.bookingType = types[0];
    } else {
      filter.bookingType = { $in: types };
    }
    delete queryObj.bookingType;
  } else if (tab === 'history') {
    // In History view: include all past consultation types (instant, scheduled, callback)
    filter.bookingType = { $in: ['scheduled', 'callback', 'instant'] };
  } else {
    // In Upcoming/Appointments view: only scheduled and callback are upcoming appointments
    filter.bookingType = { $in: ['scheduled', 'callback'] };
  }

  const bookingQuery = new QueryBuilder(Consultation.find(filter), queryObj)
    .filter()
    .sort()
    .paginate()
    .fields();

  // Ensure user and consultant fields are always selected for population
  bookingQuery.modelQuery.select('user consultant');

  const resultList = await bookingQuery.modelQuery.populate([
    { path: 'user', select: 'name image avatar email' },
    {
      path: 'consultant',
      select: 'name image avatar email tags consultancyType perMinuteRate rating',
      populate: { path: 'consultancyType' },
    },
    { path: 'report', select: '_id pdfUrl createdAt' },
  ]);
  const meta = await bookingQuery.getPaginationInfo();

  // Fetch reviews for these bookings to add isReviewed flag
  const bookingIds = resultList.map(b => b._id);
  const reviews = await Review.find({
    consultation: { $in: bookingIds },
  }).select('consultation');
  const reviewedBookingIds = new Set(
    reviews.map(r => r.consultation.toString()),
  );

  const result = resultList.map(b => {
    const obj = b.toObject() as any;
    obj.isReviewed = reviewedBookingIds.has(b._id.toString());

    // Helper UI action flags
    const isPending = obj.status === 'pending';
    const isActiveOrPending = ['pending', 'accepted', 'confirmed'].includes(
      obj.status,
    );

    obj.canAccept = user.role === 'CONSULTANT' && isPending;
    obj.canReject = user.role === 'CONSULTANT' && isPending;
    obj.canReschedule =
      obj.bookingType === 'scheduled' &&
      isActiveOrPending &&
      user.role === 'USER';
    obj.canCancel = isActiveOrPending;
    obj.canInitiateCallback =
      user.role === 'CONSULTANT' &&
      obj.bookingType === 'callback' &&
      ['pending', 'accepted'].includes(obj.status);

    return obj;
  });

  return { result, meta };
};

const updateBookingStatus = async (
  user: JwtPayload,
  bookingId: string,
  payload: {
    status:
      | 'pending'
      | 'accepted'
      | 'rejected'
      | 'confirmed'
      | 'completed'
      | 'cancelled'
      | 'expired';
    date?: string;
    startTime?: string;
    endTime?: string;
  },
) => {
  const { status, date, startTime, endTime } = payload;

  let resolvedBookingId = bookingId;
  let booking = await Consultation.findById(bookingId);
  if (!booking) {
    // Check if the provided ID is actually a VideoSession ID
    const sessionDoc = await VideoSession.findById(bookingId);
    if (sessionDoc && sessionDoc.consultation) {
      booking = await Consultation.findById(sessionDoc.consultation);
      if (booking) {
        resolvedBookingId = sessionDoc.consultation.toString();
      }
    }
  }

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');
  }

  // Prevent updating if booking is already cancelled or completed
  if (['cancelled', 'completed', 'expired'].includes(booking.status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot update status. Booking is already ${booking.status}`,
    );
  }

  // Authorization: Only consultant or admin can update status
  if (
    user.role !== 'CONSULTANT' &&
    user.role !== 'ADMIN' &&
    user.role !== 'SUPER_ADMIN'
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You do not have permission to update booking status',
    );
  }

  // Re-verify availability if the consultant is accepting a scheduled booking
  if (status === 'accepted' && booking.bookingType === 'scheduled') {
    const slotDate = new Date(booking.date!);
    slotDate.setHours(0, 0, 0, 0);

    // 1. Check if slot is marked as UNAVAILABLE by consultant
    const isUnavailable = await Availability.findOne({
      consultant: booking.consultant,
      slots: {
        $elemMatch: {
          date: slotDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      },
    });

    if (isUnavailable) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'This slot is now marked unavailable. Cannot accept booking.',
      );
    }

    // 2. Check if slot is ALREADY BOOKED by another confirmed booking
    const overlappingBooking = await Consultation.findOne({
      consultant: booking.consultant,
      date: slotDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: { $in: ['accepted', 'confirmed', 'completed'] },
      _id: { $ne: booking._id },
    });

    if (overlappingBooking) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'This slot is already occupied by another confirmed booking.',
      );
    }
  }

  // Additional logic for callback or instant bookings
  // Map 'accepted' to 'confirmed' as per requirement
  const updateData: any = {
    status: status === 'accepted' ? 'confirmed' : status,
  };
  if (date) updateData.date = new Date(date);
  if (startTime) updateData.startTime = startTime;
  if (endTime) updateData.endTime = endTime;

  const result = await Consultation.findByIdAndUpdate(
    resolvedBookingId,
    updateData,
    {
      new: true,
    },
  ).populate('consultant');

  // If instant booking is accepted, also transition any pending video session
  if (status === 'accepted' && booking.bookingType === 'instant') {
    await VideoSession.findOneAndUpdate(
      { consultation: resolvedBookingId, status: 'pending' },
      { status: 'ongoing', startedAt: new Date() },
    );
  }

  // If booking is rejected or cancelled, end any pending video session and notify client immediately
  if ((status === 'rejected' || status === 'cancelled') && result && result.user) {
    const pendingSession = await VideoSession.findOneAndUpdate(
      { consultation: resolvedBookingId, status: 'pending' },
      { status: 'ended', endedAt: new Date(), duration: 0 },
      { new: true },
    );

    if (pendingSession) {
      const eventName = status === 'rejected' ? 'call-rejected' : 'call-cancelled';
      socketHelper.emitToUser(result.user.toString(), eventName, {
        sessionId: pendingSession._id.toString(),
        consultationId: result._id.toString(),
        bookingId: result._id.toString(),
      });
      socketHelper.emitToRoom(`consultation:${result._id}`, eventName, {
        sessionId: pendingSession._id.toString(),
        consultationId: result._id.toString(),
        bookingId: result._id.toString(),
      });
    }
  }

  if (result && status === 'completed' && result.consultant) {
    const consultantId =
      (result.consultant as any)?._id || result.consultant;
    await User.findByIdAndUpdate(consultantId, {
      $inc: { totalConsultations: 1 },
    });
    // Invalidate related caches
    cacheHelper.clearByPrefix('consultants:recommended');
    cacheHelper.clearByPrefix(`consultants:list`);
  }

  if (result && (status === 'accepted' || status === 'rejected')) {
    const consultantObj = result.consultant as any;
    const consultantName = consultantObj?.name || 'Your Consultant';
    const dateStr = result.date
      ? new Date(result.date).toLocaleDateString()
      : '';
    const timeStr = result.startTime || '';

    const message =
      status === 'accepted'
        ? `Your consultation request has been accepted by ${consultantName}.`
        : `Your consultation request has been rejected by ${consultantName}.`;

    if (result.user) {
      await NotificationService.sendNotification({
        user: result.user.toString(),
        title: `Consultation ${status === 'accepted' ? 'Accepted' : 'Rejected'}`,
        message,
        type: 'CONSULTATION_STATUS',
        relatedBooking: result._id.toString(),
        idempotencyKey: `consultation_status_${result._id}_${status}`,
        metadata: {
          consultantName,
          status: status === 'accepted' ? 'accepted' : 'rejected',
          date: dateStr,
          time: timeStr,
        },
      });
    }
  }

  return result;
};

const rescheduleBooking = async (
  user: JwtPayload,
  bookingId: string,
  payload: { date: string; startTime: string; endTime: string },
) => {
  const { date, startTime, endTime } = payload;
  const userId = user.id;

  // 1. Find the existing booking
  const booking = await Consultation.findById(bookingId);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');
  }

  // Check if user is the owner
  if (booking.user.toString() !== userId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Unauthorized access');
  }

  // 2. Validate booking type
  if (booking.bookingType !== 'scheduled') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only scheduled bookings can be rescheduled',
    );
  }

  // 3. Validate 6-hour rule
  const [hours, minutes] = booking.startTime!.split(':').map(Number);
  const bookingDateTime = new Date(booking.date!);
  bookingDateTime.setHours(hours, minutes, 0, 0);

  const now = new Date();
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  if (bookingDateTime < sixHoursLater) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Rescheduling is only allowed at least 6 hours before the scheduled time',
    );
  }

  const newSlotDate = new Date(date);
  newSlotDate.setHours(0, 0, 0, 0);

  // 4. Check if new slot is UNAVAILABLE
  const availability = await Availability.findOne({
    consultant: booking.consultant,
    slots: {
      $elemMatch: {
        date: newSlotDate,
        startTime: startTime,
        endTime: endTime,
      },
    },
  });

  if (availability) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This slot is marked unavailable by the consultant',
    );
  }

  // 5. Check if new slot is ALREADY BOOKED
  const existingBooking = await Consultation.findOne({
    consultant: booking.consultant,
    date: newSlotDate,
    startTime: startTime,
    endTime: endTime,
    status: {
      $in: ['pending', 'accepted', 'confirmed', 'completed'],
    },
    _id: { $ne: booking._id }, // Exclude current booking
  });

  if (existingBooking) {
    throw new ApiError(StatusCodes.CONFLICT, 'This slot is already booked');
  }

  // 6. Update the booking record
  booking.date = newSlotDate;
  booking.startTime = startTime;
  booking.endTime = endTime;
  booking.status = 'pending';

  await booking.save();

  const client = await User.findById(userId).select('name');
  const clientName = client?.name || 'A user';

  await NotificationService.sendNotification({
    user: booking.consultant.toString(),
    title: 'Booking Rescheduled',
    message: `${clientName} has requested to reschedule their consultation to ${newSlotDate.toLocaleDateString()} at ${startTime}.`,
    type: 'BOOKING_RESCHEDULED',
    relatedBooking: booking._id.toString(),
    metadata: {
      userName: clientName,
      newDate: newSlotDate.toLocaleDateString(),
      newTime: startTime,
    },
  });

  return booking;
};

const cancelBooking = async (
  user: JwtPayload,
  bookingId: string,
  payload: { cancelReason?: string },
) => {
  const { cancelReason } = payload;
  const userId = user.id;

  // 1. Find the booking
  const booking = await Consultation.findById(bookingId);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Booking not found');
  }

  // 2. Ownership check
  if (booking.user.toString() !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Only the booking owner can cancel the consultation',
    );
  }

  // 3. Status check: Prevent cancellation of already completed, rejected, or cancelled bookings
  const nonCancellableStatuses = [
    'completed',
    'rejected',
    'cancelled',
    'expired',
  ];
  if (nonCancellableStatuses.includes(booking.status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot cancel a booking that is already ${booking.status}`,
    );
  }

  // 4. 6-hour rule check
  // We only apply this rule to scheduled bookings with a date and time
  if (
    booking.bookingType === 'scheduled' &&
    booking.date &&
    booking.startTime
  ) {
    const [hours, minutes] = booking.startTime.split(':').map(Number);
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    if (bookingDateTime < sixHoursLater) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Cancellation is only allowed at least 6 hours before the scheduled time',
      );
    }
  }

  // 5. Update booking status
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = new mongoose.Types.ObjectId(userId);
  if (cancelReason) {
    booking.cancelReason = cancelReason;
  }

  await booking.save();

  // If there is any associated pending video session, end it and notify consultant
  const pendingSession = await VideoSession.findOneAndUpdate(
    { consultation: booking._id, status: 'pending' },
    { status: 'ended', endedAt: new Date(), duration: 0 },
    { new: true },
  );

  if (pendingSession) {
    socketHelper.emitToUser(
      booking.consultant.toString(),
      'call-cancelled',
      {
        sessionId: pendingSession._id.toString(),
        consultationId: booking._id.toString(),
        bookingId: booking._id.toString(),
      },
    );
  }

  const client = await User.findById(userId).select('name');
  const clientName = client?.name || 'A user';
  const dateStr = booking.date ? new Date(booking.date).toLocaleDateString() : '';

  await NotificationService.sendNotification({
    user: booking.consultant.toString(),
    title: 'Booking Cancelled',
    message: `${clientName} has cancelled their consultation for ${dateStr}.`,
    type: 'BOOKING_CANCELLED',
    relatedBooking: booking._id.toString(),
    metadata: {
      userName: clientName,
      bookingType: booking.bookingType,
    },
  });

  return booking;
};

const initiateCallback = async (user: JwtPayload, bookingId: string) => {
  const consultation = await Consultation.findById(bookingId);
  if (!consultation) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Consultation not found');
  }

  if (consultation.bookingType !== 'callback') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'This booking is not a callback request',
    );
  }

  if (consultation.status !== 'pending' && consultation.status !== 'confirmed') {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot initiate callback for a booking with status: ${consultation.status}`,
    );
  }

  if (consultation.consultant.toString() !== user.id) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'You are not authorized to initiate this callback',
    );
  }

  // Update status to confirmed if it was pending
  if (consultation.status === 'pending') {
    consultation.status = 'confirmed';
    await consultation.save();
  }

  // Delegate to VideoSessionService to handle session creation, token, and signaling
  const session = await VideoSessionService.createSession(
    user,
    consultation._id.toString(),
  );

  return { consultation, session };
};

const getConsultantTotalConsultations = async (consultantId: string) => {
  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(consultantId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid consultant ID');
  }

  const totalConsultations = await Consultation.countDocuments({
    consultant: new mongoose.Types.ObjectId(consultantId),
    status: 'completed',
  });

  return {
    consultantId,
    totalConsultations,
  };
};

export const ConsultationService = {
  setUnavailability,
  getMyUnavailability,
  removeUnavailability,
  getAvailableSlots,
  createBooking,
  getMyBookings,
  getMyAppointments,
  updateBookingStatus,
  getConsultantTotalConsultations,
  rescheduleBooking,
  cancelBooking,
  initiateCallback,
};
