import * as fs from 'fs';
import { XMLElementOrXMLNode } from 'xmlbuilder';
import { ItoMConverter } from './converter';

/**
 * Show usage
 */
const showUsage = () => console.log('Usage: U N K N O W N');

/**
 * Main !!!
 */
(() => {
  // load parameters
  process.argv.forEach((val: string, index: number, array: string[]) => {
    console.log(index + ': ' + val);
  });
  new ItoMConverter('E:/x.xml').parse((xml: XMLElementOrXMLNode) => {
    const result = xml.end({
      pretty: true,
    });
    fs.writeFile('E:/y.xml', result, {}, (err) => { if (err) { throw err; } });
  });
  showUsage();
})();
