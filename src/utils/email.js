import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // true for port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendMail({ to, subject, html, text }) {
    const msg = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
    };

    return transporter.sendMail(msg);
}
