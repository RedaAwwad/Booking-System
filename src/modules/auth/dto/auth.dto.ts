import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, MinLength } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class SignupDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  password: string;

  @IsNotEmpty()
  @IsString()
  @Match('password')
  passwordConfirmation: string;
}

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  @Match('newPassword')
  newPasswordConfirmation: string;
}

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  @Match('newPassword')
  newPasswordConfirmation: string;
}

export class SendVerificationEmailDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
