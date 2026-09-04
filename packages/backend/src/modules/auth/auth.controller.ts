import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsEmail, IsString, MinLength } from "class-validator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AppAuthGuard } from "../../common/guards/app-auth.guard";
import { AuthService } from "./auth.service";

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private service: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.service.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(AppAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post("logout")
  @UseGuards(AppAuthGuard)
  logout(@Req() request: { authSessionId: string }) {
    return this.service.logout(request.authSessionId);
  }

  @Post("change-password")
  @UseGuards(AppAuthGuard)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto) {
    return this.service.changePassword(user.id, body.currentPassword, body.newPassword);
  }
}
