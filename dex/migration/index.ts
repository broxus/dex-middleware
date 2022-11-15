import { migrationLog } from "../pathBuilder/migrationLog";
import { Address, Contract } from "locklift";
import { factorySource } from "../../build/factorySource";

type MigrationLog = typeof migrationLog;
type MigrationLogKeys = keyof MigrationLog;
type MigrationEntity = MigrationLog[MigrationLogKeys];
export class Migration {
  migrationLog = migrationLog;
  private getMigrationEntity = (entityName: string): MigrationEntity => migrationLog[entityName as MigrationLogKeys];

  exists = (entityName: string): boolean => !!this.getMigrationEntity(entityName);

  load = (migrationEntityName: string): Contract<any> => {
    const entity = this.getMigrationEntity(migrationEntityName);
    const entityName =
      entity.name.endsWith("Root") && !entity.name.includes("Dex") ? "TokenRootUpgradeable" : entity.name;
    try {
      return locklift.factory.getDeployedContract(
        entityName as keyof typeof factorySource,
        new Address(entity.address),
      );
    } catch (e) {
      migrationEntityName;
      entity;
      debugger;
    }
  };
}
