import * as fs from 'fs';
import { XMLElementOrXMLNode } from 'xmlbuilder';
import { parse } from './converter';
import { Logger } from './logger';

const LOG = new Logger('index.ts');

/**
 * Show usage
 */
const showUsage = () => console.log(`
This program will convert any '*.xml' file in source dir and write to target dir.
Usage: ibatis-to-mybatis-converter [source dir] [target dir]
`);

/**
 * Generate file names
 */
function* fileNameGenerator(items: string[], targetDir: string): Iterator<string> {

  for (const file of items) {
    if (!file.match(/\.xml$/)) {
      LOG.info(`file ${file} is not xml file, skip..`);
    } else {
      LOG.info(`Try convert ${file}.`);
      yield file;
    }
  }
}

/**
 * Runner of fileNameGenerator
 *
 * @param targetDir Output dir
 * @param gen Filename generator
 */
const runner = (targetDir: string, gen: Iterator<string>) => {
  const gent = gen.next();
  if (!gent.done) {
    const path = gent.value;
    parse(path, (xml: XMLElementOrXMLNode) => {
      fs.writeFile(`${targetDir}/${path}`, xml.end({ pretty: true }), (errrr: NodeJS.ErrnoException) => {
        if (errrr) {
          LOG.error(`Failed to convert file ${path}`, errrr);
        }
        runner(targetDir, gen);
      });
    });
  }
};
function x(sourceDir: string, targetDir: string) {

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
      const fileNameGen = fileNameGenerator(items, args.targetDir);
      runner(args.targetDir, fileNameGen);
    });
  } else {
    showUsage();
  }
})();
