import { stat, mkdir, writeFileSync } from "fs";
import which = require("which");
import rp = require("request-promise");

/**
 * Code related to file system
 */
export class FileSystem {
  /**
   * Checks if there is a directory at a specified path
   * @param path a path to check
   * @return true if there is a directory otherwise false
   */
  public static doesDirExist(path: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      stat(path, (err, stats) => {
        resolve(!err && stats.isDirectory());
      });
    });
  }

  /**
   * create a directory at a specified path
   * @param path a path to create
   * @return true if success otherwise false
   */
  public static createDir(path: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      mkdir(path, err => {
        resolve(!err);
      });
    });
  }

  public static async downloadFile(
    url: string,
    output: string
  ): Promise<boolean> {
    try {
      const { body } = await rp.get({
        url,
        encoding: null,
        resolveWithFullResponse: true
      });
      writeFileSync(output, body);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Looks for a specified executable at paths specified in the environment variable PATH
   * @param executable an executable to look for
   * @return A path to the executable if it has been found otherwise undefined
   */
  public static async findExecutablePath(
    executable: string
  ): Promise<string | undefined> {
    return new Promise<string | undefined>(resolve => {
      which(executable, (err, path) => {
        if (err) {
          resolve(undefined);
        } else {
          resolve(path);
        }
      });
    });
  }
}
