import { createClerkClient, verifyToken } from "@clerk/backend";

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export function verifyClerkToken(token: string) {
  return verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
}
