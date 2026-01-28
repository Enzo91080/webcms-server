import { verifyToken } from "../utils/auth.js";
import { User } from "../models/User.js";

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer") return null;
  return token || null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyToken(token);
    const user = await User.findByPk(payload.sub, {
      attributes: ["id", "email", "role", "name"],
    });
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
