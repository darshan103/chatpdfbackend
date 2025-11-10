import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pdf from "pdf-extraction";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

let pdfText = "";

// ✅ Upload PDF to S3 and extract text
app.post("/upload", upload.single("pdf"), async (req, res) => {
    try {
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath);
        const data = await pdf(fileContent);
        console.log("Extracted PDF Text:", data.text);
        pdfText = data.text;

        const fileName = `pdfs/${Date.now()}_${req.file.originalname}`;

        // Upload to S3
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: fileContent,
            ContentType: "application/pdf",
        };

        // await s3.send(new PutObjectCommand(uploadParams));

        // Optional: delete local file after upload
        fs.unlinkSync(filePath);

        res.json({
            message: "✅ PDF uploaded successfully to S3!",
            // fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`,
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

        // OpenAI Response
        // const response = await client.chat.completions.create({
        //     model: "gpt-4o",
        //     messages: [{ role: "user", content: prompt }],
        // });

        // Gemini Response
        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        console.log("Gemini response:", answer);
        res.json({ answer });
    } catch (err) {
        console.error("❌ Error fetching AI response:", err);
        res.status(500).json({ error: "Error fetching AI response" });
    }
});

app.listen(5000, () => console.log("✅ Backend running on http://localhost:5000"));
