import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./decorators/roles.decorator";
import { RolesGuard } from "./guards/roles.guard";
import {
  COMMERCIAL_DATA_ROLES,
  EXPENSE_DATA_ROLES,
  HISTORICAL_IMPORT_ROLES,
  INVENTORY_DATA_ROLES,
  OPERATIONAL_DATA_ROLES,
  PRODUCTION_INPUT_ROLES,
  SALES_DATA_ROLES,
  SALES_READ_ROLES,
  USER_MANAGEMENT_ROLES,
} from "./role-policy";
import { ProvisionUserController } from "../modules/admin/provision-user.controller";
import { FactoryWorkflowController, GoodsReceiptController, InventoryWorkflowController, OpeningInventoryController } from "../modules/inventory/inventory-workflow.controller";
import { MachineLogController } from "../modules/production/machine-log.controller";
import { DailySalesSummaryController } from "../modules/sales/daily-sales-summary.controller";
import { CustomerController } from "../modules/sales/customer.controller";
import { TallyImportController } from "../modules/tally/tally-import.controller";
import { DprController } from "../modules/production/dpr.controller";
import { SalesOrderController } from "../modules/sales/sales-order.controller";
import { SlabController } from "../modules/inventory/slab.controller";
import { CuttingSessionController, PolishingSessionController } from "../modules/production/session.controllers";
import { MachineController } from "../modules/production/machine.controller";
import { InvoiceController, PaymentController } from "../modules/sales/commercial.controller";
import { ExpenseController } from "../modules/expenses/expense.controller";
import { VehicleController } from "../modules/expenses/vehicle.controller";

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
  const allRoles = ["owner", "manager", "supervisor", "operator", "accountant", "auditor", "admin", "inventory", "sales"];
  const policies: Array<{ name: string; handler: Function; roles: string[] }> = [
    { name: "provision users", handler: ProvisionUserController.prototype.provision, roles: USER_MANAGEMENT_ROLES },
    { name: "create opening snapshot", handler: OpeningInventoryController.prototype.create, roles: HISTORICAL_IMPORT_ROLES },
    { name: "add opening block", handler: OpeningInventoryController.prototype.addRawBlock, roles: HISTORICAL_IMPORT_ROLES },
    { name: "add opening slab", handler: OpeningInventoryController.prototype.addSlab, roles: HISTORICAL_IMPORT_ROLES },
    { name: "submit opening snapshot", handler: OpeningInventoryController.prototype.submit, roles: HISTORICAL_IMPORT_ROLES },
    { name: "approve opening snapshot", handler: OpeningInventoryController.prototype.approve, roles: HISTORICAL_IMPORT_ROLES },
    { name: "reject opening snapshot", handler: OpeningInventoryController.prototype.reject, roles: HISTORICAL_IMPORT_ROLES },
    { name: "make factory live", handler: FactoryWorkflowController.prototype.goLive, roles: USER_MANAGEMENT_ROLES },
    { name: "create goods receipt", handler: GoodsReceiptController.prototype.create, roles: INVENTORY_DATA_ROLES },
    { name: "submit goods receipt", handler: GoodsReceiptController.prototype.submit, roles: INVENTORY_DATA_ROLES },
    { name: "adjust inventory", handler: InventoryWorkflowController.prototype.adjust, roles: ["owner", "manager"] },
    { name: "reverse inventory movement", handler: InventoryWorkflowController.prototype.reverse, roles: ["owner", "manager"] },
    { name: "start cutting", handler: CuttingSessionController.prototype.start, roles: PRODUCTION_INPUT_ROLES },
    { name: "record cutting day log", handler: CuttingSessionController.prototype.dayLog, roles: PRODUCTION_INPUT_ROLES },
    { name: "complete cutting", handler: CuttingSessionController.prototype.complete, roles: PRODUCTION_INPUT_ROLES },
    { name: "abort cutting", handler: CuttingSessionController.prototype.abort, roles: OPERATIONAL_DATA_ROLES },
    { name: "start polishing", handler: PolishingSessionController.prototype.create, roles: PRODUCTION_INPUT_ROLES },
    { name: "complete polishing", handler: PolishingSessionController.prototype.complete, roles: PRODUCTION_INPUT_ROLES },
    { name: "abort polishing", handler: PolishingSessionController.prototype.abort, roles: OPERATIONAL_DATA_ROLES },
    { name: "create sales order", handler: SalesOrderController.prototype.create, roles: SALES_DATA_ROLES },
    { name: "cancel sales order", handler: SalesOrderController.prototype.cancel, roles: SALES_DATA_ROLES },
    { name: "deliver sales order", handler: SalesOrderController.prototype.deliver, roles: [...SALES_DATA_ROLES, "inventory"] },
    { name: "create customer", handler: CustomerController.prototype.create, roles: SALES_DATA_ROLES },
    { name: "create invoice", handler: InvoiceController.prototype.create, roles: COMMERCIAL_DATA_ROLES },
    { name: "create payment", handler: PaymentController.prototype.create, roles: COMMERCIAL_DATA_ROLES },
    { name: "backfill sales history", handler: DailySalesSummaryController.prototype.backfill, roles: HISTORICAL_IMPORT_ROLES },
    { name: "create production input", handler: DprController.prototype.upsert, roles: PRODUCTION_INPUT_ROLES },
    { name: "write management notes", handler: DprController.prototype.managementNotes, roles: ["owner", "manager"] },
    { name: "create machine", handler: MachineController.prototype.create, roles: ["owner", "manager"] },
    { name: "record machine log", handler: MachineLogController.prototype.upsert, roles: PRODUCTION_INPUT_ROLES },
    { name: "create expense", handler: ExpenseController.prototype.create, roles: EXPENSE_DATA_ROLES },
    { name: "allocate expense", handler: ExpenseController.prototype.allocate, roles: EXPENSE_DATA_ROLES },
    { name: "create vehicle", handler: VehicleController.prototype.create, roles: OPERATIONAL_DATA_ROLES },
    { name: "import Tally daybook", handler: TallyImportController.prototype.importDaybook, roles: HISTORICAL_IMPORT_ROLES },
    { name: "import Tally trial balance", handler: TallyImportController.prototype.importTrialBalance, roles: HISTORICAL_IMPORT_ROLES },
  ];

  it.each(policies)("declares an explicit policy for $name", ({ handler, roles }) => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(roles);
  });

  it.each(policies)("denies every unlisted role from $name", ({ handler, roles }) => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "get").mockReturnValue(roles);
    const guard = new RolesGuard(reflector);
    for (const role of allRoles.filter((candidate) => !roles.includes(candidate))) {
      expect(() => guard.canActivate(contextForRole(role, handler))).toThrow(ForbiddenException);
    }
  });

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
