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
  console.log(new ItoMConverter('E:/x.xml').parse());
  showUsage();
})();
