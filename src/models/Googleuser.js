import mongoose from "mongoose";

const { Schema } = mongoose;

const googleuserSchema = new Schema(
    {
        name: { type: String },
        email: { type: String, unique: true, required: true },
        googleId: { type: String },
        avatar: { type: String },
    },
    { timestamps: true }
);

export default mongoose.model("Googleuser", googleuserSchema);
