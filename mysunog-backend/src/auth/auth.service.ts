import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SmsAlertsService } from '../sms-alerts/sms-alerts.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private smsAlertsService: SmsAlertsService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Block deactivated accounts
    if (user.isActive === false) {
      throw new ForbiddenException(
        'Your account has been deactivated. Please contact the BFP administrator.',
      );
    }

    if (user.requiresOtp) {
      if (!user.phone) {
        throw new ForbiddenException('Your account requires an OTP, but no phone number is configured. Please contact the administrator.');
      }
      
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random code
      const otpExpiresAt = new Date();
      otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);

      user.otpCode = otpCode;
      user.otpExpiresAt = otpExpiresAt;
      await this.usersService.save(user);

      await this.smsAlertsService.sendOtp(user.phone, otpCode);

      return { requiresOtp: true, userId: user.id, message: 'OTP sent to your registered phone number.' };
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }

  async verifyOtp(userId: number, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.requiresOtp) {
      throw new UnauthorizedException('OTP is not required for this user');
    }

    if (user.otpCode !== code) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP code has expired');
    }

    // Clear the OTP fields
    user.otpCode = null;
    user.otpExpiresAt = null;
    await this.usersService.save(user);

    const payload = { email: user.email, sub: user.id, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }
}
