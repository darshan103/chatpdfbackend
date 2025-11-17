import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";
import User from "../models/User.js";
import { sendMail } from "../utils/email.js";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import Googleuser from "../models/Googleuser.js";

const VERIFICATION_TOKEN_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 hours

// --------------------- SIGNUP ---------------------
export const signup = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: "Invalid email format." });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        // Check existing user
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(409).json({ message: "Email already in use." });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);

        // Create verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpires = Date.now() + VERIFICATION_TOKEN_EXPIRE_MS;

        const user = new User({
            name,
            email,
            password: hashed,
            verificationToken,
            verificationTokenExpires,
        });

        await user.save();

        // Send verification email
        const verifyUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

        const html = `
            <p>Hello ${name || ""},</p>
            <p>Thank you for signing up. Click the link below to verify your email address:</p>
            <p><a href="${verifyUrl}">Verify email</a></p>
            <p>If you didn't sign up, ignore this email.</p>
        `;

        try {
            await sendMail({ to: email, subject: "Verify your email", html });
        } catch (mailErr) {
            console.error("Failed sending verification email", mailErr);
        }

        return res.status(201).json({ message: "User created. Check your email for verification." });
    } catch (err) {
        next(err);
    }
};

// ------------------- GOOGLE LOGIN -------------------
export const googleLogin = async (req, res) => {
    try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: "No token provided" });
        }

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub, email_verified } = payload;

        if (!email_verified) {
            return res.status(403).json({ message: "Google email not verified" });
        }

        // Find or create user
        let user = await Googleuser.findOne({ email });
        if (!user) {
            user = await Googleuser.create({
                name,
                email,
                googleId: sub,
                avatar: picture,
            });
        }

        // Create our JWT
        const accessToken = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({ token: accessToken, user });
    } catch (err) {
        console.error("Google login error:", err);
        return res.status(500).json({ message: "Google login failed" });
    }
};

// -------------------- VERIFY EMAIL --------------------
export const verifyEmail = async (req, res, next) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.status(400).json({ message: "Missing token or email." });
        }

        const user = await User.findOne({ email, verificationToken: token });
        if (!user) {
            return res.status(400).json({ message: "Invalid token or email." });
        }

        if (user.isVerified) {
            return res.json({ message: "Email already verified." });
        }

        if (!user.verificationTokenExpires || user.verificationTokenExpires.getTime() < Date.now()) {
            return res.status(400).json({ message: "Verification token has expired." });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;

        await user.save();

        return res.json({ message: "Email verified. You can now log in." });
    } catch (err) {
        next(err);
    }
};
