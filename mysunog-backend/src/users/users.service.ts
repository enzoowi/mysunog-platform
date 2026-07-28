import { Injectable, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userData: Partial<User>) {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async createUserByAdmin(userData: Partial<User>) {
    if (!userData.email || !userData.password) {
      throw new ConflictException('Email and password are required');
    }
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = this.usersRepository.create({
      ...userData,
      password: hashedPassword,
      isVerified: true,
    });
    return this.usersRepository.save(user);
  }

  async save(user: User) {
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAllAdmins() {
    return this.usersRepository.find({ where: { role: UserRole.ADMIN } });
  }

  async findAdminsAndBfp() {
    return this.usersRepository.find({
      where: [{ role: UserRole.ADMIN }, { role: UserRole.BFP_STAFF }],
    });
  }

  /** Admin: get all ACTIVE users (for Manage Users page) */
  async findAll() {
    return this.usersRepository.find({
      where: { isActive: true },
      select: [
        'id', 'email', 'firstName', 'middleName', 'lastName',
        'role', 'isVerified', 'barangay', 'phone',
        'passwordResetRequested', 'passwordResetRequestedAt', 'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin: get all DEACTIVATED users */
  async findAllDeactivated() {
    return this.usersRepository.find({
      where: { isActive: false },
      select: [
        'id', 'email', 'firstName', 'middleName', 'lastName',
        'role', 'isVerified', 'deactivatedAt', 'createdAt',
      ],
      order: { deactivatedAt: 'DESC' },
    });
  }

  /** Admin updates a user's role */
  async updateRole(id: number, role: UserRole) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) return null;
    user.role = role;
    return this.usersRepository.save(user);
  }

  /** Admin deactivates a user account */
  async deactivateUser(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) throw new Error('Cannot deactivate an admin account');
    user.isActive = false;
    user.deactivatedAt = new Date();
    return this.usersRepository.save(user);
  }

  /** Admin reactivates a previously deactivated account */
  async reactivateUser(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = true;
    user.deactivatedAt = undefined;
    return this.usersRepository.save(user);
  }

  /** Admin completely deletes a user account */
  async deleteUser(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) throw new Error('Cannot delete an admin account');
    await this.usersRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  /** User submits a forgot-password request */
  async requestPasswordReset(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) return { message: 'If this email is registered, your request has been submitted.' };
    user.passwordResetRequested = true;
    user.passwordResetRequestedAt = new Date();
    await this.usersRepository.save(user);

    // Notify admins
    const admins = await this.findAllAdmins();
    for (const admin of admins) {
      await this.notificationsService.createNotification(
        admin,
        'Password Reset Requested',
        `User ${user.email} has requested a password reset.`,
        'general',
        '/admin/users'
      );
    }

    return { message: 'If this email is registered, your request has been submitted.' };
  }

  /** Admin resets a user's password to a random temporary one and returns it */
  async resetPasswordByAdmin(id: number) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 10 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');

    user.password = await bcrypt.hash(tempPassword, 10);
    user.passwordResetRequested = false;
    user.passwordResetRequestedAt = undefined;
    await this.usersRepository.save(user);

    // Instead of emailing, return the temp password to the admin
    return { 
      message: `Password reset successfully for ${user.email}`,
      tempPassword 
    };
  }

  /** Logged-in user changes their own password */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.password) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) throw new UnauthorizedException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);
    return { message: 'Password changed successfully' };
  }
}
