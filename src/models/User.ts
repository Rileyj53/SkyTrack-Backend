import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

// Define the User interface
export interface APIKey {
  key: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt: Date;
}

export interface UserDocument extends Document {
  email: string;
  first_name?: string;
  last_name?: string;
  password: string | null;
  googleId?: string;
  isActive: boolean;
  resetToken?: string;
  resetTokenExpiration?: Date;
  magicToken?: string;
  magicTokenExpiration?: Date;
  magicCode?: string;
  role: string;
  school_id?: mongoose.Types.ObjectId;
  student_id?: mongoose.Types.ObjectId;
  instructor_id?: mongoose.Types.ObjectId;
  failedLoginAttempts: number;
  lastFailedLogin?: Date;
  lockUntil?: Date;
  lastLogin?: Date;
  lastLoginIP?: string;
  passwordChangedAt?: Date;
  passwordResetHistory: Array<{
    changedAt: Date;
    ipAddress: string;
    userAgent: string;
  }>;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  mfaSecret?: string;
  mfaBackupCodes?: Array<{
    code: string;
    used: boolean;
  }>;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Add methods to the interface
  comparePassword(password: string): Promise<boolean>;
  generateMFA(): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
    testToken: string;
  }>;
  verifyMFAToken(token: string): Promise<boolean>;
  generateAPIKey(
    name: string,
    durationValue: number,
    durationType: string
  ): Promise<string>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  trackPasswordChange(ipAddress: string, userAgent: string): Promise<void>;
  isLocked(): boolean;
  disableMFA(): Promise<void>;
}

// User schema
const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    first_name: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    last_name: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long']
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetToken: {
      type: String,
      default: null,
    },
    resetTokenExpiration: {
      type: Date,
      default: null,
    },
    magicToken: {
      type: String,
      default: null,
    },
    magicTokenExpiration: {
      type: Date,
      default: null,
    },
    magicCode: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['sys_admin', 'school_admin', 'instructor', 'student'],
      default: 'student',
    },
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: false,
    },
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false,
    },
    instructor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Instructor',
      required: false,
    },
    // Account lockout fields
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lastFailedLogin: {
      type: Date,
      default: null,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastLoginIP: {
      type: String,
      default: null,
    },
    // Security audit fields
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    passwordResetHistory: [{
      changedAt: Date,
      ipAddress: String,
      userAgent: String,
    }],
    // Email verification fields
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      default: null,
    },
    verificationTokenExpires: {
      type: Date,
      default: null,
    },
    // MFA fields
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaVerified: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false, // Don't include in queries by default
    },
    mfaBackupCodes: [{
      code: {
        type: String,
        select: false,
      },
      used: {
        type: Boolean,
        default: false,
      },
    }],
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Account lockout methods
UserSchema.methods.incrementLoginAttempts = async function() {
  // If lock has expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    await this.updateOne({
      $set: { failedLoginAttempts: 0 },
      $unset: { lockUntil: 1 }
    });
    return;
  }

  // Increment attempts
  const attempts = this.failedLoginAttempts + 1;
  const updates: any = { $set: { failedLoginAttempts: attempts } };

  // Lock the account if max attempts reached
  if (attempts >= 5) {
    updates.$set.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
  }

  await this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = async function() {
  await this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Password change tracking
UserSchema.methods.trackPasswordChange = async function(ipAddress: string, userAgent: string) {
  const now = new Date();
  await this.updateOne({
    $set: {
      passwordChangedAt: now,
      failedLoginAttempts: 0,
      lockUntil: null
    },
    $push: {
      passwordResetHistory: {
        changedAt: now,
        ipAddress,
        userAgent
      }
    }
  });
};

// Add isLocked method implementation
UserSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Password comparison method
UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  console.log(JSON.stringify({
    type: 'password_comparison',
    userId: this._id,
    hasPassword: !!this.password,
    timestamp: new Date().toISOString()
  }));

  if (!this.password) {
    console.warn(JSON.stringify({
      type: 'password_missing',
      userId: this._id,
      timestamp: new Date().toISOString()
    }));
    return false;
  }

  const result = await bcrypt.compare(password, this.password);
  console.log(JSON.stringify({
    type: 'password_comparison_result',
    userId: this._id,
    result,
    timestamp: new Date().toISOString()
  }));
  return result;
};

// Generate MFA method
UserSchema.methods.generateMFA = async function(): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
  testToken: string;
}> {
  try {
    // Generate a secret
    const secret = speakeasy.generateSecret({
      name: this.email,
      issuer: 'Personal Site Backend'
    });
    
    // Store the secret
    this.mfaSecret = secret.base32;
    
    // Log the secret for debugging (with redaction)
    console.log(JSON.stringify({
      type: 'mfa_secret_generated',
      userId: this._id,
      secretLength: secret.base32.length,
      timestamp: new Date().toISOString()
    }));
    
    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push({
        code: speakeasy.generateSecret({ length: 10 }).base32.slice(0, 8),
        used: false
      });
    }
    this.mfaBackupCodes = backupCodes;
    
    // Enable MFA but don't verify yet
    this.mfaEnabled = true;
    this.mfaVerified = false;
    
    // Save the user with the new MFA data
    await this.save();
    
    // Manually construct the otpauth URL to ensure it uses the exact same secret
    const encodedEmail = encodeURIComponent(this.email);
    const encodedIssuer = encodeURIComponent('Personal Site Backend');
    const otpauthUrl = `otpauth://totp/${encodedEmail}?secret=${this.mfaSecret}&issuer=${encodedIssuer}`;
    
    console.log(JSON.stringify({
      type: 'mfa_otpauth_generated',
      userId: this._id,
      timestamp: new Date().toISOString()
    }));
    
    // Generate QR code as data URL with proper options
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    // Generate a test token to verify the secret works
    const testToken = speakeasy.totp({
      secret: this.mfaSecret,
      encoding: 'base32'
    });
    
    console.log(JSON.stringify({
      type: 'mfa_test_token_generated',
      userId: this._id,
      timestamp: new Date().toISOString()
    }));
    
    return {
      qrCode: qrCodeDataUrl.split(',')[1], // Return only the base64 part
      backupCodes: backupCodes.map(bc => bc.code),
      secret: this.mfaSecret,
      testToken
    };
  } catch (error) {
    console.error(JSON.stringify({
      type: 'mfa_generation_error',
      userId: this._id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    throw error;
  }
};

// Verify MFA token method
UserSchema.methods.verifyMFAToken = async function(token: string): Promise<boolean> {
  try {
    // Ensure token is a string
    token = token.toString().trim();
    
    console.log(JSON.stringify({
      type: 'mfa_token_verification',
      userId: this._id,
      tokenLength: token.length,
      tokenType: typeof token,
      isDigits: /^\d+$/.test(token),
      hasMfaSecret: !!this.mfaSecret,
      backupCodesCount: this.mfaBackupCodes ? this.mfaBackupCodes.length : 0,
      timestamp: new Date().toISOString()
    }));
    
    // Ensure we have the MFA secret
    if (!this.mfaSecret) {
      console.error(JSON.stringify({
        type: 'mfa_secret_missing',
        userId: this._id,
        timestamp: new Date().toISOString()
      }));
      return false;
    }
    
    // First check if it's a backup code
    if (this.mfaBackupCodes && this.mfaBackupCodes.length > 0) {
      const backupCode = this.mfaBackupCodes.find(bc => bc.code === token && !bc.used);
      if (backupCode) {
        console.log(JSON.stringify({
          type: 'mfa_backup_code_used',
          userId: this._id,
          timestamp: new Date().toISOString()
        }));
        // Mark the backup code as used
        backupCode.used = true;
        await this.save();
        return true;
      }
    }
    
    // Generate a token for the current time to compare
    const currentToken = speakeasy.totp({
      secret: this.mfaSecret,
      encoding: 'base32'
    });
    
    const isValid = token === currentToken;
    console.log(JSON.stringify({
      type: 'mfa_token_verification_result',
      userId: this._id,
      isValid,
      timestamp: new Date().toISOString()
    }));
    
    return isValid;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'mfa_verification_error',
      userId: this._id,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    return false;
  }
};

// Disable MFA method
UserSchema.methods.disableMFA = async function() {
  this.mfaEnabled = false;
  this.mfaVerified = false;
  this.mfaSecret = undefined;
  this.mfaBackupCodes = undefined;
  await this.save();
};

// Generate API key method
UserSchema.methods.generateAPIKey = async function(
  name: string,
  durationValue: number,
  durationType: string
): Promise<string> {
  try {
    // Generate a random API key using Web Crypto API
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const apiKey = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Hash the API key for storage using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedApiKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Calculate expiration date
    const now = new Date();
    let expiresAt: Date;
    
    switch (durationType) {
      case 'days':
        expiresAt = new Date(now.setDate(now.getDate() + durationValue));
        break;
      case 'weeks':
        expiresAt = new Date(now.setDate(now.getDate() + durationValue * 7));
        break;
      case 'months':
        expiresAt = new Date(now.setMonth(now.getMonth() + durationValue));
        break;
      case 'years':
        expiresAt = new Date(now.setFullYear(now.getFullYear() + durationValue));
        break;
      default:
        expiresAt = new Date(now.setDate(now.getDate() + 30)); // Default to 30 days
    }
    
    // Add the API key to the user's API keys
    if (!this.apiKeys) {
      this.apiKeys = [];
    }
    
    this.apiKeys.push({
      key: hashedApiKey,
      name,
      createdAt: new Date(),
      expiresAt,
      lastUsed: null
    });
    
    await this.save();
    
    return apiKey;
  } catch (error) {
    console.error('Error generating API key:', error);
    throw error;
  }
};

// Register the User model with Mongoose
export const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema); 