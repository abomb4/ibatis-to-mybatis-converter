/**
 * Show usage
 */
const showUsage = () => console.log('Usage: U N K N O W N');
/**
 * Main !!!
 */
(() => {
    // load parameters
    process.argv.forEach((val, index, array) => {
        console.log(index + ': ' + val);
    });
    showUsage();
})();
//# sourceMappingURL=index.js.map