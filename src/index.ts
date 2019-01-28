#!/usr/bin/env node
import * as fs from 'fs';
import { XMLElementOrXMLNode } from 'xmlbuilder';
import { LINE_SEPARATOR, parse } from './converter';
import { Logger } from './logger';

const LOG = new Logger('index.ts');

/**
 * Show usage
 */
const showUsage = () => console.log(`
This program will convert any '*.xml' file in source dir and write to target dir.
Usage: ibatis-to-mybatis-converter [source dir] [target dir]
`);

class ArrayIterator<T> {
  private array: T[];
  private current: number;
  private length: number;

  constructor(array: T[]) {
    this.array = array;
    this.current = 0;
    this.length = array.length;
  }

  public next(value?: any): { done: boolean, value?: T } {
    if (this.current >= this.length) {
      return { done: true };
    } else {
      const result = this.array[this.current];
      this.current += 1;
      return { done: false, value: result };
    }
  }
}

/**
 * Main !!!
 */
(() => {

  const args = {
    sourceDir: '',
    targetDir: ''
  };
  let finish = false;
  // load parameters
  process.argv.forEach((val: string, index: number, array: string[]) => {
    // In nodejs, argv[0] always '/path/to/node', argv[1] always script path,
    // so argv[2] is the first parameter.
    if (index >= 2) {
      switch (index) {
        case 2:
          args.sourceDir = val;
          break;
        case 3:
          args.targetDir = val;
          finish = true;
          break;
      }
    }
  });
  if (finish) {

    // new ItoMConverter('E:/x.xml').parse((xml: XMLElementOrXMLNode) => {
    //   const result = xml.end({
    //     pretty: true,
    //   });
    //   fs.writeFile('E:/y.xml', result, {}, (err) => { if (err) { throw err; } });
    // });
    fs.readdir(args.sourceDir, (err: NodeJS.ErrnoException, items: string[]) => {
      if (err) {
        throw err;
      }
      const fileNameIterator = new ArrayIterator(items);
      const runner = (gen: ArrayIterator<string>) => {
        const next = gen.next();
        if (!next.done) {
          const fileName = next.value;
          if (!fileName) {
            throw new Error('panic');
          }

          if (!fileName.match(/\.xml$/)) {
            LOG.info(`file ${fileName} is not xml file, skip..`);
          } else {
            LOG.info(`Try convert ${fileName}.`);
            parse(`${args.sourceDir}/${fileName}`, (xml: XMLElementOrXMLNode) => {
              LOG.info(`Convert ${fileName} success.`);
              fs.writeFile(
                `${args.targetDir}/${fileName}`,
                xml.end({
                  pretty: true,
                  spacebeforeslash: ' ',
                  newline: LINE_SEPARATOR
                }),
                (errrr: NodeJS.ErrnoException) => {
                  if (errrr) {
                    LOG.error(`Failed to write file ${fileName}`, errrr);
                  }
                  runner(gen);
                });
            });
          }
        }
      };
      runner(fileNameIterator);
    });
  } else {
    showUsage();
  }
})();
