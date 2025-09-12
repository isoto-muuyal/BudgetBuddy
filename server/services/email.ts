import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import { config } from "../config";

export class EmailService {
  private mailerSend: MailerSend;
  private sender: Sender;

  constructor() {
    this.mailerSend = new MailerSend({
      apiKey: config.mailersend.apiKey,
    });

    this.sender = new Sender(config.mailersend.fromEmail, config.mailersend.fromName);
  }

  async sendVerificationEmail(email: string, fullName: string, verificationToken: string) {
    const recipient = new Recipient(email, fullName);
    
    const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:5001"}/verify-email?token=${verificationToken}`;

    const emailParams = new EmailParams()
      .setFrom(this.sender)
      .setTo([recipient])
      .setSubject("Verify Your BudgetWise Account")
      .setHtml(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(to right, #3B82F6, #8B5CF6); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to BudgetWise!</h1>
          </div>
          
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #374151;">Hi ${fullName},</h2>
            
            <p style="color: #6b7280; line-height: 1.6;">
              Thank you for signing up for BudgetWise! To complete your registration and start managing your finances with the 50/30/20 rule, please verify your email address.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(to right, #3B82F6, #8B5CF6); 
                        color: white; 
                        padding: 12px 24px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block;
                        font-weight: 600;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #6b7280; line-height: 1.6; font-size: 14px;">
              If the button doesn't work, you can copy and paste this link into your browser:
              <br>
              <a href="${verificationUrl}" style="color: #3B82F6;">${verificationUrl}</a>
            </p>
            
            <p style="color: #6b7280; line-height: 1.6; font-size: 14px;">
              This verification link will expire in 24 hours. If you didn't sign up for BudgetWise, you can safely ignore this email.
            </p>
          </div>
          
          <div style="background: #374151; padding: 20px; text-align: center;">
            <p style="color: #9ca3af; margin: 0; font-size: 14px;">
              © 2025 BudgetWise. All rights reserved.
            </p>
          </div>
        </div>
      `)
      .setText(`
        Welcome to BudgetWise!
        
        Hi ${fullName},
        
        Thank you for signing up for BudgetWise! To complete your registration and start managing your finances with the 50/30/20 rule, please verify your email address by clicking the following link:
        
        ${verificationUrl}
        
        This verification link will expire in 24 hours. If you didn't sign up for BudgetWise, you can safely ignore this email.
        
        Best regards,
        The BudgetWise Team
      `);

    try {
      const response = await this.mailerSend.email.send(emailParams);
      console.log("Verification email sent successfully:", response);
      return response;
    } catch (error) {
      console.error("Failed to send verification email:", error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
