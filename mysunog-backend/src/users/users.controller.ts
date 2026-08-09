import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UserRole } from './user.entity';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  /** Admin: create a new user (admin or bfp_staff) */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin-create')
  adminCreateUser(@Body() body: any) {
    return this.usersService.createUserByAdmin({
      email: body.email,
      password: body.password,
      role: body.role,
      firstName: body.firstName,
      lastName: body.lastName,
    });
  }

  /** Admin: get all active users for the Manage Users page */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('all')
  getAllUsers() {
    return this.usersService.findAll();
  }

  /** Admin: get all deactivated users */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('deactivated')
  getDeactivatedUsers() {
    return this.usersService.findAllDeactivated();
  }

  /** Admin: update a user's role */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.usersService.updateRole(Number(id), role);
  }

  /** Admin: update a user's phone */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/phone')
  updatePhone(@Param('id') id: string, @Body('phone') phone: string) {
    return this.usersService.updatePhone(Number(id), phone);
  }

  /** Admin: update a user's otp requirement */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/otp-requirement')
  toggleOtp(@Param('id') id: string, @Body('requiresOtp') requiresOtp: boolean) {
    return this.usersService.toggleOtp(Number(id), requiresOtp);
  }

  /** Admin: deactivate a user account */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(Number(id));
  }

  /** Admin: reactivate a previously deactivated account */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/reactivate')
  reactivateUser(@Param('id') id: string) {
    return this.usersService.reactivateUser(Number(id));
  }

  /** Admin: completely delete a user account */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(Number(id));
  }

  /** Admin: reset a user's password and send temp password via email */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reset-password')
  resetPasswordByAdmin(@Param('id') id: string) {
    return this.usersService.resetPasswordByAdmin(Number(id));
  }

  /** Public: user submits a forgot-password request */
  @Post('forgot-password')
  requestPasswordReset(@Body('email') email: string) {
    return this.usersService.requestPasswordReset(email);
  }

  /** Authenticated: logged-in user changes their own password */
  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  changePassword(
    @Req() req: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.usersService.changePassword(req.user.userId, currentPassword, newPassword);
  }
}
