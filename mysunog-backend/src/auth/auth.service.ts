import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

    const payload = { email: user.email, sub: user.id, role: user.role };
    return { access_token: this.jwtService.sign(payload) };
  }
}
