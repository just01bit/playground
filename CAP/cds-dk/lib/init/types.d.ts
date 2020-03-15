

/**
 * Called from wrapper modules
 */
export interface CDSGenerator {
  /**
   * Initializes the generator and starts generation
   * @param projectName the new project name or null
   * @param options the current options
   */
  stepInit(projectName: string, options: any): Promise<void>;

  /**
   * Displays a final message
   */

  stepEnd(): Promise<void>;

  /**
   * Contains the parameter description
   */
  config: any;
}


/**
 * An interface providing logging functionality.
 */
export interface Logger {
  /**
   * Writes a debug message to log.
   * @param message the message to write to log
   */
  debug(message: string): void;

  /**
   * Writes a message to log.
   * @param message the message to write to log
   */
  log(message: string): void;

  /**
   * Writes a warning message to log.
   * @param message the message to write to log
   */
  warn(message: string): void;

  /**
   * Writes an error to log.
   * @param Error the error to write to log
   */
  error(error: Error): void;
}


/**
 * This is a helper interface to provide support for different file system implementations.
 * Depending on the scenario different file systems will be used, e.g. Yeoman vs. native FS.
 */
export interface FsUtil {
  /**
   * Copies a file or folder from given source to destination.
   * @param source the source path
   * @param destination the destination path
   * @param options optional copy options
   * @param skipFileLog do not log files if true
   */
  copy(source: string, destination: string, options?: any, skipFileLog?: boolean): Promise<void>;

  /**
   * Checks if given path exists.
   * @param filePath the absolute path
   * @returns true if given path exists, otherwise false
   */
  pathExists(filePath: string): Promise<boolean>;

  /**
   * Reads a file from given path.
   * @param filePath the absolute file path
   * @param options optional read options
   * @returns the file content as string
   */
  readFile(filePath: string, options?: any): Promise<string>;

  /**
   * Reads a JSON object from a file.
   * @param filePath the absolute file path
   * @returns the file content as object
   */
  readJSON(filePath: string): Promise<any>;

  /**
   * Writes the given string into a file.
   * @param filepath the absolute file path
   * @param content the string to serialize to JSON
   */
  writeFile(filePath: string, content: string, skipLogFile?: boolean): Promise<void>;

  /**
   * Writes the given object as JSON into a file.
   * @param filepath the absolute file path
   * @param object the object to serialize to JSON
   */
  writeJSON(filepath: string, object: any, options?: any): Promise<void>;

  /*
  * Methods mapping to fs-extra
  */
  readdir(filePath: string): Promise<string[]>;

  mkdirp(folderPath: string): Promise<void>;

  stat(filePath: string): Promise<any>;

  /*
  * Helper methods
  */
  hasContent(folderPath: string): Promise<boolean>;

  getTouchedFiles(): string[];

}

/**
 * Helper for managing npm related tasks
 */
export interface NpmUtil {
  /**
   * Installs npm packages
   * @param cwd working folder
   * @param options npm install options, e.g. force
   */
  install(cwd?: string, options?: any): Promise<void>
}
