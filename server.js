import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./src/routes/auth.js";
import askaiRoutes from "./src/routes/askai.js";

const app = express();

app.use(cors({
    origin: "https://chatpdf-six-tau.vercel.app",
    credentials: true,
}));
app.use(helmet());
app.use(express.json());

// small rate limiter for auth endpoints
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many requests, try again later.' }
});
app.use('/api/auth', limiter);

app.use('/api/auth', authRoutes);
app.use('/api', askaiRoutes);

// basic error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("✅ DB connected");
        app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
    })
    .catch(err => {
        console.error('DB connection failed', err);
        process.exit(1);
    });

