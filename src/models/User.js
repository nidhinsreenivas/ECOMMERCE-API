
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false
    },

    phone: {
      type: String,
      trim: true,
      default: null
    },

    role: {
      type: String,
      enum: ["admin", "customer"],
      default: "customer"
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(12);

  this.password = await bcrypt.hash(
    this.password,
    salt
  );
});

// Compare password
userSchema.methods.comparePassword = async function (
  enteredPassword
) {
  return bcrypt.compare(
    enteredPassword,
    this.password
  );
};

const User = mongoose.model("User", userSchema);

export default User;
