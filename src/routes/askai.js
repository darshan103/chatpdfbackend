import express from "express";
import { upload, uploadFile, askGemini } from "../controllers/askaiController.js";

const router = express.Router();

router.post("/upload", upload.single("pdf"), uploadFile);
router.post("/askgemini", askGemini);

export default router;
