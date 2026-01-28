import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id || user._id), email: user.email, role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
