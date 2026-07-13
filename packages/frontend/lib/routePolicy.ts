export const ALL_ROLES = ["owner", "manager", "supervisor", "operator", "accountant", "auditor", "admin", "inventory", "sales"];

const POLICIES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin", roles: ["owner", "manager"] },
  { prefix: "/setup", roles: ["owner", "manager"] },
  { prefix: "/tally", roles: ["owner", "manager", "accountant"] },
  { prefix: "/machines", roles: ["owner", "manager"] },
  { prefix: "/expenses", roles: ["owner", "manager", "supervisor", "accountant", "auditor"] },
  { prefix: "/receipts", roles: ["owner", "manager", "supervisor", "inventory"] },
  { prefix: "/inventory", roles: ["owner", "manager", "supervisor", "inventory", "sales", "auditor"] },
  { prefix: "/sales", roles: ["owner", "manager", "supervisor", "sales", "inventory", "accountant", "auditor"] },
  { prefix: "/dpr", roles: ["owner", "manager", "supervisor", "operator"] },
  { prefix: "/polishing", roles: ["owner", "manager", "supervisor", "operator"] },
  { prefix: "/ai", roles: ["owner", "manager"] },
  { prefix: "/dashboard", roles: ALL_ROLES },
  { prefix: "/", roles: ALL_ROLES },
];

export function canAccessRoute(role: string | undefined, pathname: string) {
  if (!role) return false;
  const policy = POLICIES.find((candidate) => pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`));
  return policy ? policy.roles.includes(role) : false;
}
