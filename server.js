import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { DOMMatrix } from "canvas";
global.DOMMatrix = DOMMatrix;

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

let pdfText = ""; // store extracted text temporarily

// ✅ Upload PDF to S3 and extract text
app.post("/upload", upload.single("pdf"), async (req, res) => {
    try {
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath);
        const pdfData = await new PDFParse(fileContent);
        pdfText = pdfData.text;

        const fileName = `pdfs/${Date.now()}_${req.file.originalname}`;

        // Upload to S3
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: fileContent,
            ContentType: "application/pdf",
        };

        await s3.send(new PutObjectCommand(uploadParams));

        // Optional: delete local file after upload
        fs.unlinkSync(filePath);

        res.json({
            message: "✅ PDF uploaded successfully to S3!",
            fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`,
        });
    } catch (err) {
        console.error("❌ Upload error:", err);
        res.status(500).json({ error: "Error uploading or parsing PDF" });
    }
});

// ✅ Ask question from uploaded PDF content
app.post("/ask", async (req, res) => {
    try {
        const { question } = req.body;
        if (!pdfText) return res.json({ answer: "Please upload a PDF first." });

        const prompt = `
        You are an AI reading this PDF content:
        "${pdfText.slice(0, 4000)}"
        Answer the question clearly and concisely: ${question}
        `;

        const completion = await client.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [{ role: "user", content: prompt }],
        });

        res.json({ answer: completion.choices[0].message.content });
    } catch (err) {
        console.error("❌ Error fetching AI response:", err);
        res.status(500).json({ error: "Error fetching AI response" });
    }
});

app.listen(5000, () => console.log("✅ Backend running on http://localhost:5000"));
