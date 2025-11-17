import express from "express";
import { signup, googleLogin, verifyEmail } from "../controllers/authController.js";
const router = express.Router();

router.post("/signup", signup);
router.post("/google-login", googleLogin);
router.get("/verify-email", verifyEmail);

export default router;
