import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { config } from "../config";
import { storage } from "../storage";
import { emailService } from "./email";
import { logger } from "./logger";
import type { SignupUser, LoginUser, ForgotPasswordInput, ResetPasswordInput } from "@shared/schema";

const PASSWORD_RESET_TOKEN_TTL_MS = 20 * 60 * 1000;

export class AuthService {
  buildAuthResponse(user: {
    id: string;
    email: string;
    fullName: string;
    monthlyIncome: string | null;
    emailVerified: boolean | null;
    frozen?: boolean | null;
    forcePasswordChange?: boolean | null;
  }) {
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        monthlyIncome: user.monthlyIncome,
        emailVerified: !!user.emailVerified,
        forcePasswordChange: !!user.forcePasswordChange,
      },
    };
  }

  async signup(userData: SignupUser, traceId?: string) {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      logger.warn("Signup rejected: email already registered", { traceId, email: userData.email });
      throw new Error("User already exists with this email");
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    // Generate verification token
    const verificationToken = randomBytes(32).toString("hex");

    // Create user
    const user = await storage.createUser({
      ...userData,
      password: hashedPassword,
      verificationToken,
    });

    // Non-sensitive: helps correlate against later login attempts if a user
    // reports "correct password" being rejected (e.g. mobile autofill/autocorrect
    // mangling what actually gets submitted).
    logger.info("Signup succeeded", {
      traceId,
      userId: user.id,
      email: user.email,
      credentialLength: userData.password.length,
      hashPrefix: hashedPassword.slice(0, 7),
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, user.fullName, verificationToken);
    } catch (error) {
      logger.error("Failed to send verification email", {
        traceId,
        userId: user.id,
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail signup if email fails
    }

    return {
      message: "Account created successfully. Please check your email for verification.",
      userId: user.id
    };
  }

  async completeLogin(
    user: {
      id: string;
      email: string;
      fullName: string;
      monthlyIncome: string | null;
      emailVerified: boolean | null;
      frozen?: boolean | null;
      forcePasswordChange?: boolean | null;
    },
    traceId?: string
  ) {
    if (user.frozen) {
      logger.warn("Login rejected: account frozen", { traceId, userId: user.id, email: user.email });
      throw new Error("This account has been frozen. Please contact support.");
    }

    await storage.recordLogin(user.id);
    logger.info("Login succeeded", { traceId, userId: user.id, email: user.email });
    return this.buildAuthResponse(user);
  }

  async login(loginData: LoginUser, traceId?: string) {
    const user = await storage.getUserByEmail(loginData.email);
    if (!user) {
      logger.warn("Login failed: no account for email", {
        traceId,
        email: loginData.email,
        credentialLength: loginData.password.length,
      });
      throw new Error("Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(loginData.password, user.password);
    if (isValidPassword) {
      return this.completeLogin(user, traceId);
    }

    const isValidTemporaryPassword = user.temporaryPasswordHash
      ? await bcrypt.compare(loginData.password, user.temporaryPasswordHash)
      : false;
    if (!isValidTemporaryPassword) {
      // Non-sensitive diagnostics only: never log the raw password or hash.
      // credentialLength/hashPrefix let us tell apart "user is mistyping/autofill
      // is mangling the password" from "stored hash looks malformed" without
      // exposing any secret material.
      logger.warn("Login failed: password did not match stored or temporary hash", {
        traceId,
        userId: user.id,
        email: user.email,
        emailVerified: !!user.emailVerified,
        frozen: !!user.frozen,
        mustChangeCredential: !!user.forcePasswordChange,
        hasTemporaryCredential: !!user.temporaryPasswordHash,
        temporaryCredentialUsedAt: user.temporaryPasswordUsedAt,
        credentialLength: loginData.password.length,
        storedHashPrefix: user.password.slice(0, 7),
      });
      throw new Error("Invalid email or password");
    }

    await storage.consumeTemporaryPassword(user.id);
    await storage.recordLogin(user.id);
    logger.info("Login succeeded via temporary password", { traceId, userId: user.id, email: user.email });
    return this.buildAuthResponse({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      monthlyIncome: user.monthlyIncome,
      emailVerified: user.emailVerified,
      frozen: user.frozen,
      forcePasswordChange: true,
    });
  }

  async verifyEmail(token: string) {
    const user = await storage.getUserByVerificationToken(token);
    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    await storage.verifyUserEmail(user.id);
    
    return { message: "Email verified successfully" };
  }

  private async sendPasswordResetForUser(user: { id: string; email: string; fullName: string }) {
    const resetToken = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await storage.setPasswordResetToken(user.id, resetToken, expiry);
    await emailService.sendPasswordResetEmail(user.email, user.fullName, resetToken);
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const user = await storage.getUserByEmail(data.email);
    if (!user) {
      return { message: "If an account exists with this email, you will receive a password reset link." };
    }

    try {
      await this.sendPasswordResetForUser(user);
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }

    return { message: "If an account exists with this email, you will receive a password reset link." };
  }

  async sendPasswordResetByAdmin(userId: string) {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await this.sendPasswordResetForUser(user);

    return { message: `Password reset link sent to ${user.email}` };
  }

  async generateTemporaryPasswordByAdmin(userId: string) {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const temporaryPassword = randomBytes(9).toString("base64url");
    const temporaryPasswordHash = await bcrypt.hash(temporaryPassword, 12);
    await storage.setTemporaryPassword(user.id, temporaryPasswordHash);

    return {
      message: `Temporary password generated for ${user.email}`,
      temporaryPassword,
    };
  }

  async completeForcedPasswordChange(userId: string, newPassword: string) {
    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await storage.completeForcedPasswordChange(userId, hashedPassword);

    return { message: "Password updated successfully" };
  }

  async resetPassword(data: ResetPasswordInput) {
    const user = await storage.getUserByPasswordResetToken(data.token);
    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    if (user.passwordResetExpiry && new Date() > new Date(user.passwordResetExpiry)) {
      throw new Error("Reset token has expired");
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(data.newPassword, saltRounds);

    await storage.resetPassword(user.id, hashedPassword);

    return { message: "Password reset successfully" };
  }
}

export const authService = new AuthService();
