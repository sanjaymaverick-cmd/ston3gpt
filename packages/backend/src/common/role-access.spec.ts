import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./decorators/roles.decorator";
import { RolesGuard } from "./guards/roles.guard";
import { HISTORICAL_IMPORT_ROLES, PRODUCTION_INPUT_ROLES, SALES_DATA_ROLES, SALES_READ_ROLES, USER_MANAGEMENT_ROLES } from "./role-policy";
import { ProvisionUserController } from "../modules/admin/provision-user.controller";
import { OpeningInventoryController } from "../modules/inventory/inventory-workflow.controller";
import { MachineLogController } from "../modules/production/machine-log.controller";
import { DailySalesSummaryController } from "../modules/sales/daily-sales-summary.controller";
import { CustomerController } from "../modules/sales/customer.controller";
import { TallyImportController } from "../modules/tally/tally-import.controller";
import { DprController } from "../modules/production/dpr.controller";
import { SalesOrderController } from "../modules/sales/sales-order.controller";
import { SlabController } from "../modules/inventory/slab.controller";

function rolesFor(target: object, methodName: string) {
  return Reflect.getMetadata(ROLES_KEY, target.constructor.prototype[methodName]);
}

function contextForRole(role: string, handler: Function) {
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as any;
}

describe("protected endpoint role access", () => {
  it("keeps user management manager/owner only", () => {
    const controller = new ProvisionUserController({} as any);

    expect(rolesFor(controller, "provision")).toEqual(USER_MANAGEMENT_ROLES);
    expect(rolesFor(controller, "provision")).not.toContain("supervisor");
    expect(rolesFor(controller, "provision")).not.toContain("operator");
  });

  it("keeps historical imports manager/owner only", () => {
    const dailySales = new DailySalesSummaryController({} as any);
    const tally = new TallyImportController({} as any);
    const opening = new OpeningInventoryController({} as any);

    expect(rolesFor(dailySales, "backfill")).toEqual(HISTORICAL_IMPORT_ROLES);
    expect(rolesFor(tally, "importDaybook")).toEqual(HISTORICAL_IMPORT_ROLES);
    expect(rolesFor(tally, "importTrialBalance")).toEqual(HISTORICAL_IMPORT_ROLES);
    expect(rolesFor(opening, "create")).toEqual(HISTORICAL_IMPORT_ROLES);
    expect(rolesFor(opening, "approve")).toEqual(HISTORICAL_IMPORT_ROLES);
  });

  it("allows operators only on production input endpoints among newly protected routes", () => {
    const machineLog = new MachineLogController({} as any);
    const customer = new CustomerController({} as any);

    expect(rolesFor(machineLog, "upsert")).toEqual(PRODUCTION_INPUT_ROLES);
    expect(rolesFor(machineLog, "upsert")).toContain("operator");
    expect(rolesFor(customer, "create")).toEqual(SALES_DATA_ROLES);
    expect(rolesFor(customer, "create")).not.toContain("operator");
  });

  it("keeps management notes and commercial reads away from operators", () => {
    const dpr = new DprController({} as any);
    const sales = new SalesOrderController({} as any, {} as any);
    const slabs = new SlabController({} as any);

    expect(rolesFor(dpr, "managementNotes")).toEqual(["owner", "manager"]);
    expect(rolesFor(dpr, "managementNotes")).not.toContain("operator");
    expect(rolesFor(sales, "findAll")).toEqual(SALES_READ_ROLES);
    expect(rolesFor(sales, "findAll")).not.toContain("operator");
    expect(rolesFor(slabs, "eligibleForSale")).toEqual(SALES_READ_ROLES);
  });

  it("denies a role that is absent from a handler's required roles", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "get").mockReturnValue(USER_MANAGEMENT_ROLES);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextForRole("operator", ProvisionUserController.prototype.provision))).toThrow(
      ForbiddenException,
    );
  });

  it("allows a role that is present in a handler's required roles", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "get").mockReturnValue(PRODUCTION_INPUT_ROLES);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextForRole("operator", MachineLogController.prototype.upsert))).toBe(true);
  });
});
