import jwt from "jsonwebtoken";

export type JwtUserPayload = {
  id: number;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return secret;
}

export function signToken(payload: JwtUserPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d"
  });
}

export function verifyToken(token: string): JwtUserPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (
      typeof decoded === "object" &&
      typeof decoded.id === "number" &&
      typeof decoded.email === "string" &&
      typeof decoded.name === "string" &&
      (decoded.role === "USER" || decoded.role === "ADMIN")
    ) {
      return {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role
      };
    }

    return null;
  } catch {
    return null;
  }
}
