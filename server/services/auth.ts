import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { config } from "../config";
import { storage } from "../storage";
import { emailService } from "./email";
import type { SignupUser, LoginUser } from "@shared/schema";

export class AuthService {
  async signup(userData: SignupUser) {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
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

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, user.fullName, verificationToken);
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Don't fail signup if email fails
    }

    return { 
      message: "Account created successfully. Please check your email for verification.",
      userId: user.id 
    };
  }

  async login(loginData: LoginUser) {
    const user = await storage.getUserByEmail(loginData.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(loginData.password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT token
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
        emailVerified: user.emailVerified,
      },
    };
  }

  async verifyEmail(token: string) {
    const user = await storage.getUserByVerificationToken(token);
    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    await storage.verifyUserEmail(user.id);
    
    return { message: "Email verified successfully" };
  }
}

export const authService = new AuthService();
