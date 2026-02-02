import { User } from "../models/User.js";
import { signToken, verifyPassword } from "../utils/auth.js";

export async function login(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis." });

  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: "Identifiants invalides." });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Identifiants invalides." });

  const token = signToken(user);
  res.json({ data: { token, user: { email: user.email, role: user.role, name: user.name } } });
}

export async function me(req, res) {
  res.json({ data: { user: req.user } });
}
