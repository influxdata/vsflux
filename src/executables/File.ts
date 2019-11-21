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
    src: string,
    output: string
  ): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      let ok = rp
        .get({
          url: src,
          encoding: null,
          resolveWithFullResponse: true
        })
        .then((res: { body: any }) => {
          writeFileSync(output, res.body);
          resolve(true);
        })
        .catch(() => {
          resolve(false);
        });
    });
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
