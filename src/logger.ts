
function c(optionalParams?: any[]) {
  return (optionalParams && optionalParams.length > 0);
}
/**
 * Centered logger
 */
export class Logger {

  private name: string;
  private enables = {
    debug: true,
    info: true,
    warn: true,
    error: true
  };
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Info log
   *
   * @param message Logging element
   * @param optionalParams Optional params
   */
  public info(message?: any, ...optionalParams: any[]) {
    if (this.enables.info === true) {
      c(optionalParams)
        ? console.log(`[${this.name}] INFO :`, message, optionalParams)
        : console.log(`[${this.name}] INFO :`, message);
    }
  }

  /**
   * Debug log
   *
   * @param message Logging element
   * @param optionalParams Optional params
   */
  public debug(message?: any, ...optionalParams: any[]) {
    if (this.enables.debug === true) {
      c(optionalParams)
        ? console.log(`[${this.name}] DEBUG:`, message, optionalParams)
        : console.log(`[${this.name}] DEBUG:`, message);
    }
  }

  /**
   * Warning log
   *
   * @param message Logging element
   * @param optionalParams Optional params
   */
  public warn(message?: any, ...optionalParams: any[]) {
    if (this.enables.warn === true) {
      c(optionalParams)
        ? console.log(`[${this.name}] WARN :`, message, optionalParams)
        : console.log(`[${this.name}] WARN :`, message);
    }
  }

  /**
   * Error log
   *
   * @param message Logging element
   * @param optionalParams Optional params
   */
  public error(message?: any, ...optionalParams: any[]) {
    if (this.enables.error === true) {
      c(optionalParams)
        ? console.error(`[${this.name}] ERROR:`, message, optionalParams)
        : console.error(`[${this.name}] ERROR:`, message);
    }
  }
}
