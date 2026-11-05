import { User } from '../app/modules/user/user.model';
import config from '../config';
import { USER_ROLES } from '../enums/user';
import { logger } from '../shared/logger';

export const seedSuperAdmin = async () => {
  const targetEmail =
    config.super_admin.email &&
    config.super_admin.email !== 'shakayet.dev@gmail.com'
      ? config.super_admin.email
      : 'fixpair@outlook.com';

  const isExistSuperAdmin = await User.findOne({
    role: USER_ROLES.SUPER_ADMIN,
  });

  if (isExistSuperAdmin) {
    if (isExistSuperAdmin.email !== targetEmail) {
      await User.updateOne(
        { role: USER_ROLES.SUPER_ADMIN },
        { $set: { email: targetEmail } }
      );
      logger.info(`✨ Super Admin email successfully updated to ${targetEmail}`);
    }
  } else {
    await User.create({
      name: 'Administrator',
      email: targetEmail,
      role: USER_ROLES.SUPER_ADMIN,
      password: config.super_admin.password || '12345678',
      verified: true,
    });
    logger.info(`✨ Super Admin account created with email: ${targetEmail}`);
  }
};
