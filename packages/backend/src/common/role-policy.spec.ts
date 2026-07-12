import {
  COMMERCIAL_DATA_ROLES,
  HISTORICAL_IMPORT_ROLES,
  OPERATIONAL_DATA_ROLES,
  PRODUCTION_INPUT_ROLES,
  SALES_DATA_ROLES,
  USER_MANAGEMENT_ROLES,
} from "./role-policy";

describe("role policy", () => {
  it("keeps operators limited to production input", () => {
    expect(PRODUCTION_INPUT_ROLES).toContain("operator");
    expect(USER_MANAGEMENT_ROLES).not.toContain("operator");
    expect(HISTORICAL_IMPORT_ROLES).not.toContain("operator");
    expect(OPERATIONAL_DATA_ROLES).not.toContain("operator");
    expect(SALES_DATA_ROLES).not.toContain("operator");
    expect(COMMERCIAL_DATA_ROLES).not.toContain("operator");
  });

  it("allows supervisors to enter operational data but not user or historical import data", () => {
    expect(PRODUCTION_INPUT_ROLES).toContain("supervisor");
    expect(OPERATIONAL_DATA_ROLES).toContain("supervisor");
    expect(SALES_DATA_ROLES).toContain("supervisor");
    expect(COMMERCIAL_DATA_ROLES).toContain("supervisor");
    expect(USER_MANAGEMENT_ROLES).not.toContain("supervisor");
    expect(HISTORICAL_IMPORT_ROLES).not.toContain("supervisor");
  });

  it("limits user management and historical imports to owners and managers", () => {
    expect(USER_MANAGEMENT_ROLES).toEqual(["owner", "manager"]);
    expect(HISTORICAL_IMPORT_ROLES).toEqual(["owner", "manager"]);
  });
});
