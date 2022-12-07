import { Contract } from "locklift";
import { StEverVaultAbi } from "../build/factorySource";
import chalk from "chalk";

export const isValidAddress = (address: string) => /^(?:-1|0):[0-9a-fA-F]{64}$/.test(address);

class Logger {
  private stepCounter = 1;
  startStep = (message: string) => {
    console.log(chalk.blue(`Step ${this.stepCounter++}. ${message}`));
  };
  successStep = (message: string) => {
    console.log(chalk.green(`Step ${this.stepCounter - 1} success ${message}`));
  };
  info = (message: string) => {
    console.log(chalk.cyan(message));
  };
  event = (message: string) => {
    console.log(chalk.yellow(message));
  };
}

export const logger = new Logger();
