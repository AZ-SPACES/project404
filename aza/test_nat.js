const nationalities = require("i18n-nationality");
nationalities.registerLocale(require("i18n-nationality/langs/en.json"));
const namesDict = nationalities.getNames("en");

const names = Object.values(namesDict);
names.sort();
console.log(names.slice(0, 10)); // just output the first 10 for sanity check
