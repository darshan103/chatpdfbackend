import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pdf from "pdf-extraction";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// AWS S3 setup
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Multer config
export const upload = multer({ dest: "uploads/" });

let pdfText = "";

// ---------------- UPLOAD FILE -------------------
export const uploadFile = async (req, res) => {
    try {
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath);

        // Extract PDF text
        const data = await pdf(fileContent);
        console.log("Extracted PDF Text:", data.text);
        pdfText = data.text;

        const fileName = `pdfs/${Date.now()}_${req.file.originalname}`;

        // Upload to S3 (optional)
        // const uploadParams = {
        //     Bucket: process.env.AWS_BUCKET_NAME,
        //     Key: fileName,
        //     Body: fileContent,
        //     ContentType: "application/pdf",
        // };
        // await s3.send(new PutObjectCommand(uploadParams));

        // Remove local file
        fs.unlinkSync(filePath);

        res.json({
            message: "✅ PDF uploaded successfully!",
            // fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`,
        });
    } catch (err) {
        console.error("❌ Upload error:", err);
        res.status(500).json({ error: "Error uploading or parsing PDF" });
    }
};

// ---------------- ASK GEMINI -------------------
export const askGemini = async (req, res) => {
    try {
        console.log("Gemini Key:", process.env.GEMINI_API_KEY);
        const { question } = req.body;

        if (!pdfText) {
            return res.json({ answer: "Please upload a PDF first." });
        }

        const prompt = `
You are an AI reading this PDF content:
"${pdfText.slice(0, 4000)}"

Answer the question clearly and concisely:
${question}
        `;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();

        console.log("Gemini response:", answer);

        res.json({ answer });
    } catch (err) {
        console.error("❌ Error fetching AI response:", err);
        res.status(500).json({ error: "Error fetching AI response" });
    }
};
